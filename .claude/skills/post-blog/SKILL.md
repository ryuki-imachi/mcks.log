---
name: post-blog
description: travel / memo / stream 記事のカジュアル投稿パイプライン（issue #8 / #3）。Discord・obsidian・リポジトリ内ファイル・会話テキストなど任意の入り口から本文を受け取り、誤字脱字の自動修正、frontmatter生成、画像のCDN同期、ビルド検証、mainへのpushまでを一括で行う。Use when the user wants to publish a casual blog post ("これ記事にして", "ブログに投稿して", "道草のスレッドを記事に"). tech記事は対象外（従来の obsidian → レビュー → Qiita フローを使う）。
user-invocable: true
argument-hint: "<入力元: Discordスレッド名 / obsidianパス / ファイルパス / 「この会話の内容」など>"
---

# post-blog

tech以外のコレクション（travel / memo / stream）の記事を、カジュアルに公開するためのパイプライン。
レビューは行わず、誤字脱字チェックだけして公開する（2026-07-05リュウキ方針、issue #8）。

## 前提

- 対象リポジトリ: `~/Desktop/work/mcks.log`（このスキルが置かれているリポジトリ）
- 画像基盤: S3 `ryu-ki-learn-blog-assets` + CloudFront `https://images.ryu-ki-learn.com`（CDK構築済み）
- AWS認証はSSO（画像がある場合のみ必要。リュウキが事前に `aws login`）
- frontmatterスキーマの正は `src/content.config.ts`
- **tech記事はこのスキルの対象外**。依頼内容が技術記事（Qiitaに載せるレベルの解説記事）に見える場合は、従来フロー（obsidian下書き → /review-blog → /qiita-publish-prep）を案内して中止する
- Xポスト文面の生成は行わない（issue #2は記事ページのシェアボタンで対応済み）

## 入り口とコレクション判定

| 入り口 | コレクション |
|---|---|
| Discord「道草」フォーラム（channel id: 1523363135128604732） | travel |
| Discord「ざっくりメモ」フォーラム（channel id: 1523364077030739990） | memo |
| Discord「チラ裏」フォーラム（channel id: 1523363137758298214） | stream |
| obsidianパス / ファイルパス / 会話テキスト | 内容から提案し、Step 5の一括確認で決定 |

- Discord由来はチャンネルからコレクションを**自動決定**する（確認不要）
- streamで本文が対話・チャットログ風の場合は `format: dialogue`（`@speaker: ` 記法、見本: `src/content/stream/dialogue-format-sample.md`）への整形を提案する

## 実行フロー

### Step 0. 事前チェック

1. 入力元に画像が含まれそうなら `aws sts get-caller-identity` で認証確認。失敗時は「`aws login` を実行してください」と伝えて中止
2. リポジトリの状態を確認する。**チェックアウトが開発作業中（別ブランチ・未コミット変更あり）のことがある**ので、その場合は作業に触れず、mainベースの一時worktreeを作ってそこで記事を追加する（記事の投稿pushはmainへ直接でOKのルール）

### Step 1. 本文の取り込み

- **Discord**: フォーラムチャンネルなので、Discord連携ツールで対象スレッドを特定（`list_threads` → スレッド名で選択、迷ったらユーザーに確認）し、`fetch_messages` でリュウキの投稿を取得。複数メッセージは投稿順に連結して本文とする。添付画像は `download_attachment` で取得し、元メッセージの位置関係を保って本文に差し込む
- **obsidian / ファイル**: そのファイルをReadする。Wikilinks（`[[...]]`）やCalloutはブログで使える形（通常リンク、`:::note`）に変換する
- **会話テキスト**: 会話中でユーザーが示した本文をそのまま使う

取り込んだ本文の**作風・構成・言い回しには手を入れない**。整形するのは記法（Markdown構文）レベルのみ。

### Step 2. 誤字脱字の自動修正

- 誤字・脱字・変換ミス**のみ**を自動修正する。文体・表現・構成には一切口を出さない・直さない
- 修正箇所は「修正前 → 修正後」の一覧として控え、Step 5の一括確認で提示する

### Step 3. slugとfrontmatterの生成

- slug: `[a-z0-9-]+` のみ。内容ベースで意味のある名前にする（タイトルの直訳は避ける）。S3の画像プレフィックスと共用し、**公開後は変更不可**（画像URLが切れるため）
- frontmatter（スキーマは `src/content.config.ts` 準拠、tagsはflow形式 `['タグ1', 'タグ2']` で既存記事の見た目に合わせる）:
  - 共通: `title` / `description`（本文の要約1文）/ `pubDate`（当日、YYYY-MM-DD）/ `tags`
  - travel: `location`（分かる場合）/ `eventUrl`（イベント参加記の場合）
  - stream: `format: dialogue`（対話ログ形式のときのみ）
  - ユーザーが「下書きで」と言った場合は `draft: true`
- 配置先: `src/content/<コレクション>/<slug>.md`

### Step 4. 画像の準備（この時点ではアップロードしない）

- ファイル名は内容が分かる英語名（例: `wakayama-castle.jpg`）にリネームする
- 長辺1600pxを超える画像は `sips -Z 1600 <file>` で縮小、HEICは `sips -s format jpeg <in> --out <out>.jpg` でJPEGに変換する
- 本文には確定後のURL `https://images.ryu-ki-learn.com/<slug>/<filename>` を `![説明](URL)` で差し込んでおく（altは内容から簡潔に）

### Step 5. 一括確認（唯一の確認ポイント）

以下をまとめて**1回だけ**提示し、OKをもらう:

1. コレクションと配置先パス（slug）
2. frontmatter全文
3. 誤字脱字の修正一覧（修正前 → 修正後）
4. 画像の同期予定（ローカルファイル → CDN URL）

修正指示があれば反映して再提示。**OKが出るまでS3アップロードもpushもしない。**

### Step 6. 公開

1. 画像を `aws s3 cp <file> s3://ryu-ki-learn-blog-assets/<slug>/<filename>` でアップロード
2. 記事ファイルを配置
3. `npm run build` で検証（frontmatterのスキーマエラーはここで検出される。失敗したら直して再実行）
4. コミット（1行日本語、例: `travel記事を追加: <タイトル>`）して **mainへ直接push**（記事の投稿pushはいつでも自由のルール）
5. 公開URL `https://blog.ryu-ki-learn.com/<コレクション>/<slug>/` を伝える（デプロイ完了まで約2分）
6. Discord入り口の場合は、元スレッドにも公開URLを返信する
