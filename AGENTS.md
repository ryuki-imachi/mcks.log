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
- **npmパッケージを追加・更新したら、pushする前に必ず次を実行する**（npmの既知問題で、Macでの `npm install` はLinux向けオプショナル依存をlockに書き込まないことがあり、CIの `npm ci` が落ちる。2026-07-04に2回発生）

```bash
rm -rf node_modules package-lock.json && npm install   # lockを完全再生成
rm -rf node_modules && npm clean-install               # CIと同じ手順の再現確認
npm run build
```

## 記事の書き方

- 記事は `src/content/<コレクション>/` に .md で置く。コレクションは tech / travel / others / memo（詳細はREADME）
- frontmatterのスキーマは `src/content.config.ts` が正
- `draft: true` の間は一覧・RSS・ページ生成から除外される
- Qiita互換の `:::note` / `:::note warn` / `:::note alert` 記法が使える（実装: src/lib/remark-qiita-note.mjs）
- URLだけの行はリンクカードに展開される（note内でも可、URLの前後に空行が必要）。インラインリンクと画像URLは変換されない
- ```mermaid ブロックはブラウザ側でSVGに描画される（記事ページ限定・図があるページだけmermaid.jsを遅延読み込み。実装: src/layouts/BlogPost.astro のscript）
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

## 現在の状況

最終更新: 2026-07-04

- 完了済み: サイト構築フェーズは完了。https://blog.ryu-ki-learn.com で公開中、push→自動デプロイ確立、デザイン（道草×.log）、Qiita互換の:::note記法、リンクカード、Mermaidレンダリング、4コレクション（tech/travel/others/memo）、プロフィールサイトからのリンク（準備中表記）まで済み
- 残り（本運用開始時にやること）: サンプル記事4本の削除 / プロフィールサイトの「（準備中）」表記を外す / 1本目の記事公開
- 継続検討: issues参照（#1 トップ表示改善、#2 Xポスト機能、#3 エージェントから簡単投稿できる仕組み）
- 次の一歩: 構築解説記事の執筆（このブログの1本目 + Qiita併載を想定）と、Qiita過去記事の移行
- 関連リソース: 記事の下書き・構築ログ・設計書はリポジトリ外の作業ディレクトリで管理（Discordの #garage / #記事の種 スレッドで進行）

## Astroドキュメント

作業前に関連ガイドを参照する: https://docs.astro.build

- [ルーティング](https://docs.astro.build/en/guides/routing/)
- [Astroコンポーネント](https://docs.astro.build/en/basics/astro-components/)
- [コンテンツコレクション](https://docs.astro.build/en/guides/content-collections/)
- [スタイリング](https://docs.astro.build/en/guides/styling/)
