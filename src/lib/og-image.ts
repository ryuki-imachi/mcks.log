// 記事ごとのOG画像(1200x630)をビルド時に生成するレンダラー。
// satoriがテキストをパス化したSVGを作り、sharpでPNGに変換する。
// フォントはsrc/assets/og-fonts/に同梱（ビルド時のみ使用、配信はしない）。
// 形はQiita/Zenn風（色付き背景 + 角丸カード + タイトル + 下段にサイト名）、配色はサイトのライトテーマ。
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

// global.cssのライトテーマと同じ配色（OG画像は常にライト固定）
const CARD_BG = '#faf9f4';
const INK_STRONG = '#211f19';
const MUTED = '#8b8678';
const ACCENT = '#4a7c59';
const SECTION_COLORS: Record<string, string> = {
	tech: '#4a7c59',
	memo: '#567d84',
	travel: '#b0713f',
	stream: '#6b7aa1',
};

// 背景はセクション色に生成りを25%混ぜた薄めの単色（2026-07-05リュウキ選定）
const BG_LIGHTEN_RATIO = 0.25;

// セクション色に生成り(#faf9f4)を混ぜて薄くする
function lighten(hex: string, ratio: number): string {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
	const cream = [250, 249, 244];
	return `#${[r, g, b]
		.map((v, i) => Math.round(v * (1 - ratio) + cream[i] * ratio))
		.map((v) => v.toString(16).padStart(2, '0'))
		.join('')}`;
}

const FONT_DIR = path.resolve('./src/assets/og-fonts');

type Font = { name: string; data: Buffer; weight: 400 | 700; style: 'normal' };
let fontsCache: Promise<Font[]> | null = null;

function loadFonts(): Promise<Font[]> {
	fontsCache ??= Promise.all([
		readFile(path.join(FONT_DIR, 'NotoSansJP-Bold.ttf')).then(
			(data): Font => ({ name: 'Noto Sans JP', data, weight: 700, style: 'normal' })
		),
		readFile(path.join(FONT_DIR, 'NotoSansMono-Regular.ttf')).then(
			(data): Font => ({ name: 'Noto Sans Mono', data, weight: 400, style: 'normal' })
		),
		readFile(path.join(FONT_DIR, 'NotoSansMono-Bold.ttf')).then(
			(data): Font => ({ name: 'Noto Sans Mono', data, weight: 700, style: 'normal' })
		),
	]);
	return fontsCache;
}

// satoriはJSXなしだと {type, props} のオブジェクトツリーを受け取る
function el(type: string, style: Record<string, unknown>, children?: unknown) {
	return { type, props: { style, children } };
}

export interface OgImageInput {
	title: string;
	collection: string;
	pubDate: Date;
}

export async function renderOgImage({ title, collection, pubDate }: OgImageInput): Promise<Buffer> {
	const fonts = await loadFonts();
	const sectionColor = SECTION_COLORS[collection] ?? ACCENT;
	const date = pubDate.toISOString().slice(0, 10);
	// 長いタイトルは少し縮めて3行に収める（あふれた分はlineClampで省略）
	const titleSize = title.length > 44 ? 50 : 58;

	const tree = el(
		'div',
		{
			display: 'flex',
			width: '100%',
			height: '100%',
			padding: '44px',
			backgroundColor: lighten(sectionColor, BG_LIGHTEN_RATIO),
			fontFamily: 'Noto Sans JP',
		},
		// 角丸カード
		el(
			'div',
			{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				flexGrow: 1,
				backgroundColor: CARD_BG,
				borderRadius: 28,
				padding: '56px 60px 48px 60px',
				boxShadow: '0 10px 36px rgba(33, 31, 25, 0.25)',
			},
			[
				// タイトル（最大3行）
				el(
					'div',
					{
						display: 'block',
						lineClamp: 3,
						fontSize: titleSize,
						fontWeight: 700,
						color: INK_STRONG,
						lineHeight: 1.45,
					},
					title
				),
				// 下段: サイト名(カーソル付き) / セクションバッジ + 日付
				el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
					el('div', { display: 'flex', alignItems: 'center' }, [
						el(
							'div',
							{
								display: 'flex',
								fontFamily: 'Noto Sans Mono',
								fontSize: 40,
								fontWeight: 700,
								color: INK_STRONG,
							},
							'mcks.log'
						),
						el('div', {
							display: 'flex',
							width: 12,
							height: 32,
							backgroundColor: ACCENT,
							marginLeft: 8,
						}),
					]),
					el('div', { display: 'flex', alignItems: 'center' }, [
						el(
							'div',
							{
								display: 'flex',
								fontFamily: 'Noto Sans Mono',
								fontSize: 25,
								color: sectionColor,
								border: `2px solid ${sectionColor}`,
								borderRadius: 999,
								padding: '2px 24px',
							},
							collection
						),
						el(
							'div',
							{
								display: 'flex',
								fontFamily: 'Noto Sans Mono',
								fontSize: 25,
								color: MUTED,
								marginLeft: 24,
							},
							date
						),
					]),
				]),
			]
		)
	);

	const svg = await satori(tree as any, { width: 1200, height: 630, fonts });
	return sharp(Buffer.from(svg)).png().toBuffer();
}
