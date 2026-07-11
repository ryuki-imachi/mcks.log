---
title: "【AI-DLC】AI-DLCでSlackのメッセージを翻訳するChrome Extensionを開発してみた"
description: "前の記事でAI-DLCの概念を紹介しました。"
pubDate: 2026-04-13
tags: ['chrome-extension', 'Ollama', 'ClaudeCode', 'AI-DLC']
qiitaId: d2316d61384156ecf023
importedDate: 2026-07-11
qiitaStats:
  views: 901
  likes: 2
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

前の記事でAI-DLCの概念を紹介しました。

https://qiita.com/ryu-ki/items/a70ec13e4b622a37cd6f

AI-DLCは本来チームでの開発を想定したフレームワークで、要件定義から監査ログまでの成果物がチームメンバー間の共有・引き継ぎに活きる設計になっています。今回は個人開発ではありますが、実際にAI-DLCを使ってChrome Extensionを開発してみましたので、その体験について書きます。使用ツールはClaude Code + AI-DLCワークフローです。

## 作ったもの

Slack Translator（Slackの英語メッセージをローカルLLM（Ollama）で日本語翻訳するChrome Extension）を開発しました。こちらは外部APIには一切送信せず、完全にローカルで翻訳を行います。Slack Botが使えない環境（他者管理のワークスペース）での代替手段として開発しています。

![image.png](https://images.ryu-ki-learn.com/aidlc-slack-translator-extension/a8cf8145-4f97-487b-a8b2-3c8039c61660.png)

## セットアップ

### AI-DLCワークフローの導入

まず`awslabs/aidlc-workflows`リポジトリからルールファイルを取得し、プロジェクトに配置します。セットアップ手順の詳細はリポジトリのREADMEを参照してください。`.aidlc-rule-details/`には詳細ルールファイル群を、`CLAUDE.md`にはClaude Code用のワークフロー定義を置きます。

https://github.com/awslabs/aidlc-workflows

```text
プロジェクトルート/
├── .aidlc-rule-details/
│   ├── common/           # 共通ルール
│   ├── inception/        # Inceptionフェーズルール
│   ├── construction/     # Constructionフェーズルール
│   ├── extensions/       # 拡張ルール（セキュリティ等）
│   └── operations/       # Operationsフェーズルール
├── CLAUDE.md             # AI-DLCワークフロー定義
└── aidlc-docs/           # ← ここにAI-DLCの成果物が蓄積される
```

### 起動方法

Claude Codeに以下のようにプロンプトを送るだけでよいです。

```text
Using AI-DLC, Slack翻訳Chrome Extensionを作りたい。
AWS Community Builders SlackのメッセージをローカルLLMで翻訳する...
```

ここから「AIが質問→人間が回答」の対話が始まります。

## Phase 1: Inception（AIとの要件定義）

### Workspace Detection

AIがまずワークスペースを分析し、空のディレクトリであることからGreenfield（新規プロジェクト）と判定しました。Brownfield（既存コードがあるプロジェクト）の場合はリバースエンジニアリングが走るようです。

### Requirements Analysis（AIが質問してくる）

ここが従来の開発と最も違うところで、AIが質問を投げかけてきます。

AIが生成した質問の例を以下に示します。

```markdown:requirement-verification-questions.mdより抜粋
Q1: Slackメッセージの取得方法はどれが良いですか？
A) Slack API  B) Webスクレイピング  C) ブラウザ拡張  D) その他

Q2: 翻訳方向は？
A) 英→日のみ  B) 日→英のみ  C) 双方向

Q5: UIの形式は？
A) スタンドアロンアプリ  B) CLIツール  C) Webアプリ  D) Chrome Extension
```

選択肢形式で答えやすく、矛盾があればAIが追加質問で解消してくれます。回答をもとにAIが要件定義書（requirements.md）を自動生成してくれます。

### 人間の承認ゲート

要件定義書が出来上がったら、AIが承認を求めてきます。

```text
要件書を承認して、次のステージ（Workflow Planning）に進みますか？
```

ここで内容を確認し、修正があれば伝えます。OKなら次へ進みます。

### Workflow Planning（AIが計画を立てる）

プロジェクトの規模に応じて、どのステージを実行しどのステージをスキップするかをAIが提案してくれます。小規模なプロジェクトではUser StoriesやInfrastructure Designなどがスキップされます。

```markdown:aidlc-state.mdより抜粋
## Iteration 1: Chrome Extension 本体

### Execution Plan Summary
- **Total Stages**: 6 (to execute)
- **Stages Executed**: Application Design, Functional Design, Code Planning, Code Generation, Build and Test
- **Stages Skipped**: User Stories, Units Generation, NFR Requirements, NFR Design, Infrastructure Design
- **AIDLC ステージ**: COMPLETED
- **手動 Integration Test**: **全9シナリオ PASS** ✅
```

### Application Design

AIがアーキテクチャを設計し、コンポーネント図やサービス定義を生成しました。

```text
Chrome Extension (Manifest V3)
├── Content Script ── メッセージDOM検出・翻訳結果表示
├── Background Service Worker ── Ollama API呼び出し・キャッシュ管理
└── Popup UI ── 翻訳ON/OFF・設定・統計表示
        │
        │ HTTP (localhost:11434)
        ▼
  Ollama (ローカルLLM)
```

生成されたドキュメントは`aidlc-docs/inception/application-design/application-design.md`、`components.md`、`component-methods.md`の3ファイルです。

## Phase 2: Construction（AIが実装する）

### Functional Design

ビジネスロジックモデル、ドメインエンティティ、ビジネスルールをAIが定義し、`aidlc-docs/construction/slack-translator/functional-design/`に格納されます。

### Code Planning

AIがどのファイルに何を書くかの実装計画を提示してくれます。ファイル単位の責務分割や依存関係が整理され、次のCode Generationに向けた設計図のような役割を果たします。

### Code Generation

ここが最もインパクトのあるステージです。Code Planningで立てた計画に基づいて、AIがコードを生成してくれます。

生成されたファイル構成は次のとおりです。

```text
src/
├── background/
│   ├── ollama-client.ts        # Ollama API通信
│   ├── translation-service.ts  # 翻訳オーケストレーション
│   ├── cache-manager.ts        # キャッシュ管理
│   ├── settings-manager.ts     # 設定管理
│   └── index.ts
├── content/
│   ├── message-detector.ts     # Slackメッセージ検出
│   ├── translation-renderer.ts # 翻訳結果表示
│   └── index.ts
├── popup/
│   ├── popup-controller.ts     # ポップアップUI
│   └── index.ts
└── shared/
    ├── types.ts                # 型定義
    └── constants.ts            # 定数
```

加えてテストコードも自動生成されました。

```text
tests/
├── background/    # 各モジュールのユニットテスト
├── content/
├── popup/
└── setup.ts
```

### Build and Test

AIがビルド・テスト手順を定義し、`npm run build`でビルド、`npm run test`でテスト実行します。Iteration 1では37/37テストがPASSしました。

## イテレーションの繰り返し

AI-DLCでは問題を発見するたびに新しいイテレーション（ボルト）を回します。実際に6回のイテレーションを実施しました。

|  | 目的 | きっかけ | テスト結果 |
|---|------|---------|----------|
| 1 | Chrome Extension本体 | 初期開発 | 37/37 PASS |
| 2 | Ollamaセットアップスクリプト | 手動テストでOllama 403エラーが発生した（OllamaがデフォルトでCORSを許可しておらず、`OLLAMA_ORIGINS`環境変数でChrome Extensionのオリジンを許可する設定が必要だった） | 全7シナリオPASS |
| 3 | API /api/generate → /api/chat 移行 | thinkingモードでタイムアウト発生。チャット形式の方がsystem/user/assistantロールを扱いやすい利点もあり移行 | 37/37 PASS |
| 4 | 翻訳結果の書式保持 | 改行・箇条書きが消える問題 | 40/40 PASS |
| 5 | システムメッセージ除外 | チャンネル参加メッセージが翻訳される | 41/41 PASS |
| 6 | README充実 | READMEが3行しかなかった | - |

各イテレーションでAI-DLCの全プロセス（Inception → Construction）が走りますが、スコープが小さいものはステージのスキップが多くなり、軽量に回ります。

例えば、Iteration 3（バグ修正）の場合、Inceptionでは、Workspace Detection → Requirements Analysis → Workflow Planningのみ実行し他はスキップされ、Constructionでは、Code Generation → Build and Testのみ実行し他はスキップしました。

```markdown:aidlc-state.mdより抜粋
### Stage Progress

#### INCEPTION PHASE
- [x] Workspace Detection (COMPLETED)
- [x] Requirements Analysis (COMPLETED - Minimal depth, 質問不要)
- [x] Workflow Planning (COMPLETED)
- [ ] User Stories - SKIP (バグ修正)
- [ ] Application Design - SKIP (新規コンポーネントなし)
- [ ] Units Generation - SKIP (単一コンポーネント修正)

#### CONSTRUCTION PHASE
- [ ] Functional Design - SKIP (ビジネスロジック変更なし)
- [ ] NFR Requirements - SKIP (既存NFRで十分)
- [ ] NFR Design - SKIP
- [ ] Infrastructure Design - SKIP (インフラ変更なし)
- [x] Code Generation - COMPLETED (codex review 指摘なし、37/37 test pass)
- [x] Build and Test - COMPLETED (Scenario 17 手動テストパス)
```

## AI-DLCが生成する成果物

最終的にaidlc-docs/に蓄積された成果物は次のとおりです。

```text
aidlc-docs/
├── aidlc-state.md              # プロジェクト状態管理（全イテレーション）
├── audit.md                    # 完全な監査ログ（681行）
├── inception/
│   ├── requirements/           # 要件書（7ファイル）
│   ├── application-design/     # 設計書（5ファイル）
│   └── plans/                  # 実行計画（7ファイル）
└── construction/
    ├── slack-translator/
    │   ├── functional-design/  # 機能設計（4ファイル）
    │   └── code/               # コード生成サマリー
    ├── plans/                  # コード生成計画（6ファイル）
    └── build-and-test/         # テスト手順・結果（4ファイル）
```

### audit.md（全やり取りの記録）

特に注目すべきは`audit.md`です。ユーザーとAIの全やり取りが生のテキストで記録されます。（事前に設定されたルールにて要約することを禁止されています）

```markdown
## Workspace Detection
**Timestamp**: 2026-03-15T23:55:00Z
**User Input**: "Slack翻訳ツールを作りたい..."
**AI Response**: Workspace detection completed. Greenfield project identified.

## Requirements Analysis - Clarifying Questions
**Timestamp**: 2026-03-15T23:56:00Z
**AI Response**: Created requirement-verification-questions.md with 9 questions...
```

これにより、なぜその設計判断に至ったかのトレーサビリティが確保され、チームメンバーが後から経緯を追えるようになります。AIのセッションが切れても、監査ログから文脈を復元できる点も大きいと感じました。

## 使ってみた感想

### 良かった点

要件の抜け漏れが減りました。AIが質問形式で要件を引き出してくれるので、自分では気づかない観点をカバーできました。

ドキュメントが自動で揃う点も助かりました。要件書・設計書・テスト手順が自然に蓄積されるため、普段ドキュメントを書かない方でも成果物が残ります。

監査ログによる文脈の保存も大きいと感じました。AIセッションが途切れてもaudit.mdから再開できます。

### 注意点・課題

最初のセットアップが少し面倒な点は否めません。ルールファイルの配置やCLAUDE.mdの設定など、初回の準備が必要です。また、ドキュメントが自動で揃いますがそれなりの量のドキュメントが生成されるのが、何が何だか分かりにくくなる可能性もあるように感じました。

Operationsフェーズは現時点ではプレースホルダー的な位置づけで、まだ未成熟な印象でした。開発者として、AI中心のシステム運用をどのように進めていくべきか考えるいい機会にもなると思います。

また、AIの判断に依存する部分も大きいです。スキップすべきステージの判断や要件の解釈がAI任せになるため、人間側のレビューが重要になってきます。

## おわりに

AI-DLCは概念だけでなく、OSSのルールファイルとして実際に使えることが確認できました。Claude Codeに導入してChrome Extensionを1から開発できましたので、実用性は十分あると感じています。

「AIが質問→人間が回答→AIが実装→人間が承認」のサイクルが自然で、生成されるドキュメントが充実しているため開発の透明性も高いです。今回は個人で試しましたが、AI-DLCはチーム開発を前提に設計されているため、複数人で使うことで要件定義書や監査ログの価値がさらに発揮されると思います。

小さなプロジェクトでも「AI-DLCの流れ」を体験してみる価値はあると思いますので、ぜひ試してみてください。

ありがとうございました。
