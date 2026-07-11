---
title: "【Agent Framework】Agent Framework 入門 〜 Bedrock ストリーミング対応も添えて〜"
description: "先日、ベンダーフリーで AI エージェントに関する知見を共有しようというコンセプトの「AI Agent Builders Meetup」という勉強会に参加しました。"
pubDate: 2026-02-01
tags: ['Bedrock', 'AgentFramework']
qiitaId: 9df4686d45081d29bbd9
importedDate: 2026-07-11
qiitaStats:
  views: 1092
  likes: 3
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

先日、ベンダーフリーで AI エージェントに関する知見を共有しようというコンセプトの「AI Agent Builders Meetup」という勉強会に参加しました。

https://minorun365.connpass.com/event/380913/

そこで、こちらの登壇をお聞きした際に、Agent Framework、Durable Agent おもしろそうだなということで、実際に触ってみたいと思います。

https://www.docswell.com/s/yuma/K2QR99-2026-01-28-aiagentbuilders

今回は、第1回目（三日坊主になりませんように）ということでシンプルなエージェントを Bedrock を利用しつつ構築してみたいと思います。

## 前提条件

- Python 3.12+
- AWS 認証設定済み（Bedrock へのアクセス権限）
- agent-framework, agent-framework-bedrock

## 作成したシンプルなエージェント

以下のような、自作ツールとMCPが利用できる、一問一答形式のシンプルなエージェントを作りました。

### コード

<details>
<summary>simple_agent.py（クリックで展開）</summary>

```python:simple_agent.py
"""
シンプルなチャットエージェント（Agent Framework × Bedrock 入門）
"""

import asyncio
import os

from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from agent_framework import ChatAgent, MCPStreamableHTTPTool
from agent_framework_bedrock import BedrockChatClient

load_dotenv()

MODEL_ID = os.getenv("BEDROCK_CHAT_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
REGION = os.getenv("BEDROCK_REGION", "us-west-2")

# Microsoft Learn MCP Server
LEARN_MCP_URL = "https://learn.microsoft.com/api/mcp"

# ツールの設定
def get_current_time() -> str:
    """現在の日時を取得します。"""
    return datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y年%m月%d日 %H:%M:%S")

# MCPサーバーの設定
mcp_client = MCPStreamableHTTPTool(
    name="microsoft-learn",
    url=LEARN_MCP_URL,
)

async def main():
    client = BedrockChatClient(model_id=MODEL_ID, region=REGION)

    async with mcp_client:
        agent = ChatAgent(
            chat_client=client,
            instructions="あなたは親切な日本語アシスタントです。簡潔に回答してください。",
            tools=[get_current_time] + [mcp_client],
        )

        user_input = input("入力：")
        response = await agent.run(user_input)
        print(f"応答: {response.text}")

    print()

if __name__ == "__main__":
    asyncio.run(main())
```

</details>

### 応答例

<details>
<summary>応答例（クリックで展開）</summary>

```bash
$ uv run src/agents/simple_agent.py
入力：あなたのモデルと、できることについて教えてください。
応答: こんにちは！私についてご説明します。

## 私のモデルと役割

私はClaudeという大規模言語モデル(LLM)で、Anthropic社によって開発されました。日本語を含む多くの言語で対話できます。

## 主な機能

**1. 一般的な質問への回答**
- 様々なトピックについて説明や情報提供ができます
- 複雑な概念を分かりやすく説明するよう努めます

**2. Microsoft/Azure関連の専門知識**
- 公式ドキュメントを検索して最新の正確な情報を提供します
- コードサンプルを検索・提供できます
- 複数のプログラミング言語に対応しています

**3. テキスト処理・分析**
- 文章の作成・編集・要約
- 翻訳や言語変換
- コードの記述やデバッグ
- アイデアのブレインストーミング

**4. 実践的なサポート**
- 手順やガイダンスの提供
- 問題解決のサポート
- 学習や教育のお手伝い

## 現在利用可能なツール

- **Microsoft公式ドキュメント検索** - Azure製品やMicrosoft技術の最新情報
- **コードサンプル検索** - 実装例を検索
- **現在時刻取得** - 時間関連の情報

ご不明な点や何かお手伝いできることはありますか？
```

</details>

## 全体構成のざっくり理解

このコードは、以下の3要素で成り立っています。

1. チャットクライアント（Bedrock）
2. ツール（ローカル関数 + MCP）
3. ChatAgent がそれらを束ねて応答する

流れとしては以下のイメージです。

1. `BedrockChatClient` を作る
2. MCPツール（Microsoft Learn）を用意
3. `ChatAgent` にクライアントとツールを渡す
4. 標準入力を 1 回受けて回答を表示

## BedrockChatClient の役割

```python
client = BedrockChatClient(model_id=MODEL_ID, region=REGION)
```

LLM の実体は Bedrock にあるため、BedrockChatClient がリクエスト送信を担当します。

## ツールの定義（ローカル）

```python
def get_current_time() -> str:
    ...
```

```python
agent = ChatAgent(
    ...
    tools=get_current_time,
)
```

特別なデコレータは必要なく、エージェントに関数を渡すと認識してくれるようです。ここでは「現在日時を返すだけ」の簡単な関数を用意しています。

https://learn.microsoft.com/en-us/agent-framework/user-guide/agents/agent-tools?pivots=programming-language-python

## MCPツール（Microsoft Learn）

```python
mcp_client = MCPStreamableHTTPTool(
    name="microsoft-learn",
    url=LEARN_MCP_URL,
)
```

```python
async with mcp_client:
    agent = ChatAgent(
        ...
        tools=mcp_client,
    )
```

ちょっと気になったのが、`ChatAgent` の `tools` にMCPクライアントをそのまま突っ込んでいる点です。Strands Agents だと、`mcp_client.list_tools_sync()` みたいな形でツールを渡しているイメージがあるためです。ただ、調べてみると、`ChatAgent` 側が自動で展開してくれるので、通常はクライアントを渡すだけで十分なようです。

https://github.com/microsoft/agent-framework/blob/main/python/packages/core/agent_framework/_agents.py

ちなみに、`mcp_client.functions` でツール（関数）の一覧を取得することはできるようです。

https://learn.microsoft.com/en-us/python/api/agent-framework-core/agent_framework.mcpstreamablehttptool?view=agent-framework-python-latest

## 入力 → 応答

```python
user_input = input("入力：")
response = await agent.run(user_input)
print(f"応答: {response.text}")
```

一度入力を受け取って応答し、終了するシンプルなものです。今回 `agent.run()` を使っていますが、 `agent.run_stream()` を使うことで逐次表示（ストリーミング）になります。ただ、Ollama / Anthropic / Azure AI などのクライアントには実装されているのですが、**Bedrock では未対応**になっているため、結果が一気に返る挙動になっています。

:::note
該当箇所： `BedrockChatClient` の `_inner_get_streaming_response` は 通常レスポンスを1回取得して1回だけ `yield` する構造です。

```python
response = await self._inner_get_response(...)
yield ChatResponseUpdate(...)
```

このため `run_stream` を呼んでも逐次チャンクが流れないはずです。
:::

https://github.com/microsoft/agent-framework/blob/main/python/packages/bedrock/agent_framework_bedrock/_chat_client.py

## Bedrock でストリーミングしたい場合

Bedrock でストリーミングしたい場合は、ConverseStream（Bedrock のストリーミング対応 API）を使うクライアントを追加する必要があります。

使いたかったので、`agent_framework_ollama` など、既存のストリーミング対応クライアントの実装スタイルを参考に codex くんに作ってもらいました。（手元では正常に動作していそうです）

参考にコードを添付しておきます。

<details>
<summary>bedrock_streaming_client.py（クリックで展開）</summary>

```python:bedrock_streaming_client.py
"""
Bedrock ConverseStream 対応のストリーミング ChatClient
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterable, MutableSequence
from typing import Any
import os

from agent_framework import ChatMessage, ChatResponseUpdate, Content
from agent_framework_bedrock import BedrockChatClient


def _next_event(stream_iter: Any) -> dict[str, Any] | None:
    try:
        return next(stream_iter)
    except StopIteration:
        return None


class BedrockStreamingChatClient(BedrockChatClient):
    """Bedrock ConverseStream を使ったストリーミング対応クライアント。"""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._debug_stream = os.getenv("BEDROCK_STREAM_DEBUG") == "1"

    async def _inner_get_streaming_response(
        self,
        *,
        messages: MutableSequence[ChatMessage],
        options: dict[str, Any],
        **kwargs: Any,
    ) -> AsyncIterable[ChatResponseUpdate]:
        request = self._prepare_options(messages, options, **kwargs)
        response = await asyncio.to_thread(self._bedrock_client.converse_stream, **request)

        stream = response.get("stream")
        stream_iter = iter(stream)
        response_id = response.get("responseId")
        model_id = response.get("modelId") or request.get("modelId") or self.model_id

        message_id: str | None = None
        role: str | None = None
        tool_uses: dict[int, dict[str, Any]] = {}

        while True:
            event = await asyncio.to_thread(_next_event, stream_iter)
            if event is None:
                break

            if self._debug_stream:
                event_type = next(iter(event.keys()), "unknown")
                print(f"\n[bedrock-stream] {event_type}", flush=True)

            if "messageStart" in event:
                message = event["messageStart"].get("message", {})
                message_id = message.get("id") or message_id
                role = message.get("role") or role
                continue

            if "contentBlockStart" in event:
                block = event["contentBlockStart"]
                index = block.get("contentBlockIndex")
                start = block.get("start", {})
                tool_use = start.get("toolUse")
                if isinstance(index, int) and isinstance(tool_use, dict):
                    tool_uses[index] = {
                        "toolUseId": tool_use.get("toolUseId"),
                        "name": tool_use.get("name"),
                        "input": tool_use.get("input"),
                    }
                continue

            if "contentBlockDelta" in event:
                block = event["contentBlockDelta"]
                index = block.get("contentBlockIndex")
                delta = block.get("delta", {})

                text = delta.get("text")
                if text:
                    yield ChatResponseUpdate(
                        text=text,
                        role=role,
                        response_id=response_id,
                        message_id=message_id,
                        model_id=model_id,
                        raw_representation=event,
                    )

                tool_delta = delta.get("toolUse")
                if isinstance(index, int) and isinstance(tool_delta, dict):
                    existing = tool_uses.get(index, {})
                    incoming = tool_delta.get("input")
                    if incoming is not None:
                        existing_input = existing.get("input")
                        if isinstance(existing_input, dict) and isinstance(incoming, dict):
                            merged = dict(existing_input)
                            merged.update(incoming)
                            existing["input"] = merged
                        elif isinstance(existing_input, str) and isinstance(incoming, str):
                            existing["input"] = existing_input + incoming
                        elif isinstance(incoming, str):
                            try:
                                existing["input"] = json.loads(incoming)
                            except Exception:
                                existing["input"] = incoming
                        else:
                            existing["input"] = incoming
                    if tool_delta.get("toolUseId") and not existing.get("toolUseId"):
                        existing["toolUseId"] = tool_delta.get("toolUseId")
                    if tool_delta.get("name") and not existing.get("name"):
                        existing["name"] = tool_delta.get("name")
                    tool_uses[index] = existing
                continue

            if "contentBlockStop" in event:
                block = event["contentBlockStop"]
                index = block.get("contentBlockIndex")
                if isinstance(index, int) and index in tool_uses:
                    tool = tool_uses.pop(index)
                    tool_name = tool.get("name")
                    if tool_name:
                        yield ChatResponseUpdate(
                            contents=[
                                Content.from_function_call(
                                    call_id=tool.get("toolUseId"),
                                    name=tool_name,
                                    arguments=tool.get("input"),
                                )
                            ],
                            role=role,
                            response_id=response_id,
                            message_id=message_id,
                            model_id=model_id,
                            raw_representation=event,
                        )
                continue

            if "metadata" in event:
                usage_details = self._parse_usage(event["metadata"].get("usage"))
                if usage_details:
                    yield ChatResponseUpdate(
                        contents=[Content.from_usage(usage_details=usage_details)],
                        response_id=response_id,
                        message_id=message_id,
                        model_id=model_id,
                        raw_representation=event,
                    )
                continue

            if "messageStop" in event:
                stop_reason = event["messageStop"].get("stopReason")
                finish_reason = self._map_finish_reason(stop_reason)
                yield ChatResponseUpdate(
                    finish_reason=finish_reason,
                    response_id=response_id,
                    message_id=message_id,
                    model_id=model_id,
                    raw_representation=event,
                )
```

</details>

<details>
<summary>streaming_simple_agent.py（クリックで展開）</summary>

```python:streaming_simple_agent.py
"""
simple_agent.py と同等構成で Bedrock ストリーミングを行う例
"""

import asyncio
import os

from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from agent_framework import ChatAgent, ChatMessage, MCPStreamableHTTPTool

from bedrock_streaming_client import BedrockStreamingChatClient

load_dotenv()

MODEL_ID = os.getenv("BEDROCK_CHAT_MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
REGION = os.getenv("BEDROCK_REGION", "us-west-2")

# Microsoft Learn MCP Server
LEARN_MCP_URL = "https://learn.microsoft.com/api/mcp"


def get_current_time() -> str:
    """現在の日時を取得します。"""
    return datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y年%m月%d日 %H:%M:%S")


async def main() -> None:
    client = BedrockStreamingChatClient(model_id=MODEL_ID, region=REGION)

    mcp_client = MCPStreamableHTTPTool(
        name="microsoft-learn",
        url=LEARN_MCP_URL,
    )

    async with mcp_client:
        agent = ChatAgent(
            chat_client=client,
            instructions="あなたは親切な日本語アシスタントです。簡潔に回答してください。",
            tools=[get_current_time] + [mcp_client],
        )

        user_input = input("入力：")
        async for chunk in agent.run_stream(messages=[ChatMessage(role="user", text=user_input)]):
            text = getattr(chunk, "text", "")
            if text:
                print(text, end="", flush=True)
        print()


if __name__ == "__main__":
    asyncio.run(main())
```

</details>

## おわりに
以上、とても初歩的なお話でしたが、Agent Framework に入門してみました。

Agent Framework は `ChatAgent` にクライアントとツールを渡すだけでエージェントが作れるシンプルな設計でした。Bedrock のストリーミングは未対応ですが、独自実装で対応可能です。（AI 様様）

今後も少しずついろいろ試してみようと思います。

ありがとうございました。
