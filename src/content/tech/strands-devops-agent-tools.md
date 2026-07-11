---
title: "【Strands Agents】AWS DevOps Agent を Strands のツールとして組み込んでみた"
description: "以前、DevOps Agent のハンズオン記事を書いて Web アプリ上での操作を試しました。"
pubDate: 2026-06-19
updatedDate: 2026-06-23
tags: ['AWS', 'boto3', 'AIエージェント', 'StrandsAgents', 'DevOpsAgent']
qiitaId: c5dfe22c21cb1c52df69
importedDate: 2026-07-11
qiitaStats:
  views: 449
  likes: 3
  stocks: 1
  fetchedAt: 2026-07-11
---



## はじめに

以前、DevOps Agent のハンズオン記事を書いて Web アプリ上での操作を試しました。

https://qiita.com/ryu-ki/items/6420687a34ce2a562f7d

今回は一歩踏み込んで、Strands Agents から DevOps Agent を boto3 経由でツールとして呼び出す方法を試してみたいと思います。
自分で作ったエージェントが DevOps Agent と会話したり、インシデント調査を起票したりできるようになります。

本来はプレビューのときから企んでいたのですが、APIなどが用意されておらず、実質できない状態でした。しかし、先日のGAのタイミングでAPIが使えるようになり、今回実践することになりました。

:::note warn
本来は、AWSの専門家として、自身の環境の調査などを実施してもらうことを想定していましたが、GA時に思ったよりできることが多く逆に困ったことは内緒です。
:::

## 今回作るもの

以下の 3 つのツールを Strands のカスタムツールとして実装し、エージェントに組み込みます。

| ツール名 | 機能 | DevOps Agent API |
|---------|------|-----------------|
| `devops_agent_chat` | DevOps Agent とリアルタイムにチャットする | `CreateChat` → `SendMessage` |
| `devops_agent_investigate` | インシデント調査タスクを起票する | `CreateBacklogTask` |
| `devops_agent_get_result` | 起票した調査の結果を取得する | `GetBacklogTask` → `ListJournalRecords` |

```
Strands Agent
  ├── devops_agent_chat          ← 「このアラーム何が起きてる？」
  ├── devops_agent_investigate   ← 「調査タスクを起票して」
  └── devops_agent_get_result    ← 「調査結果を教えて」
          ↓ boto3
    AWS DevOps Agent (Agent Space)
```

### 前提条件

AWS アカウント（DevOps Agent が利用可能なリージョン）と、作成済みのエージェントスペースが必要です。
Python は 3.12 以上、`boto3` は `1.40.63` 以上を使ってください。`botocore 1.42.79`（DevOps Agent GA）以降で `devops-agent` サービスが利用可能になっています。

https://docs.aws.amazon.com/boto3/latest/reference/services/devops-agent.html

### 動作環境

| 項目 | バージョン |
|------|-----------|
| Python | 3.12 |
| boto3 | 1.43.32 |
| botocore | 1.43.32 |
| strands-agents | 1.44.0 |
| リージョン | us-east-1 |

## DevOps Agent API の基本

### boto3 サービス名

DevOps Agent の boto3 サービス名は `devops-agent` です。

```python
import boto3

client = boto3.client("devops-agent", region_name="us-east-1")
```

:::note warn
`botocore 1.42.79` 以降でないと `UnknownServiceError` になります。古い場合は以下でアップデートしてください。

```bash
uv add "boto3>=1.40.63" --upgrade
# または
pip install "boto3>=1.40.63" --upgrade
```
:::

### 必要な IAM 権限

今回の 3 つのツールで使う IAM アクションは以下の通りです。マネージドポリシー `AIDevOpsAgentFullAccess` でも代用できます。

```json
{
  "Effect": "Allow",
  "Action": [
    "aidevops:CreateChat",
    "aidevops:SendMessage",
    "aidevops:CreateBacklogTask",
    "aidevops:GetBacklogTask",
    "aidevops:ListJournalRecords"
  ],
  "Resource": "arn:aws:aidevops:<region>:<account-id>:agentspace/<agent-space-id>"
}
```

## 実装

### 事前準備

必要なライブラリをインストールします。

```bash
uv add strands-agents "boto3>=1.40.63"
```

共通で使う boto3 クライアントとエージェントスペース ID を定義しておきます。

```python
import boto3
import json

AGENT_SPACE_ID = "your-agent-space-id"  # ← 自分のエージェントスペース ID に置き換え
REGION = "us-east-1"

devops_client = boto3.client("devops-agent", region_name=REGION)
```

### ツール 1：チャット（`devops_agent_chat`）

DevOps Agent にオンデマンドで質問できるツールです。`CreateChat` でセッションを作り、`SendMessage` でメッセージを送って応答を受け取ります。

https://docs.aws.amazon.com/boto3/latest/reference/services/devops-agent/client/create_chat.html

https://docs.aws.amazon.com/boto3/latest/reference/services/devops-agent/client/send_message.html

#### EventStream のパース

`SendMessage` のレスポンスは EventStream 形式で返ってきます。ここで注意すべき点があります。

まず、レスポンスのトップレベルキーは `"events"` です。boto3 の他のサービスでは `"EventStream"` や `"body"` が使われることがありますが、DevOps Agent では `"events"` なので注意してください。

各イベントは `contentBlockStart` → `contentBlockDelta` × N → `contentBlockStop` のサイクルで届きます。ブロックの `type` は以下の 4 種類がありますが、取得すべきは `final_response` のブロックだけです。

| type             | 内容               |
| ---------------- | ---------------- |
| `text`           | 生成途中のストリーミングテキスト |
| `context_usage`  | コンテキスト使用量（JSON）  |
| `final_response` | 最終応答テキスト         |
| `chat_title`     | チャットの自動タイトル      |

#### 実装コード

```python
from strands import tool

@tool
def devops_agent_chat(message: str) -> str:
    """AWS DevOps Agent とチャットします。インシデントや AWS 環境について質問できます。

    Args:
        message: DevOps Agent に送信するメッセージ
    """
    chat = devops_client.create_chat(
        agentSpaceId=AGENT_SPACE_ID,
        userType="IAM",
    )
    execution_id = chat["executionId"]

    send_resp = devops_client.send_message(
        agentSpaceId=AGENT_SPACE_ID,
        executionId=execution_id,
        content=message,
    )

    final_response_index = None
    text_parts = []

    for event in send_resp["events"]:
        if "contentBlockStart" in event:
            if event["contentBlockStart"].get("type") == "final_response":
                final_response_index = event["contentBlockStart"]["index"]
        elif "contentBlockDelta" in event:
            cbd = event["contentBlockDelta"]
            if cbd.get("index") == final_response_index:
                text = cbd.get("delta", {}).get("textDelta", {}).get("text", "")
                text_parts.append(text)

    return "".join(text_parts) if text_parts else "応答を取得できませんでした"
```

### ツール 2：調査起票（`devops_agent_investigate`）

`CreateBacklogTask` でインシデント調査タスクを起票するツールです。

https://docs.aws.amazon.com/boto3/latest/reference/services/devops-agent/client/create_backlog_task.html

起票すると、DevOps Agent がバックグラウンドで自律的に調査を進めてくれます。

```python
@tool
def devops_agent_investigate(title: str, description: str, priority: str = "HIGH") -> str:
    """インシデント調査タスクを起票します。DevOps Agent がバックグラウンドで自律的に調査を行います。

    Args:
        title: 調査タスクのタイトル
        description: 調査内容の詳細説明
        priority: 優先度（CRITICAL / HIGH / MEDIUM / LOW / MINIMAL）
    """
    resp = devops_client.create_backlog_task(
        agentSpaceId=AGENT_SPACE_ID,
        title=title,
        description=description,
        priority=priority,
        taskType="INVESTIGATION",
    )

    task = resp["task"]
    return json.dumps({
        "taskId": task["taskId"],
        "status": task["status"],
        "priority": task["priority"],
        "message": "調査タスクを起票しました。結果は devops_agent_get_result で取得できます。",
    }, ensure_ascii=False)
```

:::note
`taskType` は `INVESTIGATION`（調査）と `EVALUATION`（評価）の 2 種類があります。インシデント調査には `INVESTIGATION` を使います。
:::

### ツール 3：結果取得（`devops_agent_get_result`）

起票した調査タスクの結果を取得するツールです。タスクが完了していれば `ListJournalRecords` で調査ジャーナルを取得し、最終回答を抽出します。

タスクのステータスは以下のように遷移します。

```
PENDING_TRIAGE → PENDING_START → IN_PROGRESS → COMPLETED / FAILED / TIMED_OUT / CANCELED
```

このほか、重複と判断された場合は `LINKED`、自動スキップされた場合は `SKIPPED` になります。

https://docs.aws.amazon.com/boto3/latest/reference/services/devops-agent/client/get_backlog_task.html

ジャーナルから最終回答を取り出すには、`recordType` が `"message"` かつ `role` が `"assistant"` のレコードを探して、その中の `type: "text"` ブロックの最後のものを使います。

```python
@tool
def devops_agent_get_result(task_id: str) -> str:
    """起票済みの調査タスクの結果を取得します。

    Args:
        task_id: devops_agent_investigate で取得した taskId
    """
    task = devops_client.get_backlog_task(
        agentSpaceId=AGENT_SPACE_ID,
        taskId=task_id,
    )["task"]

    status = task["status"]

    if status != "COMPLETED":
        return json.dumps({
            "taskId": task_id,
            "status": status,
            "message": f"調査はまだ完了していません（現在: {status}）。しばらく待ってから再度お試しください。",
        }, ensure_ascii=False)

    execution_id = task["executionId"]
    journal_resp = devops_client.list_journal_records(
        agentSpaceId=AGENT_SPACE_ID,
        executionId=execution_id,
        order="ASC",
    )

    final_text = None
    for record in journal_resp["records"]:
        if record["recordType"] != "message":
            continue
        msg = json.loads(record["content"])
        if msg.get("role") != "assistant":
            continue
        for block in msg.get("content", []):
            if block.get("type") == "text":
                final_text = block["text"]

    if final_text:
        return final_text
    else:
        return "調査は完了しましたが、最終回答テキストを取得できませんでした。"
```

## エージェントの組み立て

3 つのツールを Strands Agent に組み込みます。システムプロンプトでツールの使い分けを指示し、`Agent` に渡すだけです。コード全体は下の折りたたみを参照してください。

## 動かしてみる

実際にエージェントを実行してみます。今回は Langfuse でトレースも取得しています。

### チャットツールの動作

「今、立ち上がっているEC2 インスタンス一覧を教えて」と聞いてみました。DevOps Agent がエージェントスペースに紐づくリソースを確認し、きちんとインスタンス情報を返してくれています。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/chat-terminal-result.png)

Langfuse のトレースを見ると、Strands Agent が `devops_agent_chat` を呼び出し、DevOps Agent から応答を受け取っている流れが確認できます。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/chat-langfuse-overview.png)

`devops_agent_chat` の中で DevOps Agent が返した応答テキストもトレース上で確認できます。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/chat-langfuse-response.png)

### 調査起票

次に、CloudWatch アラームについて調査を起票してみます。エージェントが `devops_agent_investigate` を呼び出し、taskId とステータス（`PENDING_START`）が返ってきました。起票後、結果を取得するには `devops_agent_get_result` を使ってくださいという案内も出ています。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/investigate-terminal-result.png)

DevOps Agent の Web アプリ側でも、API 経由で起票されたタスクが表示されています。調査タイムラインにはエージェントの思考過程や、スキルの読み込み、メトリクスの確認などが記録されていました。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/investigate-webapp-timeline.png)

Langfuse のトレースでも、`devops_agent_investigate` の呼び出しと、返ってきた taskId が確認できます。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/investigate-langfuse-overview.png)

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/investigate-langfuse-detail.png)

### 調査結果の取得

調査が完了した後、taskId を渡して結果を取得してみました。DevOps Agent がアラームの状態やメトリクス、Lambda 関数の構成を調べた結果をまとめて返してくれています。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/get-result-terminal.png)

Langfuse 上でも、`devops_agent_get_result` が呼び出されている流れが確認できます。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/get-result-langfuse-overview.png)

`devops_agent_get_result` の中で、ジャーナルから抽出された最終回答テキストがトレースに記録されています。

![](https://images.ryu-ki-learn.com/strands-devops-agent-tools/get-result-langfuse-detail.png)

## コード全体

<details>
<summary>コード全体（クリックで展開）</summary>

```python
import boto3
import json
from strands import Agent, tool
from strands.models import BedrockModel

AGENT_SPACE_ID = "your-agent-space-id"  # ← 自分のエージェントスペース ID に置き換え
REGION = "us-east-1"

devops_client = boto3.client("devops-agent", region_name=REGION)


@tool
def devops_agent_chat(message: str) -> str:
    """AWS DevOps Agent とチャットします。インシデントや AWS 環境について質問できます。

    Args:
        message: DevOps Agent に送信するメッセージ
    """
    chat = devops_client.create_chat(
        agentSpaceId=AGENT_SPACE_ID,
        userType="IAM",
    )
    execution_id = chat["executionId"]

    send_resp = devops_client.send_message(
        agentSpaceId=AGENT_SPACE_ID,
        executionId=execution_id,
        content=message,
    )

    final_response_index = None
    text_parts = []

    for event in send_resp["events"]:
        if "contentBlockStart" in event:
            if event["contentBlockStart"].get("type") == "final_response":
                final_response_index = event["contentBlockStart"]["index"]
        elif "contentBlockDelta" in event:
            cbd = event["contentBlockDelta"]
            if cbd.get("index") == final_response_index:
                text = cbd.get("delta", {}).get("textDelta", {}).get("text", "")
                text_parts.append(text)

    return "".join(text_parts) if text_parts else "応答を取得できませんでした"


@tool
def devops_agent_investigate(title: str, description: str, priority: str = "HIGH") -> str:
    """インシデント調査タスクを起票します。DevOps Agent がバックグラウンドで自律的に調査を行います。

    Args:
        title: 調査タスクのタイトル
        description: 調査内容の詳細説明
        priority: 優先度（CRITICAL / HIGH / MEDIUM / LOW / MINIMAL）
    """
    resp = devops_client.create_backlog_task(
        agentSpaceId=AGENT_SPACE_ID,
        title=title,
        description=description,
        priority=priority,
        taskType="INVESTIGATION",
    )

    task = resp["task"]
    return json.dumps({
        "taskId": task["taskId"],
        "status": task["status"],
        "priority": task["priority"],
        "message": "調査タスクを起票しました。結果は devops_agent_get_result で取得できます。",
    }, ensure_ascii=False)


@tool
def devops_agent_get_result(task_id: str) -> str:
    """起票済みの調査タスクの結果を取得します。

    Args:
        task_id: devops_agent_investigate で取得した taskId
    """
    task = devops_client.get_backlog_task(
        agentSpaceId=AGENT_SPACE_ID,
        taskId=task_id,
    )["task"]

    status = task["status"]

    if status != "COMPLETED":
        return json.dumps({
            "taskId": task_id,
            "status": status,
            "message": f"調査はまだ完了していません（現在: {status}）。しばらく待ってから再度お試しください。",
        }, ensure_ascii=False)

    execution_id = task["executionId"]
    journal_resp = devops_client.list_journal_records(
        agentSpaceId=AGENT_SPACE_ID,
        executionId=execution_id,
        order="ASC",
    )

    final_text = None
    for record in journal_resp["records"]:
        if record["recordType"] != "message":
            continue
        msg = json.loads(record["content"])
        if msg.get("role") != "assistant":
            continue
        for block in msg.get("content", []):
            if block.get("type") == "text":
                final_text = block["text"]

    if final_text:
        return final_text
    else:
        return "調査は完了しましたが、最終回答テキストを取得できませんでした。"


model = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name=REGION,
)

SYSTEM_PROMPT = """
あなたは AWS インシデント対応を支援するエージェントです。
以下のツールを使って DevOps Agent と連携し、ユーザーの質問に回答してください。

- devops_agent_chat: DevOps Agent にリアルタイムで質問する
- devops_agent_investigate: インシデント調査タスクを起票する
- devops_agent_get_result: 起票した調査の結果を取得する

ユーザーの質問内容に応じて、適切なツールを選択してください。
"""

agent = Agent(
    model=model,
    system_prompt=SYSTEM_PROMPT,
    tools=[devops_agent_chat, devops_agent_investigate, devops_agent_get_result],
)

agent(input("質問："))
```

</details>

## 調査結果の受け取り方について

`devops_agent_investigate` で起票した後、結果を受け取る方法は大きく 3 通りあります。

| 用途 | 推奨方式 |
|------|---------|
| Strands ツール内で結果を待って返したい | ポーリング（`GetBacklogTask` → `ListJournalRecords`）|
| 完了を Slack 等へ通知したい | EventBridge（`aws.devops-agent`）→ Lambda / SNS |
| バックグラウンド起票だけして UI には即返す | ポーリング不要（起票完了を返すだけ）|

今回は 3 番目の方式を取っています。起票と結果取得をツールとして分離することで、エージェントが「起票→待ち→結果確認」の判断を自分で行えるようになります。~~（あくまでも検証だったので調査結果を受け取る仕組みを作る余裕がなかったことが一番の要因かもしれません）~~


## おわりに

Strands Agents のカスタムツールとして DevOps Agent API を組み込んでみました。DevOps Agent を子エージェントとして扱うことができて面白かったです。

APIが返す値を確認しながらパースする作業をAIにしてもらっているのを眺めながら便利な事態になったなぁと思いました。（それが面白くもあったなぁとも思いました）

ありがとうございました。
