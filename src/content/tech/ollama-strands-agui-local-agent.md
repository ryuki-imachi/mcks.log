---
title: "【AIエージェント】Ollama + Strands Agents + AG-UI を使ってローカルでちゃんと作ってみる"
description: "Amazon Bedrock AgentCore をはじめとしたマネージドなエージェント実行環境が注目を集めており、AIエージェント開発が活発化しています。"
pubDate: 2025-12-18
updatedDate: 2025-12-23
tags: ['Ollama', 'AIエージェント', 'AG-UI', 'StrandsAgents']
qiitaId: 22597a96a394f9fed8f2
importedDate: 2026-07-11
qiitaStats:
  views: 2564
  likes: 6
  stocks: 4
  fetchedAt: 2026-07-11
---

## はじめに

Amazon Bedrock AgentCore をはじめとしたマネージドなエージェント実行環境が注目を集めており、AIエージェント開発が活発化しています。

そんな中、自分自身はローカルでAIエージェントをきちんと作った経験がなかったため、**Ollama + Strands Agents +AG-UI** を組み合わせて、AgentCore的なアーキテクチャをローカル環境で構築しました。

本記事ではそちらについて共有します。

以下がリポジトリです。

https://github.com/ryuki-imachi/agentcore-local

:::note warn
本リポジトリは Claude Code で作成しました。動作確認は行っていますが、筆者の知識不足により、実装方法が不適切な場合やより良い方法がある可能性があります。
:::

また、以下のリポジトリを参考にしました。

https://github.com/CopilotKit/with-strands-python

## 構成

以下3つのコンテナで構成されています。

- UI：フロント部分 / AG-UI を利用
- Agent：Strands SDKによるエージェント実行
- Ollama：ローカルLLM（qwen3:8b）
```md
┌─────────────────────────────────────────────────────┐
│  Docker Compose                                     │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  │ UI       │    │ Agent    │    │ Ollama   │       │
│  │ Next.js  │──▶│ Strands  │──▶│ qwen3:8b │       │
│  │ Copilot  │    │ FastAPI  │    │          │       │
│  │ :3000    │    │ :8000    │    │ :11434   │       │
│  └──────────┘    └────┬─────┘    └──────────┘       │
│                       │                             │
│                  ┌────▼─────┐                       │
│                  │ SQLite   │                       │
│                  │ (会話履歴)│                       │
│                  └──────────┘                       │
└─────────────────────────────────────────────────────┘
```

### 参考

https://docs.ag-ui.com/introduction

https://strandsagents.com/latest/

https://ollama.com/

## セットアップ

### Step 1: リポジトリのクローン
```bash
git clone https://github.com/ryuki-imachi/agentcore-local.git
cd agentcore-local
```

### Step 2: コンテナ起動
```bash
docker compose up -d
```

### Step 3: モデルのダウンロード（初回のみ）
```bash
docker compose exec ollama ollama pull qwen3:8b
```

これだけで `http://localhost:3000` にアクセスすれば、チャットUIが使えます。

※モデルについてはお好きなものをご利用ください。Ollama で利用可能なモデルは以下をご覧ください。

https://ollama.com/search

## 実装について

AG-UI に関する実装について簡単に紹介します。

### AG-UI対応のエージェント実装

`ag-ui-strands` を使うことで、Strands AgentをAG-UIプロトコルに対応させています。
```py
from ag_ui_strands import StrandsAgent, create_strands_app
from strands import Agent
from strands.models.ollama import OllamaModel
from strands_tools import current_time

# Ollamaモデルの設定
ollama_model = OllamaModel(
    host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
    model_id=os.getenv("OLLAMA_MODEL", "qwen3:8b"),
)

# Strands Agentの作成
strands_agent = Agent(
    model=ollama_model,
    tools=[current_time],
    system_prompt=system_prompt,
)

# AG-UI統合用にラップ
agui_agent = StrandsAgent(
    agent=strands_agent,
    name="strands_agent",
    description="A helpful assistant powered by Strands and Ollama",
)

# FastAPIアプリを生成（AG-UIプロトコル対応）
app = create_strands_app(agui_agent, "/invocations")
```

#### 参考

https://github.com/CopilotKit/with-strands-python/blob/main/agent/main.py

### CopilotKit側の設定

Next.jsのAPIルートでエージェントに接続します。
```ts
// src/app/api/copilotkit/route.ts
import { CopilotRuntime, ExternalCopilotAdapter } from "@copilotkit/runtime";

export async function POST(req: Request) {
  const runtime = new CopilotRuntime({
    remoteEndpoints: [
      {
        url: process.env.AGENT_URL || "http://agent:8000/invocations",
      },
    ],
  });
  return runtime.response(req, new ExternalCopilotAdapter());
}
```

#### 参考

https://github.com/CopilotKit/with-strands-python/blob/main/src/app/api/copilotkit/route.ts

## 動作確認

実際に確認してみます。

![image.png](https://images.ryu-ki-learn.com/ollama-strands-agui-local-agent/179a7b8d-0252-46fb-a40d-07538b2b9837.png)

一応きちんとやり取りできていそうです。応答時間はかなりかかるのでもう少し軽量なモデルを使った方がよいかもしれません。

## おわりに

シンプルな構成ではありますが、ローカル環境でコンテナを使ってAIエージェントを動かす一連の流れを体験できました。また、最近 AG-UI が Strands に対応したため、そちらも試すことができてよかったです。

https://www.copilotkit.ai/blog/aws-strands-agents-now-compatible-with-ag-ui

ただ、想像以上に Claude Code が優秀で、筆者の理解が追いつけないまま実装が進んでしまった点と、フロントエンドの知識がほぼなかった点で少し苦労しました。

いろいろ勉強になった部分も多いですが、ローカルでの検証はそこそこにして、今後は AgentCore の方でいろいろ試してみようかなと思っています。
ありがとうございました。
