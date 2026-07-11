// 記事検索のクライアント側エンジン（issue #14）。SearchBox.astroから動的importされる。
//
// DuckDB Wasm本体（30MB超）はCloudflare Workersの静的アセット1ファイル25MB制限を
// 超えるためセルフホストできず、公式配布のjsDelivr CDNからロードする。
// 検索インデックス（記事データ）は自サイト配信のまま。
// ビルド時に生成された /search-index.parquet をSQLで検索する。
// Parquetは列指向なので、DuckDBはHTTPレンジリクエストで必要な列だけを読む。
//
// 日本語対応: DuckDBにNFKC正規化が無いため、インデックス生成側（search-index.mjs）と
// 同じ正規化（NFKC + 小文字）をクエリ側でも行い、正規化済み列（n_*）同士で比較する。
// 並び順は日付の降順（新しい順）。ヒット箇所はスニペット（本文のマッチ前後）で示す。

import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export interface SearchHit {
	slug: string;
	collection: string;
	title: string;
	pubDate: string;
	body: string;
}

// ハイライト表示用のテキスト断片。hit=trueの部分を<mark>で描画する
export interface Fragment {
	text: string;
	hit: boolean;
}

let connPromise: Promise<AsyncDuckDBConnection> | null = null;

function initConnection(): Promise<AsyncDuckDBConnection> {
	connPromise ??= (async () => {
		const duckdb = await import('@duckdb/duckdb-wasm');
		const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
		// クロスオリジンのworker URLは直接 new Worker() できないため、
		// blob URL経由のimportScriptsでラップする（duckdb-wasm公式のworkaround）
		const workerUrl = URL.createObjectURL(
			new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
		);
		try {
			const worker = new Worker(workerUrl);
			const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
			await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
			return db.connect();
		} finally {
			URL.revokeObjectURL(workerUrl);
		}
	})();
	return connPromise;
}

// インデックス生成側（search-index.mjs の normalize）と同じ処理
function normalize(text: string): string {
	return text.normalize('NFKC').toLowerCase();
}

function escapeLike(text: string): string {
	return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// クエリを正規化済みの検索語に分解する（SearchBox側とスニペット側で共用）
export function toWords(query: string): string[] {
	return normalize(query).trim().split(/\s+/).filter(Boolean).slice(0, 5);
}

export async function search(query: string): Promise<SearchHit[]> {
	const words = toWords(query);
	if (words.length === 0) return [];

	const conn = await initConnection();
	const indexUrl = new URL('/search-index.parquet', location.href).href;

	// 全語がタイトル・タグ・本文のどこかに含まれる記事（AND）を新しい順に返す
	const like = `LIKE ? ESCAPE '\\'`;
	const condExprs = words.map(() => `(n_title ${like} OR n_tags ${like} OR n_body ${like})`);
	const params = words.flatMap((w) => Array(3).fill(`%${escapeLike(w)}%`));

	const sql = `
		SELECT slug, collection, title, CAST(pubDate AS VARCHAR) AS pubDate, body
		FROM read_parquet('${indexUrl}')
		WHERE ${condExprs.join(' AND ')}
		ORDER BY pubDate DESC
		LIMIT 30
	`;
	const stmt = await conn.prepare(sql);
	try {
		const result = await stmt.query(...params);
		return result.toArray().map((row: any) => ({
			slug: String(row.slug),
			collection: String(row.collection),
			title: String(row.title),
			pubDate: String(row.pubDate),
			body: String(row.body),
		}));
	} finally {
		await stmt.close();
	}
}

// テキストを検索語のマッチ／非マッチの断片に分割する（タイトルのハイライト用）。
// 大文字小文字は無視。全半角ゆれ（正規化しないと当たらないもの）はここでは追わない
export function toFragments(text: string, words: string[]): Fragment[] {
	if (words.length === 0) return [{ text, hit: false }];
	const re = new RegExp(`(${words.map(escapeRegExp).join('|')})`, 'giu');
	return text
		.split(re)
		.filter((part) => part !== '')
		.map((part) => ({ text: part, hit: words.includes(normalize(part)) }));
}

// 本文からマッチ箇所の前後を切り出したスニペットを作る。
// 原文でのマッチを優先し、全半角ゆれで当たらない場合は正規化文字列上の位置で近似する。
// どの語も本文に無い（タイトル・タグのみのヒット）場合は本文の冒頭を返す
export function makeSnippet(body: string, words: string[], span = 130): Fragment[] {
	let center = -1;
	for (const word of words) {
		const m = new RegExp(escapeRegExp(word), 'iu').exec(body);
		if (m) {
			center = m.index;
			break;
		}
		const approx = normalize(body).indexOf(word);
		if (approx >= 0) {
			center = Math.min(approx, body.length - 1);
			break;
		}
	}
	if (center < 0) {
		const head = body.slice(0, span);
		return [{ text: head + (body.length > span ? '…' : ''), hit: false }];
	}
	const start = Math.max(0, center - Math.floor(span / 3));
	const end = Math.min(body.length, start + span);
	const snippet =
		(start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
	return toFragments(snippet, words);
}
