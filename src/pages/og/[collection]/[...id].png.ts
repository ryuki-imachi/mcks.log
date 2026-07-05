// 全コレクションの記事ぶんのOG画像をビルド時に静的生成するエンドポイント。
// URLは /og/<collection>/<id>.png（BlogPost.astroがheroImage未設定時のOGPに使う）
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgImage } from '../../../lib/og-image';

const COLLECTIONS = ['tech', 'travel', 'memo', 'stream'] as const;

export const getStaticPaths = (async () => {
	const paths = [];
	for (const collection of COLLECTIONS) {
		const posts = await getCollection(collection, ({ data }: any) => !data.draft);
		for (const post of posts) {
			paths.push({
				params: { collection, id: post.id },
				props: { title: post.data.title, pubDate: post.data.pubDate },
			});
		}
	}
	return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params, props }) => {
	const png = await renderOgImage({
		title: props.title,
		collection: params.collection!,
		pubDate: props.pubDate,
	});
	return new Response(new Uint8Array(png), {
		headers: { 'Content-Type': 'image/png' },
	});
};
