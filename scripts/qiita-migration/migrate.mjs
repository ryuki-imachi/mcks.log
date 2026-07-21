// Qiita記事をmcks.logへ一括移植するスクリプト（issue #16）。
//
//   node scripts/qiita-migration/migrate.mjs --dry-run          全件ドライラン（書き込み・画像転送なし）
//   node scripts/qiita-migration/migrate.mjs --only <basename>  指定記事だけ本実行
//   node scripts/qiita-migration/migrate.mjs --only <basename> --pub-date YYYY-MM-DD
//                                                               本公開日を指定して個別移植（issue #35）
//   node scripts/qiita-migration/migrate.mjs                    全件本実行
//
// 変換内容:
//   - frontmatter: pubDate=Qiita初出日(created_at)。限定共有→本公開の記事はcreated_atが
//     限定公開日になるため、--pub-date で本公開日を上書きする（issue #35）/ importedDate=実行日 /
//     qiitaStats{views,likes,stocks,fetchedAt}（内部保持のみ）/ タグ変換表適用
//   - コレクション振り分け: 元タグに「ポエム」あり → stream、なし → tech
//   - 画像: qiita-image-store の画像をDL → s3://ryu-ki-learn-blog-assets/<slug>/ へアップ →
//     本文URLを https://images.ryu-ki-learn.com/<slug>/<filename> に置換
//   - リンクカード・:::note 記法はQiita互換のため無変換
//
// 前提: AWS SSO認証済み（aws login）/ Qiitaトークン（~/.config/qiita-cli/credentials.json）

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const QIITA_DIR = path.join(os.homedir(), 'Desktop/work/qiita/public');
const S3_BUCKET = 'ryu-ki-learn-blog-assets';
const CDN_BASE = 'https://images.ryu-ki-learn.com';
const QIITA_IMG_RE = /https:\/\/qiita-image-store\.s3\.[a-z0-9-]+\.amazonaws\.com\/[^\s)"']+/g;
// mcks.log発の記事（既にsrc/content/に存在する）は移植しない
const EXCLUDE = new Set(['astro-cloudflare-blog-build']);

const slugMap = JSON.parse(fs.readFileSync(path.join(HERE, 'slug-map.json'), 'utf8'));
const tagMap = JSON.parse(fs.readFileSync(path.join(HERE, 'tag-map.json'), 'utf8'));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// フラグ直後の値を取り出す。値の書き忘れで次のフラグ（--始まり）を拾わないようガードする
function argValue(flag) {
	const idx = args.indexOf(flag);
	if (idx < 0) return null;
	const val = args[idx + 1];
	if (!val || val.startsWith('--')) {
		console.error(`${flag} の値が指定されていない`);
		process.exit(1);
	}
	return val;
}
const only = argValue('--only');
const pubDateOverride = argValue('--pub-date');
if (pubDateOverride) {
	// 形式に加えて実在する日付かを往復変換で確認する
	// （JSのDateは 2026-02-30 のような不正な日を黙って 3/2 に繰り上げるため、isNaNでは検出できない）
	const parsed = new Date(`${pubDateOverride}T00:00:00Z`);
	const valid =
		/^\d{4}-\d{2}-\d{2}$/.test(pubDateOverride) &&
		!Number.isNaN(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === pubDateOverride;
	if (!valid) {
		console.error('--pub-date は実在する日付を YYYY-MM-DD 形式で指定する');
		process.exit(1);
	}
	if (!only) {
		console.error('--pub-date は --only と併用する（一括実行では記事ごとの本公開日を区別できない）');
		process.exit(1);
	}
}

// Qiita CLIの認証情報からアクセストークンを取り出す
function qiitaToken() {
	const credPath = path.join(os.homedir(), '.config/qiita-cli/credentials.json');
	const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'));
	const entry = cred.credentials?.find((c) => c.name === cred.default) ?? cred.credentials?.[0];
	const token = entry?.accessToken;
	if (!token) throw new Error('Qiitaトークンが見つからない: ' + credPath);
	return token;
}

// frontmatter（先頭の--- ... ---）と本文に分割する
function splitFrontmatter(raw) {
	const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
	if (!m) throw new Error('frontmatterが見つからない');
	return { fm: YAML.parse(m[1]), body: raw.slice(m[0].length) };
}

// タグ変換表を適用（drop → rename → 重複排除）
function convertTags(tags) {
	const out = [];
	for (const t of tags) {
		if (tagMap.drop.includes(t)) continue;
		const renamed = tagMap.rename[t] ?? t;
		if (!out.includes(renamed)) out.push(renamed);
	}
	return out;
}

// 本文の最初の「地の文」段落からdescriptionを生成する
function makeDescription(body) {
	for (const block of body.split(/\n\s*\n/)) {
		const line = block.trim().split('\n')[0]?.trim() ?? '';
		if (!line) continue;
		if (/^(#|!\[|```|:::|\||>|<|-|\*|[0-9]+\.)/.test(line)) continue;
		if (/^https?:\/\/\S+$/.test(line)) continue;
		// インライン記法を落としてプレーンテキスト化
		const plain = block
			.replace(/\n/g, '')
			.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/[`*_]/g, '')
			.trim();
		if (plain.length < 10) continue;
		return plain.length > 90 ? plain.slice(0, 90) + '…' : plain;
	}
	return '';
}

// ISO日時（+09:00）からYYYY-MM-DDを取り出す
function toDate(iso) {
	return iso.slice(0, 10);
}

// 散発的なネットワークエラー（連続DL中の接続リセット等）に備えたリトライ付きfetch
async function fetchWithRetry(url, options, tries = 3) {
	for (let i = 1; ; i++) {
		try {
			const res = await fetch(url, options);
			if (res.ok) return res;
			throw new Error(`HTTP ${res.status}`);
		} catch (e) {
			if (i >= tries) throw new Error(`${e.message}: ${url}`);
			await new Promise((r) => setTimeout(r, 1000 * i));
		}
	}
}

async function fetchQiitaItem(id, token) {
	const res = await fetchWithRetry(`https://qiita.com/api/v2/items/${id}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	return res.json();
}

// Qiita画像をDL→S3アップし、置換済み本文を返す
async function migrateImages(body, slug, report) {
	const urls = [...new Set(body.match(QIITA_IMG_RE) ?? [])];
	if (urls.length === 0) return body;
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qiita-img-'));
	let out = body;
	for (const url of urls) {
		const filename = decodeURIComponent(new URL(url).pathname.split('/').pop());
		const newUrl = `${CDN_BASE}/${slug}/${filename}`;
		if (dryRun) {
			report.images.push(`${url} -> ${newUrl} (dry)`);
			continue;
		}
		const res = await fetchWithRetry(url);
		const tmpFile = path.join(tmpDir, filename);
		fs.writeFileSync(tmpFile, Buffer.from(await res.arrayBuffer()));
		execFileSync('aws', ['s3', 'cp', tmpFile, `s3://${S3_BUCKET}/${slug}/${filename}`, '--only-show-errors']);
		out = out.split(url).join(newUrl);
		report.images.push(`${filename} -> ${slug}/`);
	}
	fs.rmSync(tmpDir, { recursive: true, force: true });
	return out;
}

// frontmatterのYAMLを組み立てる（既存記事の見た目に合わせてtagsはflow形式）
function buildFrontmatter(fm) {
	const lines = ['---'];
	lines.push(`title: ${JSON.stringify(fm.title)}`);
	lines.push(`description: ${JSON.stringify(fm.description)}`);
	lines.push(`pubDate: ${fm.pubDate}`);
	if (fm.updatedDate) lines.push(`updatedDate: ${fm.updatedDate}`);
	lines.push(`tags: [${fm.tags.map((t) => `'${t}'`).join(', ')}]`);
	lines.push(`qiitaId: ${fm.qiitaId}`);
	lines.push(`importedDate: ${fm.importedDate}`);
	lines.push('qiitaStats:');
	lines.push(`  views: ${fm.qiitaStats.views}`);
	lines.push(`  likes: ${fm.qiitaStats.likes}`);
	lines.push(`  stocks: ${fm.qiitaStats.stocks}`);
	lines.push(`  fetchedAt: ${fm.qiitaStats.fetchedAt}`);
	lines.push('---');
	return lines.join('\n');
}

const token = qiitaToken();
const today = new Date().toISOString().slice(0, 10);
const files = fs
	.readdirSync(QIITA_DIR)
	.filter((f) => f.endsWith('.md'))
	.sort();

const summary = { done: [], skipped: [], failed: [] };

for (const file of files) {
	const base = file.replace(/\.md$/, '');
	if (only && base !== only) continue;
	const report = { images: [] };
	try {
		const raw = fs.readFileSync(path.join(QIITA_DIR, file), 'utf8');
		const { fm, body } = splitFrontmatter(raw);
		if (fm.private) {
			summary.skipped.push(`${base}（private）`);
			continue;
		}
		if (EXCLUDE.has(base)) {
			summary.skipped.push(`${base}（mcks.log発のため除外）`);
			continue;
		}
		const slug = slugMap[base];
		if (!slug) throw new Error('slug-mapに無い');

		const item = await fetchQiitaItem(fm.id, token);
		const collection = (fm.tags ?? []).includes('ポエム') ? 'stream' : 'tech';
		const pubDate = pubDateOverride ?? toDate(item.created_at);
		// 本公開日を上書きした場合、それ以前のupdated_at（限定公開中の編集や公開切替の痕跡）は捨てる
		const updatedDate = toDate(item.updated_at) > pubDate ? toDate(item.updated_at) : null;

		const newBody = await migrateImages(body, slug, report);
		const frontmatter = buildFrontmatter({
			title: fm.title,
			description: makeDescription(body),
			pubDate,
			updatedDate,
			tags: convertTags(fm.tags ?? []),
			qiitaId: fm.id,
			importedDate: today,
			qiitaStats: {
				views: item.page_views_count ?? 0,
				likes: item.likes_count ?? 0,
				stocks: item.stocks_count ?? 0,
				fetchedAt: today,
			},
		});

		const outPath = path.join(REPO, 'src/content', collection, `${slug}.md`);
		if (!dryRun) fs.writeFileSync(outPath, `${frontmatter}\n\n${newBody}`);
		summary.done.push(`${collection}/${slug}（画像${report.images.length}枚）`);
		console.log(`ok  ${collection}/${slug}  images:${report.images.length}  views:${item.page_views_count}`);
		await new Promise((r) => setTimeout(r, 150)); // Qiita APIレート配慮
	} catch (e) {
		summary.failed.push(`${base}: ${e.message}`);
		console.error(`NG  ${base}: ${e.message}`);
	}
}

// --only の打ち間違い等で1件も処理されなかった場合は成功に見せず終了コード1にする
if (only && summary.done.length + summary.skipped.length + summary.failed.length === 0) {
	console.error(`--only ${only} に一致する記事が ${QIITA_DIR} に無い`);
	process.exit(1);
}

console.log('\n=== サマリー ===');
console.log(`変換: ${summary.done.length} / スキップ: ${summary.skipped.length} / 失敗: ${summary.failed.length}`);
for (const s of summary.skipped) console.log(`  skip: ${s}`);
for (const f of summary.failed) console.log(`  fail: ${f}`);
if (dryRun) console.log('（dry-run: ファイル書き込み・画像転送は行っていない）');
