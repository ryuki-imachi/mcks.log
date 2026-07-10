// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkLinkCard from 'remark-link-card-plus';
import remarkDialogue from './src/lib/remark-dialogue.mjs';
import remarkQiitaNote from './src/lib/remark-qiita-note.mjs';

// https://astro.build/config
// 日本語主体のサイトのためWebフォントは使わず、システムフォントで配信する（global.css参照）
export default defineConfig({
	site: 'https://blog.ryu-ki-learn.com',
	integrations: [mdx(), sitemap()],
	markdown: {
		// remarkLinkCard: Qiitaと同様に「URLだけの行」をビルド時にリンクカード化する。
		// インラインリンク（[text](url)）は変換されない。画像URLはカード化せず素通しする。
		// remarkQiitaNote: Qiita互換の :::note 記法（src/lib/remark-qiita-note.mjs）
		// remarkDialogue: stream対話ログ形式の @speaker: 記法（src/lib/remark-dialogue.mjs）
		// 順序が重要: リンクカードは「親がrootの段落」しか変換しないため、
		// noteで包む前にカード化を済ませる（= note内のURL行もカードになる）。
		// dialogueは発言内のURL行・:::noteも変換済みの状態で包みたいので最後
		// 見た目はいずれもglobal.css参照
		remarkPlugins: [
			[
				remarkLinkCard,
				{
					shortenUrl: true,
					thumbnailPosition: 'right',
					ignoreExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'],
				},
			],
			remarkQiitaNote,
			remarkDialogue,
		],
	},
});
