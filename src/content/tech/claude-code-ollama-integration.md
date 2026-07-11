---
title: "【Claude Code】Claude CodeがOllamaと連携できるようになったらしい"
description: "2026/1/18 に以下のようなツイートを見かけました。"
pubDate: 2026-01-19
tags: ['Ollama', 'ClaudeCode']
qiitaId: eed90901fdd044ce7f40
importedDate: 2026-07-11
qiitaStats:
  views: 58571
  likes: 98
  stocks: 69
  fetchedAt: 2026-07-11
---

## はじめに

2026/1/18 に以下のようなツイートを見かけました。

https://x.com/ollama/status/2012434308091224534

Ollama（ローカルで LLM を実行するためのオープンソースツール）の v0.14.0 以降が Anthropic Messages API と互換になったため、GPT-OSS や Qwen3 などのモデルを Claude Code で使えるようになったとのことです。

https://ollama.com/blog/claude

この記事では、Ollama と Claude Code を連携させる方法を試してみましたので、その方法について共有いたします。

## メリット
ローカル LLM を利用できると以下のようなメリットが考えられます。

| メリット | 説明 |
|----------|------|
| 完全ローカル動作 | API キー不要、インターネット接続不要 |
| プライバシー | コードや会話がクラウドに送信されない |
| コスト削減 | API 利用料がかからない |
| Claude Code の使い勝手をそのまま | 慣れたインターフェースで別モデルを試せる |

## 前提条件
今回は以下のような環境で試してみました。

- macOS
- Claude Code がインストール済み
- Ollama v0.14.0 以降

## セットアップ手順

### 1. Ollama のインストール・バージョン確認

インストール方法は以下リンクをご参照ください。

https://ollama.com/download/mac

また、インストールできたら以下コマンドで、v0.14.0 以降であることを確認します。

```bash
ollama --version
```

### 2. Ollama を起動

```bash
ollama serve
```

### 3. モデルをダウンロード

推奨モデルをダウンロードします。

```bash
# GPT-OSS 20B（約 13GB）- コード支援向け
ollama pull gpt-oss:20b

# Qwen3 Coder（約 8GB）- コーディング特化
ollama pull qwen3-coder
```

なお、以下コマンドでダウンロード済みのモデル一覧を確認することができます。

```bash
ollama list
```

### 4. Claude Code の起動

環境変数を設定して、使用するモデルを指定します。

### 基本コマンド

```bash
ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 claude --model gpt-oss:20b
```

### 環境変数を分けて設定する場合

```bash
export ANTHROPIC_AUTH_TOKEN=ollama
export ANTHROPIC_BASE_URL=http://localhost:11434
claude --model gpt-oss:20b
```

### エイリアスを設定（おまけ）

毎回長いコマンドを打つのは面倒なので、シェルの設定ファイルにエイリアスを追加しておくと便利です。
（と、Claude Code にアドバイスいただきました）

```bash
# ~/.zshrc または ~/.bashrc に追加
alias claude-local='ANTHROPIC_AUTH_TOKEN=ollama ANTHROPIC_BASE_URL=http://localhost:11434 claude --model gpt-oss:20b'
```

```bash
# 設定を反映
source ~/.zshrc
```

```bash
# 以降は以下のコマンドで起動可能
claude-local
```

## 推奨モデル一覧

### ローカルモデル

| モデル | サイズ | 特徴 |
|--------|--------|------|
| `gpt-oss:20b` | 約 13GB | コード支援全般 |
| `qwen3-coder` | 約 8GB | コーディング特化 |

### クラウドモデル

Ollama はクラウド上で動作するモデルも提供しています。ローカル環境のスペックに依存せず、常にフルコンテキスト長で動作するのが特徴です。

筆者は使っていませんが、無料でも多少使えるようです。

https://ollama.com/cloud

| モデル | 特徴 |
|--------|------|
| `glm-4.7:cloud` | GLM 4.7 クラウド版 |
| `minimax-m2.1:cloud` | Minimax M2.1 クラウド版 |

## 注意点

- ローカルモデルは Claude 本体と比較すると性能が劣る場合あり
- GPU があると推論速度が大幅に向上
- 初回起動時はモデルのロードに時間がかかる
- 最低 64k トークン以上のコンテキスト長を持つモデルが推奨（詳細は以下ドキュメント参照）

https://docs.anthropic.com/en/docs/claude-code/troubleshooting#using-claude-code-with-custom-third-party-api-providers

## 実際に試してみる

最近ブログ執筆時には Claude Code にレビューしてもらっています。

この作業を実際にローカル LLM に実施してもらおうと思います。

### Claude Opus 4.5
以下のような感じのレビューが 3 分程度で帰って来ました。
普段使いしているものなので、まあこんなものかといった感じです。

![image.png](https://images.ryu-ki-learn.com/claude-code-ollama-integration/f5fe22fe-95db-453d-9d75-7a8224ca2428.png)

### gpt-oss:20b

いきなりタスクを実施させる前に簡単なやりとりをしてみます。

![image.png](https://images.ryu-ki-learn.com/claude-code-ollama-integration/f920b807-5248-4c05-9980-d54dd876bf65.png)

シンプルなやり取りは問題なさそうです。ただ、多少レスポンスに時間がかかっている印象ではあります。（今回の例だと 30 秒以上かかっています）

次に、ブログレビューをしてもらいます。

![image.png](https://images.ryu-ki-learn.com/claude-code-ollama-integration/4970f141-9555-4f98-b27c-1e58b323578f.png)

が、スキルの利用許可を 3 回求められたまま 10 分近くが経過してしまいました...

意外に色々なタスクが指示されているからか難しいようです。（とっても PC が暖かくなったので色々頑張ってくれているんだろうなぁとは思います）

#### （おまけ）リソース使用状況
ちなみにリソースの使用状況は以下のとおりでした。（参考値：32GB メモリ環境）

| 項目 | 使用率 | 具体値 |
|------|--------|--------|
| Ollama メモリ使用量 | 約 1.5% | 約 500MB |
| Claude Code メモリ使用量 | 約 1.9% | 約 624MB |
| 合計メモリ使用量 | 約 3.4% | 約 1.1GB |
| CPU 使用率（推論中） | 13〜24% | - |


#### （おまけ その２）
この記事を修正していると、進捗がありました。（が、結局うまくいきませんでした...）

1 点気になったところとして、Claude Code からのメッセージが英語になっていますね。

![image.png](https://images.ryu-ki-learn.com/claude-code-ollama-integration/3f9a60ef-1b56-4f46-bf39-2d7e12962a0f.png)

ちょっと気になったので、どのくらいのことならできるのか直接聞いてみました。

![スクリーンショット 2026-01-18 21.32.50.png](https://images.ryu-ki-learn.com/claude-code-ollama-integration/1f1e6741-365c-4c68-b5b6-cc5bd113096e.png)

なるほど...
いい感じに役割分担できると面白そうとは思いますね。

## まとめ

簡単ではありましたが、ローカル LLM で Claude Code を利用してみました。
モデルの性能次第では使えるような気もしています。

また面白い使い方が思いついたら試してみたいと思います。
ありがとうございました。
