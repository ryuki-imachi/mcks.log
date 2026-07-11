---
title: "【SSE】ストリーミングレスポンスについて今一度再確認しておく"
description: "AIエージェント開発でユーザー体験の向上のために SSE（Server-Sent Events）を使ってストリーミングレスポンスを実装することが増えました。しかし、仕組みについては…"
pubDate: 2026-06-23
updatedDate: 2026-07-03
tags: ['SSE', 'ストリーミング', 'FastAPI', 'AIエージェント']
qiitaId: 1e5c23593dbb15cac0c4
importedDate: 2026-07-11
qiitaStats:
  views: 1345
  likes: 6
  stocks: 3
  fetchedAt: 2026-07-11
---


## はじめに

AIエージェント開発でユーザー体験の向上のために SSE（Server-Sent Events）を使ってストリーミングレスポンスを実装することが増えました。しかし、仕組みについてはなんとなく使っている側面がありました。

今回、改めて SSE の仕様を確認して、今一度整理したいと思います。

## ストリーミングレスポンスとは

通常の HTTP レスポンスは、サーバーが処理を全部終えてからまとめてクライアントに返します。一方、ストリーミングレスポンスはデータを生成しながら少しずつ返します。

AIチャットで文字が徐々に表示されるのはこの仕組みです。LLM はトークンを1つ生成するたびにクライアントへ送っているので、ユーザーは全部の生成を待たずに順次出力結果を読み進められます。長い回答でも体感の待ち時間が大幅に減るため、今のAIチャットではほぼ標準的に採用されています。

## フロントエンドへの送り方

ストリーミングといえば SSE 一択だと思っていましたが、調べてみると WebSocket という選択肢もあります。

### SSE（Server-Sent Events）

SSE は HTTP ベースのサーバー → クライアント片方向ストリーミングの仕組みです。普通の HTTP レスポンスの一種なので、特別なプロトコルは不要です。Content-Type に `text/event-stream` を指定して、サーバーがデータを少しずつ流し続けます。

https://developer.mozilla.org/ja/docs/Web/API/Server-sent_events

### WebSocket

WebSocket はクライアントとサーバーの間で双方向に通信できるプロトコルです。`ws://` という専用のプロトコルを使い、一度接続を確立すると両方向にメッセージをやり取りできます。Slack や Discord のようなリアルタイムチャットで使われています。

https://developer.mozilla.org/ja/docs/Web/API/WebSockets_API

### AI チャットでの選択肢

AI チャットのやり取りは基本的に「ユーザーがメッセージを送る → エージェントがストリーミングで返す」という片方向のパターンです。双方向通信は必要ないので、SSE で十分ということになります。

ということで、ここからはSSEについて整理したいと思います。

## フロントエンドでの受け取り方

SSE をフロントエンドで受け取る方法は主に2つあります。

### EventSource API

ブラウザに標準搭載されている SSE 専用の API です。

https://developer.mozilla.org/ja/docs/Web/API/EventSource

```javascript
const source = new EventSource("/api/stream");

source.onmessage = (event) => {
  console.log(event.data);
};
```

接続が切れたときの再接続や、`event:` フィールドのパースを自動でやってくれます。ただし GET リクエストしか送れず、リクエストヘッダーのカスタマイズもできません。

### fetch + ReadableStream

`fetch` API でレスポンスをストリームとして読む方法です。

https://developer.mozilla.org/ja/docs/Web/API/Streams_API/Using_readable_streams

```javascript
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "こんにちは" }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value, { stream: true });
  // SSE のパースは自分で行う
}
```

POST リクエストが送れるので、AI チャットのように「ユーザーのメッセージを body に含めつつ、レスポンスをストリームで受け取る」パターンに向いています。SSE のフォーマット（`data:` や `\n\n` など、詳しくは後述します）は自分でパースする必要がありますが、その分自由度は高いです。

AI チャットの実装では、こちらの方法が使われていることが多い印象です。

## SSE の仕様

ここからは SSE のフォーマットそのものを見ていきます。

SSE の仕様は HTML Living Standard の一部として定義されています。

https://html.spec.whatwg.org/multipage/server-sent-events.html

### 基本のフォーマット

SSE のフォーマットはシンプルです。各イベントは「フィールド名: 値」の行で構成され、空行（`\n\n`）でイベントの区切りを表します。

```text
data: こんにちは

data: 元気ですか

```

これで2つのイベントが送信されます。

### 4つのフィールド

SSE で使えるフィールドは4つだけです。

#### `data:`

イベントのデータ本体です。複数行にまたがる場合は `data:` を複数回書けます。

```text
data: 1行目
data: 2行目

```

空行を入れずに `data:` を連続させると、クライアント側では改行で繋がれた1つのイベントとして受け取れます。

#### `event:`

イベントの名前（型）を指定できます。省略すると `message` として扱われます。

```text
event: text
data: こんにちは

event: tool
data: calculator

```

クライアント側で `EventSource` を使っている場合、`addEventListener("text", ...)` のようにイベント名で受け取りを分けられます。

#### `id:`

イベントに ID を振れます。SSE の接続が途中で切れてブラウザが再接続するとき、リクエストヘッダーに `Last-Event-ID: 42` のように最後に受け取った ID を自動で付けてくれます。サーバー側はそれを見て「42番まで送信済みだから、43番から再開しよう」と判断できる仕組みです。

```text
id: 42
data: メッセージ

```

#### `retry:`

再接続までの待ち時間をミリ秒で指定できます。

```text
retry: 3000

```

### コメント

コロン（`:`）で始まる行はコメントとして扱われ、クライアントには無視されます。

```text
: これはコメントです
data: これはデータです

```

この例では、1行目のコメントはクライアントに届かず、`data:` の行だけがイベントとして処理されます。

コメントの用途としてよくあるのがキープアライブ（接続維持）です。SSE は長時間接続を保つ仕組みですが、間にプロキシやロードバランサーがあると、しばらくデータが流れないだけで通信が終わったと判断されて接続を切られることがあります。定期的にコメントを送ることで、実際のデータを送らずに接続を維持できます。

SSE の仕様にも「レガシーなプロキシサーバー対策として、15秒ごとにコメント行を含めるとよい」という記述があります。

https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes

```text
: heartbeat
: heartbeat
data: 実際のデータ

```

## SSE でのデータの扱い方

`data:` フィールドの中身はただのテキストです。形式にルールはありません。

```text
data: こんにちは

```

これも有効な SSE イベントです。しかし、AI チャットの実装では JSON が使われていることが多い印象です。例えば、Amazon Bedrock の ConverseStream API は JSON ベースのイベントストリームを返しますし、OpenAI の Chat Completions API も `data:` に JSON チャンクを流す形式です。

https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html

https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events

では、なぜ JSON が選ばれるのでしょうか。

### 複数種類のイベントを区別

AI チャットのストリーミングでは、テキストの出力以外にも送りたい情報があります。ツールの実行通知、完了シグナル、トークン使用量など、種類の異なるデータを1つのストリームに流す必要があります。

プレーンテキストで送ると、フロントエンド側でデータを区別する方法がありません。独自のフォーマットを考えることもできますが、それはとても手間です。

JSON で `type` フィールドを持たせておけば、フロントエンドは `JSON.parse()` 一発で構造化データとして扱えます。

```text
data: {"type": "text", "data": "こんにちは"}

data: {"type": "tool", "name": "calculator"}

data: {"type": "done"}

```

### `event:` フィールドで分ける方法もある

SSE の仕様には `event:` フィールドがあるので、これでイベントの種類を分けることもできます。

```text
event: text
data: こんにちは

event: tool
data: calculator

```

ただし、「フロントエンドでの受け取り方」で触れたとおり、AI チャットでは `fetch + ReadableStream` を使うことが多く、その場合 `event:` フィールドは自分でパースする必要があります。

結局、`fetch + ReadableStream` を使うなら `data:` の中に JSON を入れて `type` で区別するのが一番楽、というのが現状の落とし所かと思います。

## おわりに

以上簡単ではありましたが、SSEについて再整理してみました。

改めて見てみると、仕様自体はかなりシンプルでした。フィールドは4つのみで、フォーマットも `data:` と `\n\n` が基本です。

一方で JSON を用いる理由や EventSource ではなく fetch を使う理由などの実装上の判断には、SSE の仕様だけでなく AI チャット特有の事情が絡んでいます。仕様を知った上で実装を決めることはとても大切かと思います。

今後、最近出た FastAPI の `app.frontend()` と Strands Agents を使って、実際に SSE ストリーミングのチャットアプリを実装してみたいと思います。イベントの中身を可視化するパネルも作って、ここで整理した仕様が実際にどう流れるのかを確認してみる予定です。

ありがとうございました。
