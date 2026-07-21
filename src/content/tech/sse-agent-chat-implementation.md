---
title: "【SSE】FastAPI + Strands Agents で SSE ストリーミングチャットを作ってみる"
description: "以前、SSE（Server-Sent Events）の仕様を整理しました。フィールドは4種類のみで、フォーマットは data: と \\n\\n が基本、AI チャットでは JSON …"
pubDate: 2026-07-13
tags: ['SSE', 'FastAPI', 'Bedrock', 'StrandsAgents']
qiitaId: 367972d6c82f35e22b92
importedDate: 2026-07-22
qiitaStats:
  views: 1225
  likes: 4
  stocks: 2
  fetchedAt: 2026-07-22
---


## はじめに

以前、SSE（Server-Sent Events）の仕様を整理しました。フィールドは4種類のみで、フォーマットは `data:` と `\n\n` が基本、AI チャットでは JSON を `data:` に載せるのが一般的、という話でした。

https://qiita.com/ryu-ki/items/1e5c23593dbb15cac0c4

記事の最後にも記載していた、FastAPI の `app.frontend()` と Strands Agents を使った SSE ストリーミングチャットアプリを実際に作ってみます。SSE イベントの中身を可視化するパネルも作って、SSE の仕様が実際にどう流れるのかを確認してみます。

## 動作環境

| 項目 | バージョン |
|------|-----------|
| Python | 3.12 |
| FastAPI | 0.138.0 |
| strands-agents | 1.44.0 |
| React | 19.2 |
| Vite | 8.0 |

## 全体のアーキテクチャ

アプリの構成はシンプルです。ユーザーがメッセージを送ると、FastAPI がエージェントを起動し、エージェントが生成するイベントを1つずつ SSE として流します。フロントエンドは `fetch` でストリームを読み取り、チャット画面に逐次表示します。

`fetch + ReadableStream` で POST しつつストリーム受信するパターンです。

## バックエンド

### `app.frontend()` による React アプリ配信

```python
# app/main.py
app.frontend("/", directory="frontend/dist", fallback="index.html")
```

`app.frontend()` は FastAPI 0.138 で追加された、SPA（Single Page Application）のための静的ファイル配信メソッドです。

https://fastapi.tiangolo.com/reference/fastapi/#fastapi.FastAPI.frontend

従来の `StaticFiles` マウントとの違いは `fallback` パラメータです。SPA はすべてのページを `index.html` 上の JavaScript で描画するので、`/about` のようなパスに直接アクセスされても `index.html` を返す必要があります。`fallback="index.html"` がこれを実現してくれます。

これにより、バックエンドとフロントエンドを1つのサーバーで配信できます。（これの良し悪しについては一旦置いておかしてください）

### StreamingResponse による SSE 配信

```python
# app/main.py
@app.post("/api/chat")
async def chat(req: ChatRequest):
    async def generate():
        agent = Agent(
            model=model,
            system_prompt="あなたは親切なAIアシスタントです。日本語で回答してください。",
            tools=TOOLS,
            callback_handler=None,
        )
        yield _sse(type="stream_start")
        async for event in agent.stream_async(req.message):
            if sse := to_sse(event):
                yield sse
        yield _sse(type="done")

    return StreamingResponse(generate(), media_type="text/event-stream")
```

FastAPI の `StreamingResponse` は、非同期ジェネレータから `yield` されたデータを逐次クライアントに送ります。`media_type="text/event-stream"` を指定することで SSE として認識されます。

https://fastapi.tiangolo.com/reference/responses/

`agent.stream_async()` は Strands Agent の非同期ストリーミングメソッドです。エージェントの処理中に発生するイベント（テキスト生成、ツール呼び出し、ライフサイクルイベントなど）を1つずつ非同期イテレータとして返します。

https://strandsagents.com/docs/user-guide/concepts/streaming/async-iterators/

### エージェントイベントの SSE 変換

`agent.stream_async()` が返すイベントは Python の辞書（dict）です。これを SSE フォーマットの文字列に変換する必要があります。

まず、SSE 文字列を生成するヘルパー関数です。

```python
# app/main.py
def _sse(**fields: object) -> str:
    return f"data: {json.dumps(fields, ensure_ascii=False)}\n\n"
```

SSE の基本フォーマットどおり、`data:` にデータを載せて `\n\n` で区切ります。ここでは JSON を使って `type` フィールドでイベントの種類を区別しています。

次に、エージェントのイベントを種類ごとに変換する `to_sse()` 関数です。

```python
# app/main.py
def to_sse(event: dict) -> str | None:
    if "data" in event:
        return _sse(type="text", data=event["data"])

    if "current_tool_use" in event:
        tool = event["current_tool_use"]
        if tool.get("name"):
            return _sse(
                type="tool_use",
                name=tool["name"],
                tool_use_id=tool.get("tool_use_id", ""),
                input=tool.get("input", {}),
            )

    if "tool_result" in event:
        result = event["tool_result"]
        content = result.get("content", "")
        if not isinstance(content, str):
            content = json.dumps(content, ensure_ascii=False, default=str)
        return _sse(
            type="tool_result",
            tool_use_id=result.get("tool_use_id", ""),
            status=result.get("status", ""),
            content=content[:500],
        )

    # ...（その他のイベントも同様に変換）
```

Strands Agent は実行中にさまざまなイベントを発行します。イベントの種類はドキュメントにまとまっています。

https://strandsagents.com/docs/user-guide/concepts/streaming/

重要なのは `data` キーを持つイベントで、LLM がトークンを1つ生成するたびに発行されます。これを即座に流すことでストリーミング表示が実現します。

`current_tool_use` と `tool_result` はエージェントならではのイベントです。ツール呼び出しとその結果を表し、LLM はこの結果を見てさらに思考を続けます。テキスト生成とツール呼び出しを繰り返すエージェンティックループが、このイベントの連なりとして表れるわけです。

他にも `message_start` / `message_stop`（メッセージ境界）、`usage`（トークン使用量）などがありますが、今回は、チャット UI に直接関係しないライフサイクルイベントはまとめて `lifecycle` タイプに集約しています。

## フロントエンド

`fetch + ReadableStream` パターンで SSE を受信します。`fetch` でレスポンスを取得し、`res.body.getReader()` で `ReadableStream` の reader を取り出して、ループで読み取っていきます。以下ポイントになりそうなところをピックアップします。

### バッファリングとパース

```typescript
// frontend/src/App.tsx
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split("\n");
buffer = lines.pop() ?? "";
```

`reader.read()` で読み取れるデータは、必ずしもイベント単位で区切られているわけではありません。ネットワークの都合で、1つのイベントが複数回に分かれて届くこともあれば、複数のイベントがまとめて届くこともあります。

そこでバッファを使います。受信したデータをバッファに追加し、改行で分割して、完全な行だけを処理します。最後の不完全な行は `lines.pop()` でバッファに戻し、次のデータと結合します。SSE の仕様上、イベントは `\n\n` で区切られるので、行単位で処理すればうまくいきます。

### `data:` プレフィックス除去

```typescript
// frontend/src/App.tsx
if (!line.startsWith("data: ")) continue;
const payload = JSON.parse(line.slice(6));
```

SSE のフォーマットでは各行が `data: ` で始まります。`line.slice(6)` で `data: ` の6文字を取り除いて JSON をパースしています。`data: ` で始まらない行（空行など）はスキップします。

### テキスト逐次表示

```typescript
// frontend/src/App.tsx
if (payload.type === "text") {
  setMessages((prev) => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    updated[updated.length - 1] = {
      ...last,
      content: last.content + (payload.data as string),
    };
    return updated;
  });
}
```

`text` タイプのイベントが来るたびに、最後のメッセージ（アシスタントの応答）の `content` に追記していきます。React の state 更新により画面が再描画され、文字が1トークンずつ増えていくチャット UI が実現します。

## SSE イベントの流れ

ここまでの実装で、エージェントのイベントが SSE としてブラウザに届くようになりました。実際にどんなイベントがどの順番で流れてくるのかを確認するために、右側に SSE イベント可視化パネルを作りました。

パネルにはサマリーとチャンクの2つのタブがあります。

### サマリータブ

受信した SSE イベントを種類ごとに色分けして時系列で表示します。連続する同じタイプのイベントはマージして ×N のバッジ付きで1行にまとめています。

試しにエージェントに「今の日時を教えてください。」と送ってみると、以下のようなイベントが流れてきます。

![](https://images.ryu-ki-learn.com/sse-agent-chat-implementation/sse-summary-tab.png)

```
🚀 ストリーム開始
⚙️ 内部 ×10
💬 テキスト ×3          → 現在の日時を確認します。
🔧 ツール呼び出し      → get_current_time("")
⚙️ 内部 ×25
💬 テキスト ×12        → 現在の日時は 2026年7月2日（木） 00時09分56秒（日本標準時）です。
✅ 完了                  → stop_reason: end_turn
🏁 ストリーム終了
```

54個の SSE イベントが8行に集約されています。`text` が2回に分かれているのは、間に `tool_use` が挟まっているからです。テキスト → ツール呼び出し → テキスト、というエージェンティックループの流れが、SSE イベントの並びとしてそのまま見えています。

`text` の ×3 や ×12 は、同じ `type: "text"` のイベントが連続して届いた回数です。1回のリクエストで54個ものイベントが `data: {...}\n\n` の形で次々と流れてくる様子が確認できます。

### チャンクタブ

`text` イベントのデータだけを取り出し、チャンクの区切りが分かるように交互に色を付けて表示します。

![](https://images.ryu-ki-learn.com/sse-agent-chat-implementation/sse-chunk-tab.png)

```typescript
// frontend/src/App.tsx
function getTextChunks(events: SSEEvent[]): string[] {
  return events
    .filter((ev) => ev.type === "text")
    .map((ev) => String(ev.data));
}
```

1チャンクが必ずしも1トークンとは限りません。Bedrock の ConverseStream API が返す delta の単位で区切られているので、複数トークンがまとまって届くこともあります。ストリーミングでテキストがどう分割されて届いているのかを目で確認できるのは面白いです。

## おわりに

以上、簡単ではありましたが、実際に動いている様子を確認してみました。ストリーミングの実装自体は難しくありませんが、仕組みを確認しながら進められたのでよかったです。

フロントエンドの知識はまだまだないので今後も引き続き学んでいければと思います。

ありがとうございました。
