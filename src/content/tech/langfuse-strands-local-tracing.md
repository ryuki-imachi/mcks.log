---
title: "【Langfuse】 Strands Agents の動きをローカルでトレースしてみる"
description: "周回遅れ感がありますが、Langfuse を用いて Strands Agents の動きをトレースしてみたいと思います。"
pubDate: 2025-12-30
updatedDate: 2026-01-06
tags: ['AWS', 'Langfuse', 'StrandsAgents']
qiitaId: 9a9dacdd91fc15b33310
importedDate: 2026-07-11
qiitaStats:
  views: 2589
  likes: 4
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに  

周回遅れ感がありますが、Langfuse を用いて Strands Agents の動きをトレースしてみたいと思います。

なお、今回は手始めにローカルかつシングルエージェントで試してみた内容を記載します。  

以下2つのページを参考にさせていただきました。

https://langfuse.com/integrations/frameworks/strands-agents

https://dev.classmethod.jp/articles/strands-agents-langfuse-llmops-tracing/

## Langfuse とは

公式では以下のように説明されています。

>Langfuse は、LLM（大規模言語モデル）を活用したソフトウェア開発のために設計された、オープンソースの観測・分析プラットフォームです。開発者や企業が LLM アプリケーションを円滑に構築・改善できるよう、高度なトレーシング（追跡）機能や分析ツールを提供し、モデルのコスト、品質、レイテンシ（応答時間）に関する深い洞察をお届けします。

AIエージェントの挙動を詳細に追跡し、各ステップでのコスト・性能・品質を可視化することで、開発とデバッグを効率化できるツールです。

https://langfuse.com/jp

:::note warn
Langfuse ではトレース以外に、品質評価やプロンプト管理など他にもできることがありますが、今回はトレースについてのみ紹介します。
:::

## 今回トレースできるようにしたいエージェント

今回は以下の AWS Knowledge MCP Server を利用できる簡単なエージェントをトレースできるようにしたいと思います。

<details>
<summary>長いので折りたたみ</summary>

```python
import boto3
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient
from mcp.client.streamable_http import streamablehttp_client

SYSTEM_PROMPT = """
あなたはAWSの技術質問に回答する専門エージェントです。
ユーザーの質問に対して、AWS Knowledge MCP Serverを使用して、常に最新の公式情報を参照し回答してください。
"""

boto_session = boto3.Session(
    profile_name="sandbox-profile",
    region_name="us-west-2",
)
  
model = BedrockModel(
    model_id="global.anthropic.claude-haiku-4-5-20251001-v1:0",
    boto_session=boto_session,
)

mcp_client = MCPClient(
    lambda: streamablehttp_client(
        "https://knowledge-mcp.global.api.aws"
    )
)

with mcp_client:
    single_agent = Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=mcp_client.list_tools_sync(),
    )
    single_agent(input("質問："))
```

</details>

## 実際に追加実装してみる

### 0. Langfuse のセットアップ

今回は、ローカルで試してみたいのでセルフホスト版を利用します。

https://langfuse.com/self-hosting/deployment/docker-compose

ドキュメントを見ていただければわかるのですが、非常に簡単です。

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse
docker compose up
```

以上で、`http://localhost:3000` で利用することができます。

上記にアクセスし、アカウント作成・Organization 作成・Project 作成を実施してください。

### 1. 環境変数の準備  

Langfuse のセットアップが完了したら、`.env`ファイルにLangfuseの認証情報を設定します。

Langfuse の `Settings > API Keys` から新しい API キーを作成して `.env` ファイルに記載します。

![image.png](https://images.ryu-ki-learn.com/langfuse-strands-local-tracing/bebeaa5b-b31d-4186-9776-86e2a5581688.png)

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=http://localhost:3000
```

### 2. 必要なインポート

トレース機能のために以下を追加でインポートします。  

```python
import os
from dotenv import load_dotenv

import base64
from strands.telemetry import StrandsTelemetry
import uuid
```

以下ライブラリの追加インストールも忘れず実施しましょう。

```bash
uv add "strands-agents[otel]" langfuse python-dotenv
```

### 3. OpenTelemetry設定の追加

Langfuse へのデータ送信に必要なエンドポイントと認証情報を環境変数にセットし、OpenTelemetry エクスポーターをセットアップします。  

```python
# Langfuseの認証情報をBase64エンコード
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY")
LANGFUSE_BASE_URL = os.getenv("LANGFUSE_BASE_URL")

LANGFUSE_AUTH = base64.b64encode(
    f"{LANGFUSE_PUBLIC_KEY}:{LANGFUSE_SECRET_KEY}".encode()
).decode()  

# OpenTelemetry のエンドポイントと認証ヘッダーを設定
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = LANGFUSE_BASE_URL + "/api/public/otel"
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {LANGFUSE_AUTH}"

# OpenTelemetry エクスポーターをセットアップ
strands_telemetry = StrandsTelemetry().setup_otlp_exporter()
```

### 4. エージェント作成時の `trace_attributes` 設定

エージェント作成時に`trace_attributes`パラメータを追加します。これにより、Langfuse 上でトレースを分類・検索しやすくなります。  

```python
session_id = str(uuid.uuid4())  

single_agent = Agent(
    model=model,
    system_prompt=SYSTEM_PROMPT,
    tools=mcp_client.list_tools_sync(),
    trace_attributes={
        "session.id": session_id,                 # セッション識別
        "user.id": "test-user@example.com",       # ユーザー識別
        "langfuse.tags": ["シングルエージェント"],  # タグ付け
    },
)
```

`trace_attributes` で設定できる項目についての情報は以下リンクをご覧ください。

https://langfuse.com/integrations/native/opentelemetry#property-mapping

## コード全体

ここまでの変更を追加すると以下のようになります。

<details>
<summary>長いので折りたたみ</summary>

```diff_python
import boto3
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient
from mcp.client.streamable_http import streamablehttp_client
  
+ import os
+ from dotenv import load_dotenv
+ 
+ import base64
+ from strands.telemetry import StrandsTelemetry
+ import uuid
+ 
+ load_dotenv()
  
SYSTEM_PROMPT = """
あなたはAWSの技術質問に回答する専門エージェントです。
ユーザーの質問に対して、AWS Knowledge MCP Serverを使用して、常に最新の公式情報を参照し回答してください。
"""
  
+ LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY")
+ LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY")
+ LANGFUSE_BASE_URL = os.getenv("LANGFUSE_BASE_URL")
+   
+ LANGFUSE_AUTH = base64.b64encode(
+     f"{LANGFUSE_PUBLIC_KEY}:{LANGFUSE_SECRET_KEY}".encode()
+ ).decode()
+   
+ os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = LANGFUSE_BASE_URL + "/api/public/otel"
+ os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {LANGFUSE_AUTH}"
+   
+ strands_telemetry = StrandsTelemetry().setup_otlp_exporter()

boto_session = boto3.Session(
    profile_name="sandbox-profile",
    region_name="us-west-2",
)
  
model = BedrockModel(
    model_id="global.anthropic.claude-haiku-4-5-20251001-v1:0",
    boto_session=boto_session,
)
  
session_id = str(uuid.uuid4())
  
mcp_client = MCPClient(
    lambda: streamablehttp_client(
        "https://knowledge-mcp.global.api.aws"
    )
)
  
with mcp_client:
    single_agent = Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=mcp_client.list_tools_sync(),
+         trace_attributes={
+             "session.id": session_id,
+             "user.id": "test-user@example.com",
+             "langfuse.tags": ["シングルエージェント"],
+         },
    )
    single_agent(input("質問："))
```
</details>

## 確認してみる

エージェントが実行されると、自動的にLangfuseへトレースデータが送信されます。
### Langfuseダッシュボードで確認  

`http://localhost:3000` にアクセスし、先ほど作成したプロジェクトへ移動すると、以下のような画面になります。1行が1トレースになっています。

![image.png](https://images.ryu-ki-learn.com/langfuse-strands-local-tracing/f4fd2273-a7f1-4f8d-8e80-54e3cd877e99.png)

トレースを選択すると以下のようにトレース状況が表示されます。右上の `Open in new tab` を選択することで別タブで開くことができます。

![image.png](https://images.ryu-ki-learn.com/langfuse-strands-local-tracing/bb0ad80c-77e2-41d2-99de-00500febfaf3.png)

別タブで開くと以下のような画面になります。左上のウィンドウではスパンを確認することができます。左下のウィンドウではグラフを確認することができます。右側のウィンドウでは実際にどのような情報がやり取りされているか確認することができます。

![image.png](https://images.ryu-ki-learn.com/langfuse-strands-local-tracing/dbbe2ebe-8749-4d54-9dc9-a36e051c0f9e.png)

:::note
スパンから、グラフでは以下のような流れで `execute_event_loop_cycle` が実行されていることがわかります

![image.png](https://images.ryu-ki-learn.com/langfuse-strands-local-tracing/c09c5645-99c4-4d86-b5b9-b5f41d81b57e.png)
:::

## おわりに

以上簡単ですが、Langfuse を用いて Strands Agents で構築したエージェントをトレースできるようになりました。良くも悪くも簡単に実現することができ感動しました。

ローカル環境で Langfuse を動かせば、無料でトレースデータを収集・分析できるため、開発初期から導入しておくのがよいかなと思います。

今回はシンプルなシングルエージェントで実践してみましたが、A2A を用いたエージェントのトレースについてもいろいろ試行錯誤していますので、整理出来たら記事にしたいと思います。
ありがとうございました。
