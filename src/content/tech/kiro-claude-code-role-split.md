---
title: "【Kiro】Kiro(要件定義) × Claude Code(実装) で役割分担させてみる"
description: "私は現在Claude Code（Proプラン）をWSL2環境で使って開発を行っており、快適に開発をすることができています。本日（2025年7月15日）プレビュー版が提供開始された、…"
pubDate: 2025-07-15
tags: ['AWS', 'ClaudeCode', 'Kiro']
qiitaId: b7d3ea320a872a1631bc
importedDate: 2026-07-11
qiitaStats:
  views: 33231
  likes: 86
  stocks: 88
  fetchedAt: 2026-07-11
---

## はじめに

私は現在Claude Code（Proプラン）をWSL2環境で使って開発を行っており、快適に開発をすることができています。本日（2025年7月15日）プレビュー版が提供開始された、AWS発の新しいAI IDE「Kiro」の評判を聞き、特に要件定義周りの機能（Spec）が優れているとのことで注目しています。

そこで今回は、Windows環境にKiroをインストールし、WSL2で動作しているClaude Codeと連携させることで、要件定義はKiroの得意分野に任せ、実装は慣れ親しんだClaude Codeを使うという「いいとこ取り」の開発フローを検証してみることにしました。

## 環境構成

### 現在の開発環境

```
Windows 11
├── Kiro IDE (Windows版をインストール)
└── WSL2 (Ubuntu)
    ├── Claude Code (既にインストール済み)
    └── 開発プロジェクト
```

## やりたいことの簡単なイメージ

```bash
# 1. Kiroで要件定義とスペック作成
# Kiroのチャット機能で要件を伝える
"ユーザー認証機能を持つTodoアプリを作りたい"

# 2. Kiroが自動生成
- requirements.md (要件定義書)
- design.md (技術設計書)
- tasks.md (タスクリスト)

# 3. Kiroの統合ターミナルでClaude Codeを起動
$ claude

# 4. スペックをClaude Codeに渡して実装
$ claude "design.mdに基づいてAPIを実装してください"
```

## セットアップ

### 1. Kiroのインストール（Windows）
以下から取得することができます。

https://kiro.dev/

とりあえずGoogleアカウントを使います。

![スクリーンショット 2025-07-15 180005.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/1821127b-2267-4fa5-9a0f-41d49e581cd2.png)

### 2. KiroでWSL2プロジェクトを開く
とりあえず、WSL2にはつながり、Claude Codeを使うこともできそうに見えます。

![スクリーンショット 2025-07-15 181523.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/7cbfc526-5c49-4f1d-bde4-a38bd9739fa4.png)

以下の記事を参考にさせていただきました。ありがとうございます。

https://qiita.com/revsystem/items/cb0470f3a8de2a25d71a


## Specを体験
とりあえずSpecを選択し、プロンプトを投げてどのよう感じになるか見てみましょう。今回はQRコードを生成するWebアプリを作ってみてもらいます。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/9c8a9625-2c59-47f1-87a2-286763cec831.png)

### 0. 投げたプロンプト

```md
QRコードを生成してくれるWebアプリを作りたい。
とりあえず、最初はシンプルな設計にしたい。
```

### 1. Requirements
プロンプトを渡すと、以下のようにまずは`requirements.md`が生成されました。こちらで要件定義を実施しています。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/789c3766-ef2d-4f59-9a54-2f01e0dcf74f.png)

読んでみると、ユーザーストーリーとその受け入れ基準が書かれています。

また、受け入れ基準は以下のように書かれています。

```md
#### 受け入れ基準

1. WHEN ユーザーがテキスト入力フィールドにテキストを入力する THEN システムは入力されたテキストを受け取る SHALL
2. WHEN ユーザーが「QRコード生成」ボタンをクリックする THEN システムは入力されたテキストからQRコードを生成する SHALL
3. WHEN QRコードが生成される THEN システムはQRコード画像をWebページ上に表示する SHALL
4. IF 入力フィールドが空の場合 THEN システムはエラーメッセージを表示する SHALL
```

### 2. Design
要件定義を承認すると次は`design.md`を生成します。こちらは、設計書ですね。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/efe7647d-b51a-4471-9261-9c5af20eba7b.png)

アーキテクチャやモジュール、データモデル、エラーハンドリングなどについて記載されています。

### 3. Task list
設計が承認されると、次は`tasks.md`が生成されます。こちらには、実装計画が記載されています。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/0671ecd7-6e0a-47a6-a7bd-1cb63f283b2e.png)

それぞれのタスクには、対応する要件も記載されていてわかりやすいですね。

### Specでできたドキュメント
以下のような形で3つのドキュメントが生成されました。

```md
kiro\specs\qr-code-generator
├── requirements.md
├── design.md
└── tasks.md
```

## Specで作成されたタスクを実行していく
`tasks.md`の`Start task`をクリックすることで各タスクを実行することができます。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/cc327c50-6427-4c00-94ae-1288e55b4c1f.png)

タスク実行ごとに新しいセッションが作成されるようです。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/34d9d24d-6314-4d87-8752-0c6c06fbbcec.png)

実際にクリックするとこんな感じになります。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/6dbd17fc-a682-4bcf-933a-92d304077fb5.png)

おまかんかもしれませんが、すごく改行されていますね…
（タスクはちゃんと進められている模様）

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/2520b17b-7065-4a01-90c4-b94d4f4f5d9e.png)

右上に`Update tasks`があるので随時更新をかけてもよいかもしれません。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/882a90fa-fc44-4b0d-bd32-af7dc43cb954.png)

更新をかけると勝手にTask3が起動しました…
このあたりの挙動は不安定かもしれません。

## Claude Codeに実装してもらう
以下のようにお願いすると、アプリをゴリゴリ作ってくれました。（少しエラーはありましたが）

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/9bdbfb0c-2196-4c66-b168-a8e3d8cc59de.png)

## Hookを利用してみる
以下の画像のように、KiroではHooksを自然言語から作成してくれるようです。今回は以下のようなHookを作ってみました。（WSL環境により動作確認で引っかかる可能性があるのでいったんしないようにお願いしています）

```md
Spec機能でドキュメントが完成したら、そのドキュメント群（.kiro/specs/hoge）を参照して、
`claude .kiro/specs/hogeにあるドキュメントをもとに実装して。動作確認は不要です。 --dangerously-skip-permissions`
を実行する
```

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/6cc34632-e6ed-4756-84a1-c841ecaab7e2.png)

また、作成されたHookは以下のように、`.kiro/hooks`配下に置かれるようです。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/76dff3c9-9b96-4ac8-a1e1-b0857e4e174a.png)

追加の変更で、確認対象を`tasks.md`に限定しておきます。（Specにて最後に作成されるドキュメントのため）

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/275e09a2-49be-4282-85dd-793d1ce176c4.png)

### 動作確認（簡単なサイコロアプリの作成）
新しくSpecを使い要件定義を実施したところ、要件定義が完了した時点で裏で動いてそうです。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/2316fc1a-9512-4b90-85ac-ee7a2ba1089e.png)

2か所ほどパッケージ不足などのエラーはありましたがそれっぽいものはできました。

![image.png](https://images.ryu-ki-learn.com/kiro-claude-code-role-split/8c838991-7a26-4092-a658-34ae08a711fe.png)

このような使い方の実用性はわかりませんが、技術的には、「**Kiro(要件定義) × Claude Code(実装) で役割分担させることは可能**」ということはわかりました。

## おわりに
実用性は置いておいて、Kiroと、Claude Codeうまく組み合わせることができるのでは！？と思い勢いでいろいろ試してみました。もう少しちゃんと工夫すればいい感じに使えそうな雰囲気は感じています。また時間があるときにいろいろ試してみたいと思います。
ありがとうございました。
