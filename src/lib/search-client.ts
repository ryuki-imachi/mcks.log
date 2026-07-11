// 記事検索のクライアント側エンジン（issue #14）。SearchBox.astroから動的importされる。
//
// DuckDB Wasmをセルフホスト（Viteの?url importでバンドルに同梱）で初期化し、
// ビルド時に生成された /search-index.parquet をSQLで検索する。
// Parquetは列指向なので、DuckDBはHTTPレンジリクエストで必要な列だけを読む。
//
// 日本語対応: DuckDBにNFKC正規化が無いため、インデックス生成側（search-index.mjs）と
// 同じ正規化（NFKC + 小文字）をクエリ側でも行い、正規化済み列（n_*）同士で比較する。

import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export interface SearchHit {
	slug: string;
	collection: string;
	title: string;
	pubDate: string;
}

let connPromise: Promise<AsyncDuckDBConnection> | null = null;

function initConnection(): Promise<AsyncDuckDBConnection> {
	connPromise ??= (async () => {
		const duckdb = await import('@duckdb/duckdb-wasm');
		const [wasmMvp, workerMvp, wasmEh, workerEh] = await Promise.all([
			import('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'),
			import('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'),
			import('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'),
			import('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'),
		]);
		const bundle = await duckdb.selectBundle({
			mvp: { mainModule: wasmMvp.default, mainWorker: workerMvp.default },
			eh: { mainModule: wasmEh.default, mainWorker: workerEh.default },
		});
		const worker = new Worker(bundle.mainWorker!);
		const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
		await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
		return db.connect();
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

export async function search(query: string): Promise<SearchHit[]> {
	const words = normalize(query).trim().split(/\s+/).filter(Boolean).slice(0, 5);
	if (words.length === 0) return [];

	const conn = await initConnection();
	const indexUrl = new URL('/search-index.parquet', location.href).href;

	// 語ごとに「タイトル4点・タグ2点・本文1点」を加点し、全語のANDでヒット判定する。
	// SQLパラメータは出現順（SELECT句のスコア→WHERE句の条件）で積む
	const like = `LIKE ? ESCAPE '\\'`;
	const scoreExprs = words.map(
		() => `(CASE WHEN n_title ${like} THEN 4 WHEN n_tags ${like} THEN 2 ELSE 1 END)`,
	);
	const condExprs = words.map(() => `(n_title ${like} OR n_tags ${like} OR n_body ${like})`);
	const params = [
		...words.flatMap((w) => Array(2).fill(`%${escapeLike(w)}%`)),
		...words.flatMap((w) => Array(3).fill(`%${escapeLike(w)}%`)),
	];

	const sql = `
		SELECT slug, collection, title, CAST(pubDate AS VARCHAR) AS pubDate,
			${scoreExprs.join(' + ')} AS score
		FROM read_parquet('${indexUrl}')
		WHERE ${condExprs.join(' AND ')}
		ORDER BY score DESC, pubDate DESC
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
		}));
	} finally {
		await stmt.close();
	}
}
