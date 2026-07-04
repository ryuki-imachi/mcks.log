// サイト共通のOG画像(public/og-default.png)とfaviconのPNG版(public/favicon.png)を生成する。
// 実行: node scripts/generate-og.mjs
// SVGのテキスト描画にシステムフォントを使うため、生成物はコミットして配布する運用。
import sharp from 'sharp';

const og = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#faf9f4"/>
  <rect y="614" width="1200" height="16" fill="#4a7c59"/>
  <text x="600" y="330" font-family="Menlo, Consolas, monospace" font-size="130" font-weight="bold"
        fill="#211f19" text-anchor="middle">mcks.log</text>
  <rect x="928" y="228" width="34" height="104" fill="#4a7c59"/>
  <text x="600" y="430" font-family="Hiragino Sans, Noto Sans JP, sans-serif" font-size="38"
        fill="#8b8678" text-anchor="middle">予定通り、フラフラしています。</text>
  <text x="600" y="560" font-family="Menlo, Consolas, monospace" font-size="26"
        fill="#8b8678" text-anchor="middle">blog.ryu-ki-learn.com</text>
</svg>`;

await sharp(Buffer.from(og)).png().toFile('public/og-default.png');
console.log('generated public/og-default.png');

await sharp('public/favicon.svg').resize(64, 64).png().toFile('public/favicon.png');
console.log('generated public/favicon.png');
