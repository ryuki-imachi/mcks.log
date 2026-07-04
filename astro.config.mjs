// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkLinkCard from 'remark-link-card-plus';

// https://astro.build/config
// 日本語主体のサイトのためWebフォントは使わず、システムフォントで配信する（global.css参照）
export default defineConfig({
	site: 'https://blog.ryu-ki-learn.com',
	integrations: [mdx(), sitemap()],
	markdown: {
		// Qiitaと同様に「URLだけの行」をビルド時にリンクカード化する。
		// インラインリンク（[text](url)）は変換されない。スタイルはglobal.css参照
		remarkPlugins: [[remarkLinkCard, { shortenUrl: true, thumbnailPosition: 'right' }]],
	},
});
