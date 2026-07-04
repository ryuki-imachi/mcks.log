# mcks.log

個人ブログ mcks.log の記事とサイト本体を管理するリポジトリです。

- サイト: https://blog.ryu-ki-learn.com （公開準備中）
- サイト名の由来は「道草（michikusa）」の子音縮約です

## 構成

| 要素 | 採用 |
| :--- | :--- |
| フレームワーク | [Astro](https://astro.build/) 7（静的出力、アダプター不使用） |
| ホスティング | Cloudflare Workers（static assets） |
| 記事画像 | 外部CDN（images.ryu-ki-learn.com）を参照。リポジトリには置かない |

## コンテンツ

記事は `src/content/` 配下の3コレクションで管理しています。

| コレクション | URL | 内容 |
| :--- | :--- | :--- |
| `tech` | `/tech/` | 技術記事（Qiitaからの移行分を含む） |
| `travel` | `/travel/` | 旅の記録（国内旅行・JAWS地方支部巡り） |
| `others` | `/others/` | 上記に収まらないあれこれ |

各コレクションに一覧・記事ページ・RSS（`/tech/rss.xml` など）があり、サイト全体のRSSは `/rss.xml` です。

### frontmatter

```yaml
# 共通
title: 記事タイトル
description: 一覧やOGPに使う説明文
pubDate: 2026-07-04
tags: [aws, astro]   # 省略可（既定: []）
draft: true          # 省略可（既定: false）。trueの間は一覧・RSS・ページ生成から除外

# tech のみ
qiitaId: xxxxxxxx    # Qiita移行記事の元ID（省略可）

# travel のみ
location: 佐渡ヶ島            # 省略可
eventUrl: https://...        # イベントのconnpass等（省略可）
```

スキーマ定義の実体は `src/content.config.ts` にあります。

## ディレクトリ

```text
├── public/                  favicon等の静的ファイル
├── src/
│   ├── components/          共通部品（PostList = 記事一覧 など）
│   ├── content/             記事本体（tech / travel / others）
│   ├── content.config.ts    コレクションとfrontmatterスキーマの定義
│   ├── layouts/             記事ページのレイアウト
│   └── pages/               ルーティング（各コレクションの一覧・詳細・RSS）
├── astro.config.mjs
└── wrangler.jsonc           Cloudflare Workers の設定
```

## コマンド

| コマンド | 動作 |
| :--- | :--- |
| `npm install` | 依存のインストール |
| `npm run dev` | 開発サーバー（ http://localhost:4321 ） |
| `npm run build` | `./dist/` に本番ビルド |
| `npm run preview` | ビルド結果のローカル確認 |
| `npx wrangler deploy` | Cloudflare Workers へデプロイ（ビルド後） |
