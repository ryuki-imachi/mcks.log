// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkLinkCard from 'remark-link-card-plus';
import remarkQiitaNote from './src/lib/remark-qiita-note.mjs';

// https://astro.build/config
// 日本語主体のサイトのためWebフォントは使わず、システムフォントで配信する（global.css参照）
export default defineConfig({
	site: 'https://blog.ryu-ki-learn.com',
	integrations: [mdx(), sitemap()],
	markdown: {
		// remarkQiitaNote: Qiita互換の :::note 記法（src/lib/remark-qiita-note.mjs）
		// remarkLinkCard: Qiitaと同様に「URLだけの行」をビルド時にリンクカード化する。
		// インラインリンク（[text](url)）は変換されない。画像URLはカード化せず素通しする。
		// 見た目はどちらもglobal.css参照
		remarkPlugins: [
			remarkQiitaNote,
			[
				remarkLinkCard,
				{
					shortenUrl: true,
					thumbnailPosition: 'right',
					ignoreExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'],
				},
			],
		],
	},
});
