import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

// 全コレクション横断のRSS
export async function GET(context) {
	const [tech, memo, travel, stream] = await Promise.all([
		getCollection('tech'),
		getCollection('memo'),
		getCollection('travel'),
		getCollection('stream'),
	]);
	const posts = [...tech, ...memo, ...travel, ...stream]
		.filter((post) => !post.data.draft)
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/${post.collection}/${post.id}/`,
		})),
	});
}
