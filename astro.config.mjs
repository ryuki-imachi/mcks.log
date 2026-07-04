// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
// 日本語主体のサイトのためWebフォントは使わず、システムフォントで配信する（global.css参照）
export default defineConfig({
	site: 'https://blog.ryu-ki-learn.com',
	integrations: [mdx(), sitemap()],
});
