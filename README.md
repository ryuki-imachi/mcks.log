# mcks.log

個人ブログ mcks.log の記事とサイト本体を管理するリポジトリです。

- サイト: https://blog.ryu-ki-learn.com

## 構成

| 要素 | 採用 |
| :--- | :--- |
| フレームワーク | [Astro](https://astro.build/) 7（静的出力、アダプター不使用） |
| ホスティング | Cloudflare Workers（static assets） |
| CI/CD | Workers Builds（mainへのpushで自動ビルド・デプロイ） |
| 記事画像 | 外部CDN（images.ryu-ki-learn.com）を参照。リポジトリには置かない |
| アクセス解析 | Cloudflare Web Analytics（`BaseHead.astro` のビーコン、閲覧はCloudflareダッシュボード） |

## デプロイ

GitHubのmainブランチへpushすると、Workers Buildsが `npx astro build` → `npx wrangler deploy` を自動実行して本番に反映されます。手動デプロイは不要です。

カスタムドメイン（blog.ryu-ki-learn.com）とworkers.devの無効化は `wrangler.jsonc` で宣言しており、デプロイ時にDNSレコード・TLS証明書まで自動で構成されます。

## コンテンツ

記事は `src/content/` 配下の4コレクションで管理しています。

| コレクション | URL | 内容 |
| :--- | :--- | :--- |
| `tech` | `/tech/` | 技術記事（Qiitaからの移行分を含む） |
| `travel` | `/travel/` | 旅の記録（国内旅行・JAWS-UG各支部巡り） |
| `memo` | `/memo/` | 技術メモ・調査メモ（記事にするほどではない小ネタ） |
| `stream` | `/stream/` | 考えごとの垂れ流し |

各コレクションに一覧・記事ページ・RSS（`/tech/rss.xml` など）があり、サイト全体のRSSは `/rss.xml` です。一覧は1ページ20件でページ分けされます（`src/components/Pagination.astro`、10ページ以上で省略記号表示）。

### 記事検索

一覧ページとトップの検索窓から、全コレクション横断の全文検索ができます（タイトル・タグ・本文。スペース区切りでAND検索）。仕組みはビルド時に全記事を `search-index.parquet` に書き出し（`src/integrations/search-index.mjs`）、ブラウザ上のDuckDB Wasmが直接SQLで検索するサーバーレス構成です。エンジン本体は検索窓に触れたときだけ遅延ロードされます（`src/lib/search-client.ts` / `src/components/SearchBox.astro`）。

### frontmatter

```yaml
# 共通
title: 記事タイトル
description: 一覧やOGPに使う説明文
pubDate: 2026-07-04
tags: [aws, astro]   # 省略可（既定: []）
draft: true          # 省略可（既定: false）。trueの間は一覧・RSS・ページ生成から除外

# tech / stream 共通（Qiita移行記事にだけ付く。すべて省略可）
qiitaId: xxxxxxxx            # Qiita記事の元ID
importedDate: 2026-07-11     # mcks.logへ移植した日
qiitaStats:                  # 移植時点のスナップショット（表示しない内部データ）
  views: 12345
  likes: 42
  stocks: 30
  fetchedAt: 2026-07-11

# travel のみ
location: 佐渡ヶ島            # 省略可
eventUrl: https://...        # イベントのconnpass等（省略可）

# stream のみ
format: dialogue             # 省略可（既定: plain）。対話ログ形式で表示する
```

スキーマ定義の実体は `src/content.config.ts` にあります。

### リンクカード

Qiitaと同様に、本文中でURLだけの行を書くとビルド時にリンクカードへ展開されます（[remark-link-card-plus](https://github.com/okaryo/remark-link-card-plus) を使用）。`[テキスト](URL)` 形式のインラインリンクと画像URL（.png/.jpg等）は変換されません。

### noteボックス

Qiita互換の `:::note` 記法が使えます（自作プラグイン `src/lib/remark-qiita-note.mjs`）。

```
:::note
補足やメモ（info、既定）
:::

:::note warn
注意
:::

:::note alert
重要な警告
:::
```

### 対話ログ形式（stream）

streamの記事はfrontmatterに `format: dialogue` を書くと、`@speaker: ` で始まる段落を発言として表示する対話ログ形式になります（自作プラグイン `src/lib/remark-dialogue.mjs`）。

```
導入文（最初の発言より前は通常のMarkdown）。

@ryuki: 発言はこう書く。次の発言行までが1つの発言になる。

複数の段落やコードブロック・箇条書きも同じ発言に含められる。

@note: 対話の合間に挟む地の文（ナレーション）はこれ。
```

記法の見本は `src/content/stream/dialogue-format-sample.md`（draft）にあります。

### Mermaid図

` ```mermaid ` のコードブロックは、記事ページでブラウザ側でSVGに描画されます（図があるページだけmermaid.jsを遅延読み込み。実装は `src/layouts/BlogPost.astro`）。

### 目次

記事本文のh2/h3から自動生成され、幅1120px以上の画面で記事の右側に表示されます（スクロール追従・現在地ハイライト）。記事側での作業は不要です。

### 画像

記事画像はリポジトリに置かず、外部CDNのURLを `![説明](https://images.ryu-ki-learn.com/...)` の形で参照します。

記事ページでは本文の画像に薄い枠線が自動で付きます（色は `src/styles/global.css` の `--img-frame` で管理）。

## ディレクトリ

```text
├── public/                  favicon・OG画像などの静的ファイル
├── scripts/
│   ├── generate-og.mjs      OG画像とfavicon PNGの生成（sharp）
│   └── qiita-migration/     Qiita記事の一括移植スクリプト一式（実行方法はmigrate.mjs冒頭を参照）
├── src/
│   ├── components/          共通部品（PostList = ログ行風の記事一覧、TableOfContents = サイド目次 など）
│   ├── consts.ts            サイト名・セクション定義
│   ├── content/             記事本体（tech / travel / memo / stream）
│   ├── content.config.ts    コレクションとfrontmatterスキーマの定義
│   ├── integrations/        自作integration（search-index = 検索インデックス生成）
│   ├── lib/                 remarkプラグイン・検索クライアント・OG画像生成
│   ├── layouts/             記事ページのレイアウト
│   ├── pages/               ルーティング（各コレクションの一覧・詳細・RSS）
│   └── styles/global.css    テーマ（CSS変数・ダークモード・リンクカード）
├── astro.config.mjs         Astro設定（remarkプラグイン含む）
└── wrangler.jsonc           Cloudflare Workers の設定（カスタムドメイン等）
```

## コマンド

| コマンド | 動作 |
| :--- | :--- |
| `npm install` | 依存のインストール |
| `npm run dev` | 開発サーバー（ http://localhost:4321 ） |
| `npm run build` | `./dist/` に本番ビルド |
| `npm run preview` | ビルド結果のローカル確認 |
| `node scripts/generate-og.mjs` | OG画像・faviconの再生成 |
