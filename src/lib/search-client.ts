// 記事検索のクライアント側エンジン（issue #14）。SearchBox.astroから動的importされる。
//
// DuckDB Wasm本体（30MB超）はCloudflare Workersの静的アセット1ファイル25MB制限を
// 超えるためセルフホストできず、公式配布のjsDelivr CDNからロードする。
// 検索インデックス（記事データ）は自サイト配信のまま。
// ビルド時に生成された /search-index.parquet を初期化時に丸ごと取得してエンジンに
// 登録し（約600KB）、以降のクエリはネットワークを使わずSQLで検索する（issue #26）。
//
// 初回ロードが重い（wasmのDL+コンパイルで数秒）ため、SearchBox側が使う気配を
// 検知した時点で warmup() / prefetchEngineAssets() により先回りでロードする（issue #26）。
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

// エンジンに登録するインデックスの内部ファイル名（クエリはURLではなくこれを参照する）
const INDEX_FILE = 'search-index.parquet';

let connPromise: Promise<AsyncDuckDBConnection> | null = null;

async function createConnection(): Promise<AsyncDuckDBConnection> {
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
		// wasmの初期化と並行してインデックス本体も取得する
		const indexUrl = new URL(`/${INDEX_FILE}`, location.href).href;
		const [, indexBuffer] = await Promise.all([
			db.instantiate(bundle.mainModule, bundle.pthreadWorker),
			fetch(indexUrl).then((res) => {
				if (!res.ok) throw new Error(`検索インデックスの取得に失敗: ${res.status}`);
				return res.arrayBuffer();
			}),
		]);
		await db.registerFileBuffer(INDEX_FILE, new Uint8Array(indexBuffer));
		const conn = await db.connect();
		// parquet拡張のダウンロードとメタデータ読みも初回検索の前にここで済ませておく
		await conn.query(`SELECT count(*) FROM read_parquet('${INDEX_FILE}')`);
		return conn;
	} finally {
		URL.revokeObjectURL(workerUrl);
	}
}

function initConnection(): Promise<AsyncDuckDBConnection> {
	if (!connPromise) {
		connPromise = createConnection();
		// 失敗したら破棄して、次の呼び出しで最初からやり直す（先読みの失敗を恒久化しない）
		connPromise.catch(() => {
			connPromise = null;
		});
	}
	return connPromise;
}

// 検索エンジンを先回りで初期化する（issue #26）。初期化済みならtrueを返すだけ。
// 失敗は握りつぶす（実際の検索時に initConnection が再試行する）
export async function warmup(): Promise<boolean> {
	try {
		await initConnection();
		return true;
	} catch {
		return false;
	}
}

// エンジン実体（wasm/worker）を低優先度でダウンロードしてHTTPキャッシュだけ温める
// （issue #26のアイドル時先読み用）。初期化はしないのでCPU・メモリを消費しない。
// 失敗してもよい（実際のロード時に通常どおり取得される）
export async function prefetchEngineAssets(): Promise<void> {
	if (connPromise) return; // 本初期化が始まっていたら二重ダウンロードを避ける
	try {
		const duckdb = await import('@duckdb/duckdb-wasm');
		const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
		await Promise.all(
			[bundle.mainModule, bundle.mainWorker]
				.filter((url): url is string => !!url)
				.map((url) => fetch(url, { priority: 'low' }).then((res) => res.blob())),
		);
	} catch {
		// 先読みは失敗しても実害なし
	}
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

	// 全語がタイトル・タグ・本文のどこかに含まれる記事（AND）を新しい順に返す
	const like = `LIKE ? ESCAPE '\\'`;
	const condExprs = words.map(() => `(n_title ${like} OR n_tags ${like} OR n_body ${like})`);
	const params = words.flatMap((w) => Array(3).fill(`%${escapeLike(w)}%`));

	const sql = `
		SELECT slug, collection, title, CAST(pubDate AS VARCHAR) AS pubDate, body
		FROM read_parquet('${INDEX_FILE}')
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
