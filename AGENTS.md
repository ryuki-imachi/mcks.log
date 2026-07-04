# AGENTS.md

個人ブログ mcks.log のリポジトリ。Astro 7 + Cloudflare Workers（static assets）で https://blog.ryu-ki-learn.com として公開している。

## デプロイの仕組み

- main に push すると Workers Builds が自動で `npx astro build` → `npx wrangler deploy` を実行して本番反映される（手動デプロイ不要）
- カスタムドメイン・workers.dev無効化は wrangler.jsonc で宣言管理

## push の運用ルール（重要）

**push = 本番デプロイ**。1回のpushで約2分のビルドが走る（無料枠は月3,000分）。

- 記事の投稿・修正のpushはいつでも自由に行ってよい
- 開発作業（デザイン・機能・設定の変更）は、ローカルで `npm run build` と `npm run preview` で確認を済ませ、**意味のあるまとまり単位でpushする**。WIPのこまめなpushをしない
- 複数の小さな変更が続きそうなときは、ローカルで積んでからまとめてpushする

## 記事の書き方

- 記事は `src/content/<コレクション>/` に .md で置く。コレクションは tech / travel / others / memo（詳細はREADME）
- frontmatterのスキーマは `src/content.config.ts` が正
- `draft: true` の間は一覧・RSS・ページ生成から除外される
- Qiita互換の `:::note` / `:::note warn` / `:::note alert` 記法が使える（実装: src/lib/remark-qiita-note.mjs）
- URLだけの行はリンクカードに展開される（note内でも可、URLの前後に空行が必要）。インラインリンクと画像URLは変換されない
- 画像はリポジトリに置かず、外部CDN（images.ryu-ki-learn.com）のURLを `![説明](URL)` で参照する

## よく使うコマンド

- `npm run dev` — 開発サーバー（http://localhost:4321）。バックグラウンド起動は `astro dev --background`（`astro dev stop` / `status` / `logs` で管理）
- `npm run build` — 本番ビルド（push前の確認に必ず通す）
- `npm run preview` — ビルド結果のローカル確認
- `node scripts/generate-og.mjs` — OG画像・favicon PNGの再生成（サイト説明を変えたら実行）

## 規約

- コミットメッセージは1行の日本語でシンプルに
- デザインの方向性は「道草 × .log」（生成りの紙 + 草色 + 等幅フォントのターミナル感）。テーマはCSS変数（src/styles/global.css）で管理し、ダークモードは prefers-color-scheme で自動切替
- サイト名の由来はサイト上に書かない

## 現状のメモ

- サンプル記事（各コレクションの sample-*.md）は本運用開始時に削除する
- トップのセクション表示の改善アイデアは issue #1 で継続検討中

## Astroドキュメント

作業前に関連ガイドを参照する: https://docs.astro.build

- [ルーティング](https://docs.astro.build/en/guides/routing/)
- [Astroコンポーネント](https://docs.astro.build/en/basics/astro-components/)
- [コンテンツコレクション](https://docs.astro.build/en/guides/content-collections/)
- [スタイリング](https://docs.astro.build/en/guides/styling/)
