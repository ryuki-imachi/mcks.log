// 記事検索用インデックス（Parquet）を生成するAstro integration（issue #14）。
//
// 全コレクションの記事（draft除く）からタイトル・タグ・本文などを集め、
// 検索用に正規化した列（NFKC + 小文字。DuckDBにNFKC正規化関数が無いため
// JS側で行い、クエリ側も同じ正規化を通して比較する）を付けてParquetに書き出す。
//
// Workers Buildsのビルドコマンドが `npx astro build` 固定のため、
// package.jsonのスクリプトではなくintegrationとして組み込む。
//   - 本番ビルド: astro:build:done で dist/search-index.parquet を生成
//   - devサーバー: astro:server:setup で public/search-index.parquet を生成（gitignore済み）
//
// Parquet化は @duckdb/node-api（一時JSONを read_json_auto で読んで COPY TO）。

import { DuckDBInstance } from '@duckdb/node-api';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COLLECTIONS = ['tech', 'travel', 'memo', 'stream'];

// frontmatter（--- ... ---）と本文に分割する
function splitFrontmatter(raw) {
	const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
	if (!m) return null;
	return { fm: YAML.parse(m[1]), body: raw.slice(m[0].length) };
}

// Markdown本文を検索用のプレーンテキストに落とす。
// コードブロックの中身は検索対象として残し、記法・URL単独行などのノイズを除く
function toPlainText(body) {
	return body
		.replace(/^```.*$/gm, '') // コードフェンス行（中身は残す）
		.replace(/^:::.*$/gm, '') // :::note などのディレクティブ行
		.replace(/^https?:\/\/\S+$/gm, '') // リンクカード用のURL単独行
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 画像 → altテキスト
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // リンク → テキスト
		.replace(/^#{1,6}\s+/gm, '') // 見出し記号
		.replace(/^>\s?/gm, '') // 引用記号
		.replace(/[`*_~]/g, '') // インライン装飾
		.replace(/\s+/g, ' ') // 空白の圧縮
		.trim();
}

// 検索用の正規化。インデックス生成側とクエリ側で必ず同じ処理を通す
function normalize(text) {
	return text.normalize('NFKC').toLowerCase();
}

function collectRecords() {
	const records = [];
	for (const collection of COLLECTIONS) {
		const dir = path.join(ROOT, 'src/content', collection);
		if (!fs.existsSync(dir)) continue;
		for (const file of fs.readdirSync(dir)) {
			if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
			const parsed = splitFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
			if (!parsed || parsed.fm.draft) continue;
			const { fm, body } = parsed;
			const tags = (fm.tags ?? []).join(' ');
			const plain = toPlainText(body);
			records.push({
				slug: file.replace(/\.(md|mdx)$/, ''),
				collection,
				title: fm.title,
				description: fm.description ?? '',
				pubDate: String(fm.pubDate).slice(0, 10),
				tags,
				body: plain, // スニペット表示用の原文プレーンテキスト
				n_title: normalize(fm.title),
				n_tags: normalize(tags),
				n_body: normalize(plain),
			});
		}
	}
	return records;
}

async function generateIndex(outPath) {
	const records = collectRecords();
	const tmpJson = path.join(os.tmpdir(), `mcks-search-index-${process.pid}.json`);
	fs.writeFileSync(tmpJson, JSON.stringify(records));
	try {
		const instance = await DuckDBInstance.create(':memory:');
		const connection = await instance.connect();
		await connection.run(`
			COPY (
				SELECT * FROM read_json_auto('${tmpJson}')
				ORDER BY pubDate DESC
			) TO '${outPath}' (FORMAT parquet, COMPRESSION zstd)
		`);
	} finally {
		fs.rmSync(tmpJson, { force: true });
	}
	return records.length;
}

export default function searchIndex() {
	return {
		name: 'search-index',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const out = fileURLToPath(new URL('search-index.parquet', dir));
				const count = await generateIndex(out);
				logger.info(`search-index.parquet を生成（${count}記事）`);
			},
			'astro:server:setup': async () => {
				// devサーバーでも検索を動かすため、配信されるpublic/に生成する（.gitignore済み）
				await generateIndex(path.join(ROOT, 'public/search-index.parquet'));
			},
		},
	};
}
