---
title: "【AgentCore】Harness の inline_function で人間の承認を挟みたい"
description: "エージェントにブラウザ操作や予約を任せるとしても、未だに最後の確定だけは人間が判断したいものです。Human-in-the-Loop（HITL）と呼ばれる設計です。"
pubDate: 2026-08-17
tags: ['AIエージェント', 'AWS', 'AgentCore', 'Bedrock']
qiitaId: abbf520bd8cd628e4f55
importedDate: 2026-08-17
qiitaStats:
  views: 944
  likes: 5
  stocks: 0
  fetchedAt: 2026-08-17
---

:::note
この記事は「2026 Japan AWS Jr. Champions 真夏のQiitaリレー」の17日目の記事となります。
過去の投稿（リンク集）・昨日の投稿は以下リンクからご覧ください。
:::

https://qiita.com/ys-yoshida/private/6f7c7f85155a993e2c86

https://qiita.com/Omizu-25/items/555c6319df5a97d3c90f

## はじめに

エージェントにブラウザ操作や予約を任せるとしても、未だに最後の確定だけは人間が判断したいものです。Human-in-the-Loop（HITL）と呼ばれる設計です。

Amazon Bedrock AgentCore の Harness には、このための仕組みとして inline_function というツールタイプが用意されています。実際に使ってみると便利な反面、気をつけないといけなさそうなこともありました。

本記事では、inline_function の仕組みについて整理し、上記の注意点についても残しておきたいと思います。

## 前提環境

| 項目 | 内容 |
|---|---|
| OS | macOS |
| AgentCore CLI（`@aws/agentcore`） | 0.22.0 |
| プロジェクト | Harness 型（モデルは Bedrock の Claude Sonnet 4.6） |

:::note warn
AgentCore CLI は更新頻度が高めで、本記事の検証は 0.22.0 時点のものです。

現在の開発者ガイドには「TUI では inline_function が呼ばれると停止して結果の入力を促す」という記述があり、新しいバージョンでは開発ツール側の挙動が改善されている可能性があります。

ただし、承認フロントエンドは利用者が作るという設計自体は変わっていません。
:::

## AgentCore Harness と agent inspector について

Harness は、エージェントループをコードではなく設定で定義する AgentCore の仕組みです。`harness.json` にモデル・system prompt・ツールを並べると、AgentCore Runtime 上で動くエージェントができあがります。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-get-started-cli.html

開発時は `agentcore dev` を実行します。するとブラウザで agent inspector という Web チャット UI が開き、エージェントとの対話やトレースの確認ができます。`--no-browser` を付けた場合は、ブラウザの代わりにターミナルの TUI で対話します。

![agent inspector。左でエージェントと対話し、右でリソースやトレースを確認できる](https://images.ryu-ki-learn.com/agentcore-harness-inline-function-hitl/agent-inspector-overview.png)

![--no-browser のターミナル TUI。ヘッダにセッション情報が出て、そのまま対話できる](https://images.ryu-ki-learn.com/agentcore-harness-inline-function-hitl/agentcore-dev-tui.png)

:::note warn
`agentcore dev` はローカル完結のモックではなく、実行した時点で IAM ロールや Harness などの実 AWS リソースがデプロイされます。
:::

## inline_function とは

一言でいうと、実行先の無いツールです。API リファレンスの定義は以下の通りです。

> Configuration for an inline function tool. When the agent calls this tool, the tool call is returned to the caller for external execution.

訳すと、エージェントがこのツールを呼ぶと、ツール呼び出しは外部で実行するために呼び出し元へ返される、とのことです。開発者ガイドにはもう少し踏み込んだ説明があります。

> **Inline functions:** Tool schemas that execute on the client side, not on the harness VM. The harness pauses when the tool is called and returns the call to your code, which decides what to do and sends a result back. This is the pattern for human-in-the-loop approvals and custom integrations.

ツールが呼ばれると Harness は一時停止し、呼び出しの内容をクライアント側のコードに返します。何をするかはクライアントが決めて、結果を送り返します。これが human-in-the-loop のためのパターンだと公式に説明されています。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-tools.html

定義は `harness.json` にツールとして書くだけです。公式ドキュメントにある購入承認の例をそのまま載せます。

```json
{
  "type": "inline_function",
  "name": "approve_purchase",
  "config": {
    "inlineFunction": {
      "description": "Request human approval for a purchase.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "amount": { "type": "number" }
        },
        "required": ["item", "amount"]
      }
    }
  }
}
```

`description` とツール引数の JSON Schema だけで、実装がどこにもありません。CLI からは `agentcore add tool --type inline_function` で追加できます。

:::note
なお、ツールを定義しただけではモデルが呼んでくれるとは限りません。system prompt 側にも、確定操作の前に必ず `approve_purchase` を呼ぶこと、承認が得られるまで確定に進まないこと、といったルールを書いておくべきかと思います。（少なくとも今は）

私の環境の Claude Sonnet 4.6 では、system prompt で教えていないツールについて「自分はそのツールを持っていない」と事実誤認することがあり、ツールの実体や使いどころまで明記してようやく安定しました。
:::

## ループが止まる仕組み

実行先が無いことについて、Lambda などの実行先があるツールと比較してみます。

|           | 通常のツール            | inline_function                                           |
| --------- | ----------------- | --------------------------------------------------------- |
| ツールの実行    | Runtime がサーバー側で実行 | 実行先が無い                                                    |
| 呼び出し後のループ | 結果が戻り、そのまま続行      | 一時停止（`stopReason: "tool_use"`）し、呼び出し内容（ツール名・引数）がクライアントに返る |
| 人間の関与     | なし                | クライアント＝人間が結果（toolResult）を返すと再開                            |

サーバー側に実装が無いこと自体が機能になっています。ツールの実行を人間が肩代わりしているようなイメージですかね。モデルから見れば `approve_purchase` は普通のツールで、その実行結果として承認や却下が返ってきます。

用途は承認に限りません。社内 API をクライアント側で呼ぶなど、クライアントで制御したい処理であれば使えるかと思います。

## toolUse と toolResult をセットで返して再開する

止まったループを再開するには、同一の `runtimeSessionId` に対して結果を送り返します。なお、invoke_harness のレスポンスは一括ではなく、テキストの断片やツール呼び出しの内容が「イベント」として順に返ってきます。公式ドキュメントの手順は3ステップです（コードは公式例の抜粋・一部整形）。

```python
# 1. inline_function ツール付きで invoke（ツールは harness.json 定義でも可）
response = client.invoke_harness(
    harnessArn=HARNESS_ARN,
    runtimeSessionId=SESSION_ID,
    messages=[{"role": "user", "content": [{"text": "メカニカルキーボードを買って"}]}],
)

# 2. 返ってきたイベントから toolUseId と入力（引数）を拾う
#    （contentBlockStart / contentBlockDelta イベントから組み立てる）

# 3. 人間が判断した結果を送り返す
#    assistant の toolUse メッセージと user の toolResult を必ずセットで含める
client.invoke_harness(
    harnessArn=HARNESS_ARN,
    runtimeSessionId=SESSION_ID,
    messages=[
        {
            "role": "assistant",
            "content": [{"toolUse": {"toolUseId": tool_use_id, "name": tool_name, "input": tool_input}}],
        },
        {
            "role": "user",
            "content": [{
                "toolResult": {
                    "toolUseId": tool_use_id,
                    "content": [{"text": "承認します"}],
                    "status": "success",
                }
            }],
        },
    ],
)
```

注意したいのは、ステップ3で toolResult だけを送ってはいけない点です。assistant 側の toolUse メッセージとセットで送る必要があります。ドキュメントには理由まで書かれていました。

> You must include both the assistant `toolUse` message and your `toolResult` in step 3. The harness intentionally does not persist the inline function turn to the session - if the client never returns a result, persisting a partial turn (assistant `toolUse` without a matching `toolResult`) would leave the session in a corrupted state.

訳すと、Harness は inline_function のターンを意図的にセッションへ永続化しない、クライアントが結果を返さないまま終わったときに toolUse だけが保存されているとセッションが壊れた状態で残ってしまうから、とのことです。

呼び出しと結果を再開時にクライアントからセットで渡させることで、結果が返っても返らなくてもセッションは無事に保たれます。言われてみればなるほどなのですが、知らずに toolResult 単体で返すとハマるポイントだと思います。

## 実際に動かすと承認を入力できない

ここからが実際に詰まった話です。

自作したエージェントは、予約内容が固まったら confirm_ferry_booking（inline_function）を呼び、承認を得てから確定に進む構成でした。`agentcore dev` の Web チャット UI で試したところ、便の選定から予約内容の整理まで順調に進み、日時・人数・金額の正確な引数でツールを呼ぶところまで問題なく実行してくれました。

ところが、そこから処理が進みません。承認や却下を入力する UI がどこにも出てきません。

![confirm_ferry_booking を呼んだまま読み込み中の表示が回り続ける agent inspector](https://images.ryu-ki-learn.com/agentcore-harness-inline-function-hitl/agentcore-inspector-hitl-spinner.png)

チャット欄に「承認します」と打ってみましたが、これは通常のユーザーメッセージとして扱われます。モデルは system prompt のルールに従って律儀にもう一度 confirm_ferry_booking を呼び... の繰り返しになりました。ターミナル TUI（`--no-browser`）でも試しましたが、呼ばれたツール名が表示されるだけで承認の入力は求められず、同じ堂々巡りになります。

CloudWatch の OTEL ログで切り分けると、状況は以下の通りでした。

- モデルは confirm_ferry_booking を正しい引数でツール呼び出ししており、ループの一時停止（`stopReason: "tool_use"`）も正常に機能している
- 一方、ログに残る toolResult はブラウザ操作などの実行ツールへの応答ばかりで、confirm への応答は 1件も無い
- つまりこの読み込み中の表示は、クライアントが toolResult を返すのをずっと待っている状態

:::note
ログを検索するときの注意点として、私の環境では confirm の呼び出しは他のツールと記録形式が違いました。

ブラウザなどの実行ツールは `toolUse` の形式で記録されるのに対し、inline_function の呼び出しは `tool_calls` 配下の `function` という形式で出てきます。

最初は前者だけを検索していて「モデルがツールを呼んでいないのでは」と誤診しかけたので、両方の形式を見るのがおすすめです。
:::

最初は開発ツール側の実装漏れを疑って（Claude が）リリースノートを追いかけたのですが、バグではありませんでした。開発者ガイドを読み直すと、inline_function はクライアント側で実行されるツールであり、承認を求めるのはフロントエンドアプリケーションの責務だと書かれています。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-tools.html#_inline_function_calls

`agentcore dev` はあくまで汎用のテスト用チャット UI であって、HITL の承認フロントエンドではありません。承認 UI は利用者が作る、というのが公式に想定された使い方でした。

## 承認フロントエンドを自作する

というわけで、前述の3ステップを自分のコードで実装します。boto3 の `invoke_harness` を直接呼ぶ薄いクライアントを書けば、Web アプリでも Slack ボットでも、好きな UI で承認フローを作れます。

実装のポイントは以下3つです。

1. `messageStop` イベントの `stopReason: "tool_use"` で停止を検知する
2. `contentBlockStart` / `contentBlockDelta` イベントから toolUseId とツール引数を組み立てて、人間に提示する
3. 承認・却下の結果を、同一の `runtimeSessionId` に assistant の toolUse と user の toolResult のセットで送り返す

まず簡単なスクリプトでこの流れを検証し、confirm での停止検知から承認の返送、エージェントが承認を受けて確定へ進むところまで動くことを確認しました。その後、承認ボタン付きの小さな Web コンソールに育てて、フェリー予約エージェントのデモではそれをインターフェースにしています。

![自作した承認コンソール。エージェントが confirm を呼ぶと右側に承認カードが出る](https://images.ryu-ki-learn.com/agentcore-harness-inline-function-hitl/booking-console-approval.png)

## おわりに

実行先の無いツールでループを止める、という inline_function の設計はシンプルで面白いなと思っています。

一方で、`agentcore dev` は承認フロントエンドではないので、そのままでは止まった後に人間が答える手段がありません。バグではなく、承認 UI は利用者が作るという設計なのですが、知らないとつまずくかと思います。

本記事がそのような方の参考になれば幸いです。

ありがとうございました。
