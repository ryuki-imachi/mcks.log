import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 全コレクション共通のfrontmatterスキーマ
const baseSchema = ({ image }: any) =>
	z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.optional(image()),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
	});

// Qiita移行記事用の共通フィールド（issue #16）。qiitaStatsは移植時点のスナップショットで表示しない内部データ
const qiitaFields = {
	qiitaId: z.string().optional(),
	importedDate: z.coerce.date().optional(),
	qiitaStats: z
		.object({
			views: z.number(),
			likes: z.number(),
			stocks: z.number(),
			fetchedAt: z.coerce.date(),
		})
		.optional(),
};

// 技術記事（Qiita移行分を含む）
const tech = defineCollection({
	loader: glob({ base: './src/content/tech', pattern: '**/*.{md,mdx}' }),
	schema: (ctx: any) => baseSchema(ctx).extend(qiitaFields),
});

// 旅の記録（国内旅行・JAWS地方支部巡り）
const travel = defineCollection({
	loader: glob({ base: './src/content/travel', pattern: '**/*.{md,mdx}' }),
	schema: (ctx: any) =>
		baseSchema(ctx).extend({
			location: z.string().optional(),
			eventUrl: z.string().optional(),
		}),
});

// 技術メモ・調査メモ（techにするほどではない小ネタ）
const memo = defineCollection({
	loader: glob({ base: './src/content/memo', pattern: '**/*.{md,mdx}' }),
	schema: baseSchema,
});

// 考えごとの垂れ流し
const stream = defineCollection({
	loader: glob({ base: './src/content/stream', pattern: '**/*.{md,mdx}' }),
	schema: (ctx: any) =>
		baseSchema(ctx).extend({
			// dialogue にすると @speaker: 記法の対話ログ形式で表示される（src/lib/remark-dialogue.mjs）
			format: z.enum(['plain', 'dialogue']).default('plain'),
			...qiitaFields,
		}),
});

export const collections = { tech, memo, travel, stream };
