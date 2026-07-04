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

// 技術記事（Qiita移行分を含む）
const tech = defineCollection({
	loader: glob({ base: './src/content/tech', pattern: '**/*.{md,mdx}' }),
	schema: (ctx: any) =>
		baseSchema(ctx).extend({
			qiitaId: z.string().optional(),
		}),
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

// 考えの垂れ流し
const others = defineCollection({
	loader: glob({ base: './src/content/others', pattern: '**/*.{md,mdx}' }),
	schema: baseSchema,
});

export const collections = { tech, travel, others };
