---
title: "【Claude Code】突然「command not found」になった"
description: "Claude Codeを使用していたところ、突然以下のエラーが発生するようになりました。"
pubDate: 2025-07-13
tags: ['トラブルシューティング', 'Claude', 'ClaudeCode']
qiitaId: 4824d2fe17a98f20a231
importedDate: 2026-07-11
qiitaStats:
  views: 23669
  likes: 49
  stocks: 12
  fetchedAt: 2026-07-11
---

## はじめに
ちょっとしたエラーに直面し、少し格闘したのでその備忘を残しておきたいと思います。

## 問題の概要

Claude Codeを使用していたところ、突然以下のエラーが発生するようになりました。

```bash
$ claude --version
claude: command not found
```

以前は正常に動作していたのに、急に使えなくなってしまった状況です。

## 環境

- OS：Windows11（WSL2 - Ubuntu 24.04.2 LTS）
- Node.js：v22.14.0
- npm：グローバルインストール
- Claude Code：1.0.51

## 原因の調査

### 1. 履歴の確認

まず、以前のインストール履歴を確認します。

```bash
$ history | grep claude
```

履歴から、以前は正常に動作していたことが確認できました。

### 2. インストール状況の確認

```bash
$ npm list -g @anthropic-ai/claude-code
/home/user/.nvm/versions/node/v22.14.0/lib
└── @anthropic-ai/claude-code@
```

パッケージはインストールされているようです。

### 3. 実行ファイルの確認

```bash
$ ls -la $(npm config get prefix)/bin/ | grep claude
lrwxrwxrwx 1 user user 52 Jul  5 23:19 .claude-aCPYNhzV -> ../lib/node_modules/@anthropic-ai/claude-code/cli.js
```

シンボリックリンクの名前が`.claude-aCPYNhzV`になっており、`claude`という名前のリンクが存在しませんでした。（通常であれば`claude -> ../lib/node_modules/@anthropic-ai/claude-code/cli.js`のようなリンクがあるはず）

### 4. 実際のファイルの確認

```bash
$ ls -la $(npm config get prefix)/lib/node_modules/@anthropic-ai/claude-code/cli.js
ls: cannot access '/home/user/.nvm/versions/node/v22.14.0/lib/node_modules/@anthropic-ai/claude-code/cli.js': No such file or directory
```

見てみると、実際の`cli.js`ファイルが存在しないことがわかりました。

## 根本原因

調査の結果、以下の問題が判明しました。

1. パッケージディレクトリには`cli.js`ファイルが存在しない
2. `.claude-code-CvXnoBT1`という一時ディレクトリが残っている
3. 一時ディレクトリが原因でアンインストールが失敗する

```bash
$ npm uninstall -g @anthropic-ai/claude-code
npm error code ENOTEMPTY
npm error syscall rename
npm error path /home/user/.nvm/versions/node/v22.14.0/lib/node_modules/@anthropic-ai/claude-code
npm error dest /home/user/.nvm/versions/node/v22.14.0/lib/node_modules/@anthropic-ai/.claude-code-CvXnoBT1
npm error errno -39
npm error ENOTEMPTY: directory not empty
```

## 解決方法
中途半端に残っているものをきれいにして、再インストールします。

### Step 1：手動でディレクトリを削除

npmでのアンインストールが失敗するため、手動で削除します。

```bash
# Claude Codeのディレクトリを強制削除
sudo rm -rf $(npm config get prefix)/lib/node_modules/@anthropic-ai/claude-code

# 一時ディレクトリも削除
sudo rm -rf $(npm config get prefix)/lib/node_modules/@anthropic-ai/.claude-code-*
```

### Step 2：シンボリックリンクを削除

```bash
# 壊れたシンボリックリンクを削除
rm -f $(npm config get prefix)/bin/claude
rm -f $(npm config get prefix)/bin/.claude-*
```

### Step 3：削除確認

```bash
# ディレクトリが削除されたか確認
ls -la $(npm config get prefix)/lib/node_modules/@anthropic-ai/

# シンボリックリンクが削除されたか確認
ls -la $(npm config get prefix)/bin/ | grep claude
```

### Step 4：npmキャッシュをクリア

```bash
npm cache clean --force
```

### Step 5：再インストール

```bash
npm install -g @anthropic-ai/claude-code
```

### Step 6：動作確認

```bash
# インストール内容を確認
ls -la $(npm config get prefix)/lib/node_modules/@anthropic-ai/claude-code/

# 動作確認
claude --version
```

#### 成功例

正常にインストールされると、以下のような出力が得られます。

```bash
$ ls -la $(npm config get prefix)/lib/node_modules/@anthropic-ai/claude-code/
total 7652
drwxr-xr-x 4 user user    4096 Jul 13 14:16 .
drwxr-xr-x 3 user user    4096 Jul 13 14:16 ..
-rw-r--r-- 1 user user     150 Jul 13 14:16 LICENSE.md
-rw-r--r-- 1 user user    2272 Jul 13 14:16 README.md
-rwxr-xr-x 1 user user 7698544 Jul 13 14:16 cli.js  # ← 重要：このファイルが存在する
drwxr-xr-x 3 user user    4096 Jul 13 14:16 node_modules
-rw-r--r-- 1 user user    1153 Jul 13 14:16 package.json
-rw-r--r-- 1 user user    3251 Jul 13 14:16 sdk.d.ts
-rw-r--r-- 1 user user    9119 Jul 13 14:16 sdk.mjs
drwxr-xr-x 4 user user    4096 Jul 13 14:16 vendor
-rw-r--r-- 1 user user   88658 Jul 13 14:16 yoga.wasm

$ claude --version
1.0.51 (Claude Code)
```

## おわりに
最終的には、残存ファイルをきれいにして再インストールすることで解決しましたが、結局なぜこのようなことになったのかのきっかけはわかりませんでした。また時間があるときに調べたいと思います。
ありがとうございました。
