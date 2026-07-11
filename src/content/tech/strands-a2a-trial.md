---
title: "【A2A】Strands AgentsでA2Aを試してみた"
description: "ふと、A2Aのトレースってどうなるんだろうと気になりました。"
pubDate: 2026-02-05
updatedDate: 2026-02-12
tags: ['A2A', 'StrandsAgents']
qiitaId: 7d22ebd749526f9d6514
importedDate: 2026-07-11
qiitaStats:
  views: 3711
  likes: 4
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

ふと、A2Aのトレースってどうなるんだろうと気になりました。

そもそもA2Aの実装もほとんどしたことがないので、まずはそこから始めていきたいと思います。

本記事では、ローカルでStrands Agentsを用いて、A2AサーバーとA2Aクライアントを作成し、どんな感じで動くのか試してみたいと思います。

## そもそもA2Aとは

A2A（Agent to Agent Protocol）は、2025年4月にGoogleが発表したAIエージェント間の通信プロトコルです。2025年6月にはLinux Foundationのプロジェクトとして立ち上がり、現在は100社以上の企業が支援していると発表されています。

https://a2a-protocol.org/latest/

### A2Aの目的

AIエージェントは様々なフレームワーク（Strands Agents、Agent Framework、LangChainなど）で作られます。エージェント同士がサイロ化してしまうと、複雑なタスクを協力して解決することが難しくなります。

A2Aはエージェント間の相互運用性を高め、異なるフレームワークで作られたエージェント同士が通信できるようにします。専門性の異なるエージェントが協力してタスクを遂行できるようにし、内部ロジックやメモリを公開せずに協調できる点も大きな特徴です。

### A2Aの主要な概念

主要な概念はAgentCard、Task、Message、Part、Artifactの5つです。AgentCardはエージェントの能力や入出力を示すJSONファイルで、最新のドキュメントでは `/.well-known/agent-card.json` に置くことが推奨されています。Taskはエージェント間の通信単位で、状態（submitted/working/completed など）を持ちながら進み、やり取りの履歴や成果物（Artifact）を紐づけます。Messageはタスク内の1回分のやり取りを表し、PartはMessageを構成する部品（テキストやファイル参照など）です。Artifactはタスクの出力結果です。

https://a2a-protocol.org/latest/topics/key-concepts/

https://a2a-protocol.org/latest/specification/

## 実際に作ってみる

### 大まかな構成

今回作成するのは、親エージェント1つ + 子エージェント2つのマルチエージェントシステムです。

![a2a-overview.png](https://images.ryu-ki-learn.com/strands-a2a-trial/7bf17758-06a6-4a83-8ac8-9445591303b8.png)

ユーザーの質問を親エージェントが受け取り、質問の内容に応じて適切な子エージェント（Strands専門とLangChain専門）に問い合わせる仕組みです。

### 使用技術

| 技術 | 用途 |
|------|------|
| Strands Agents | AIエージェントフレームワーク |
| A2A | エージェント間通信プロトコル |
| MCP | 外部ツール（ドキュメント検索）連携 |
| FastAPI + Uvicorn | HTTPサーバー |
| Amazon Bedrock | Claude Haiku 4.5モデルのホスティング |

### 親エージェント（parent_agent.py）

親エージェントはA2Aクライアントとして動作し、子エージェントを呼び出します。

```python
from strands import Agent
from strands.models import BedrockModel
from strands_tools.a2a_client import A2AClientToolProvider

# Bedrockモデル作成
model = BedrockModel(model_id="...")  # 例: Claude Haiku系モデル

# A2Aクライアント設定
agent_urls = [
    "http://localhost:9001",  # Strands Agent専門エージェント
    "http://localhost:9002",  # LangChain専門エージェント
]
a2a_tool_provider = A2AClientToolProvider(known_agent_urls=agent_urls)

# 親エージェント作成
agent = Agent(
    model=model,
    system_prompt=SYSTEM_PROMPT,
    tools=a2a_tool_provider.tools,  # A2A通信用ツール
    name="質問回答エージェント",
)
```

`A2AClientToolProvider`を使うと、エージェントにA2Aクライアント用のツールが追加されます。これにより、Agent Cardの取得による子エージェントの発見や、子エージェントへのメッセージ送信が可能になります。親エージェントはユーザーの質問内容を見て、どの子エージェントに問い合わせるかを判断します。

### Strands専門エージェント（child_agent_strands.py）

Strands Agentsについての質問に回答する専門エージェントです。

```python
from fastapi import FastAPI
from strands import Agent
from strands.multiagent.a2a import A2AServer

# エージェント作成
agent = Agent(
    model=model,
    system_prompt=SYSTEM_PROMPT,
    name="Strands専門エージェント",
)

# A2Aサーバー作成
a2a_server = A2AServer(
    agent=agent,
    port=9001,
    http_url="http://127.0.0.1:9001/",
    serve_at_root=True,
)

# FastAPIアプリにマウント
app = FastAPI()
app.mount("/", a2a_server.to_fastapi_app())
```

ドキュメント検索はMCPツールで行いますが、細部の実装はここでは省略します。`A2AServer`でエージェントをHTTPサーバーとして公開し、他のエージェントから呼び出せるようにします。

### LangChain専門エージェント（child_agent_langchain.py）

LangChain/LangGraph/LangSmithについての質問に回答する専門エージェントです。

```python
from strands import Agent
from strands.multiagent.a2a import A2AServer

# エージェント作成
agent = Agent(
    model=model,
    system_prompt=SYSTEM_PROMPT,
    name="LangChain専門エージェント",
)

# A2Aサーバー作成
a2a_server = A2AServer(
    agent=agent,
    port=9002,
    http_url="http://127.0.0.1:9002/",
    serve_at_root=True,
)

# FastAPIアプリにマウント
app = FastAPI()
app.mount("/", a2a_server.to_fastapi_app())
```

ドキュメント検索はMCPツールで行いますが、細部の実装はここでは省略します。

### 動作確認してみる

#### 起動方法

```bash
# ターミナル1 Strands専門エージェント起動
python src/without_trace/child_agent_strands.py

# ターミナル2 LangChain専門エージェント起動
python src/without_trace/child_agent_langchain.py

# ターミナル3 親エージェント起動（対話開始）
python src/without_trace/parent_agent.py
```

以下のように、実際に子エージェントの情報を取得できていそうです。

![image.png](https://images.ryu-ki-learn.com/strands-a2a-trial/b7d357dd-1fac-416a-87e2-437cb4333bd0.png)

## A2AとMCPについて

今回の構成では、A2AとMCPの両方を使っています。

![a2a-mcp.png](https://images.ryu-ki-learn.com/strands-a2a-trial/7c1bb153-0670-4afe-9da7-d20a691439b1.png)

こちらの図の通り、A2Aはエージェント同士の通信で、親と子のやり取りを担います。MCPはエージェントとドキュメントの接続を担います。

## おわりに

以上、シンプルではありましたが、実際にA2Aを体験してみました。

A2Aを使うと専門性の異なるエージェントを組み合わせたシステムは比較的簡単に作れそうです。一方であまりユースケースが思い浮かばない部分もあります。

次回は、このA2AシステムにLangfuseによるトレーシングを追加して、親子エージェント間の呼び出しを可視化してみたいと思います。

ありがとうございました。
