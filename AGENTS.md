# AGENTS.md

個人ブログ mcks.log のリポジトリ。Astro 7 + Cloudflare Workers（static assets）で https://blog.ryu-ki-learn.com として公開している。

## デプロイの仕組み

- main に push すると Workers Builds が自動で `npx astro build` → `npx wrangler deploy` を実行して本番反映される（手動デプロイ不要）
- カスタムドメイン・workers.dev無効化は wrangler.jsonc で宣言管理

## push の運用ルール（重要）

**mainへのpush = 本番デプロイ**。1回のpushで約2分のビルドが走る（無料枠は月3,000分）。

- 記事の投稿・修正のpushはいつでも自由に行ってよい
- **Issue対応（機能追加・デザイン変更などの開発作業）は作業ブランチを切ってPRを出す**。mainへ直接pushしない（2026-07-05リュウキ指定）。マージはリュウキのレビュー後
- 非mainブランチのビルドは無効化済み（2026-07-11、issue #18で解決。ブランチpushでは本番に出ない）。その代わりPRにCIチェックは付かないので、push前のローカル `npm run build` が唯一の検証になる
- 開発作業は、ローカルで `npm run build` と `npm run preview` で確認を済ませ、**意味のあるまとまり単位でpushする**。WIPのこまめなpushをしない
- 複数の小さな変更が続きそうなときは、ローカルで積んでからまとめてpushする
- **npmパッケージを追加・更新したら、pushする前に必ず次を実行する**（npmの既知問題で、Macでの `npm install` はLinux向けオプショナル依存をlockに書き込まないことがあり、CIの `npm ci` が落ちる。2026-07-04に2回発生）

```bash
rm -rf node_modules package-lock.json && npm install   # lockを完全再生成
rm -rf node_modules && npm clean-install               # CIと同じ手順の再現確認
npm run build
```

## 記事の書き方

- 記事は `src/content/<コレクション>/` に .md で置く。コレクションは tech / travel / memo / stream（詳細はREADME）
- frontmatterのスキーマは `src/content.config.ts` が正
- `draft: true` の間は一覧・RSS・ページ生成から除外される
- Qiita互換の `:::note` / `:::note warn` / `:::note alert` 記法が使える（実装: src/lib/remark-qiita-note.mjs）
- streamコレクションはfrontmatterに `format: dialogue` を書くと `@speaker: ` 記法の対話ログ形式で表示される。地の文は `@note:`（記法の見本: src/content/stream/dialogue-format-sample.md、実装: src/lib/remark-dialogue.mjs、経緯: issue #12 / PR #13）
- URLだけの行はリンクカードに展開される（note内でも可、URLの前後に空行が必要）。インラインリンクと画像URLは変換されない
- ```mermaid ブロックはブラウザ側でSVGに描画される（記事ページ限定・図があるページだけmermaid.jsを遅延読み込み。実装: src/layouts/BlogPost.astro のscript）
- 画像はリポジトリに置かず、外部CDN（images.ryu-ki-learn.com）のURLを `![説明](URL)` で参照する
- 記事ごとのOG画像（SNSシェア時のサムネ）はビルド時に自動生成される（`/og/<コレクション>/<id>.png`、実装: src/lib/og-image.ts + src/pages/og/）。frontmatterで `heroImage` を設定した記事はそちらが優先。記事以外のページはサイト共通の og-default.png
- tech以外（travel / memo / stream）のカジュアル投稿は `/post-blog` スキルで行える。Discord（道草/ざっくりメモ/チラ裏）・obsidian・会話テキストなど任意の入り口から、誤字脱字の自動修正→一括確認→mainへのpushまでを一括実行する（実装: .claude/skills/post-blog/SKILL.md、経緯: issue #8）

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

最終更新: 2026-07-11（Qiita一括移植、ページネーション、Web Analytics、記事検索、Xシェアボタン、カジュアル投稿スキル）

- 完了済み: サイト構築フェーズ完了、本運用開始。機能はpush→自動デプロイ、Qiita互換:::note記法、リンクカード、Mermaidレンダリング、4コレクション（tech/travel/memo/stream。旧othersを2026-07-05にstreamへリネーム）、スクロール追従サイド目次（1120px以上のみ表示）、記事内画像の枠線（色は --img-frame で管理）、記事別OG画像のビルド時自動生成（PR #6、詳細は「記事の書き方」参照）、stream対話ログ形式（format: dialogue、@speaker:記法。issue #12 / PR #13、詳細は「記事の書き方」参照。デザイン経緯と改善余地はissue #12に記録）、**Qiita過去記事の一括移植完了（issue #16 / PR #17、2026-07-11）**: 116本（tech 108 / stream 8）、画像337枚を自CDNへ移行、スクリプトは scripts/qiita-migration/（未公開4本はQiita側で公開後に `--only <basename>` で個別移植する）、**一覧のページネーション（issue #19 / PR #20、2026-07-11）**: 1ページ20件、Qiita/Zenn風の数字並び+現在ページ円形塗り、10ページ以上で省略記号（実装: src/components/Pagination.astro + 各 [...page].astro）、**Cloudflare Web Analytics導入（issue #15 / PR #21、2026-07-11）**: BaseHead.astroにビーコンタグ、閲覧状況はCloudflareダッシュボードで見る、**記事検索（issue #14 / PR #22、2026-07-11）**: 全コレクション横断の全文検索。ビルド時にsearch-index.parquetを生成（src/integrations/search-index.mjs）し、DuckDB Wasm（セルフホスト同梱・遅延ロード）がブラウザでSQL検索。一覧4ページ+トップの検索窓、日付降順、ヒット語ハイライト+本文スニペット付き（実装: src/lib/search-client.ts / src/components/SearchBox.astro）、**Xシェアボタン（issue #2 / PR #23、2026-07-11）**: 記事ページ本文末尾にWeb Intentリンク（タイトル+URL+#mckslog、API・JS不要。実装: src/components/ShareOnX.astro）、**カジュアル投稿スキル /post-blog（issue #8 / #3 / PR #24、2026-07-11）**: tech以外の投稿パイプライン（詳細は「記事の書き方」参照）
- 継続検討: issues参照（#1 トップ表示改善、#4 検索エンジン未インデックス、#10 記事ページ本文の可変幅レイアウト）
- 次の一歩: stream対話ログ形式での1本目の記事を /post-blog スキルで投稿（題材候補: CB特典クレジットの使い道）、issue #10 への着手
- 運用メモ: Issue対応はブランチ+PR（「pushの運用ルール」参照）
- 関連リソース: 記事の下書き・構築ログ・設計書はリポジトリ外の作業ディレクトリで管理（Discordの #garage / #記事の種 スレッドで進行）

## Astroドキュメント

作業前に関連ガイドを参照する: https://docs.astro.build

- [ルーティング](https://docs.astro.build/en/guides/routing/)
- [Astroコンポーネント](https://docs.astro.build/en/basics/astro-components/)
- [コンテンツコレクション](https://docs.astro.build/en/guides/content-collections/)
- [スタイリング](https://docs.astro.build/en/guides/styling/)
