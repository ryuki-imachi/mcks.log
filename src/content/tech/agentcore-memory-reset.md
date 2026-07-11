---
title: "【AgentCore Memory】 短期メモリをリセットしたくなった"
description: "AWS Bedrock の AgentCore Memory を使ったエージェント開発で、特に深い理由はないですが、メモリーの中身だけをリセットしたい場面がありました。メモリー自体…"
pubDate: 2025-12-25
tags: ['AWS', 'AgentCore']
qiitaId: c78e9dcf4d6fbb6ff932
importedDate: 2026-07-11
qiitaStats:
  views: 854
  likes: 0
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

AWS Bedrock の AgentCore Memory を使ったエージェント開発で、特に深い理由はないですが、メモリーの中身だけをリセットしたい場面がありました。メモリー自体は残したまま、会話履歴だけをクリアする方法を調査したので共有します。

メモリーを作り直したら？というのはいったん考えない方向で行きます。

## メモリーの種類を確認する

まず、自分のメモリーが「長期メモリ」と「短期メモリ」のどちらを使っているか確認してみます。

### メモリー情報の取得  

```bash
aws bedrock-agentcore-control get-memory \
  --memory-id <メモリーID> \
  --region <リージョン> \
  --profile <プロファイル名>
```

### 実行例 

```bash
aws bedrock-agentcore-control get-memory \
  --memory-id your-memory-id-XXXXXXXXXX \
  --region us-west-2 \
  --profile your-profile
```

### 出力例  

```json
{
  "memory": {
      "arn": "arn:aws:bedrock-agentcore:us-west-2:123456789012:memory/your-memory-id-XXXXXXXXXX",
      "id": "your-memory-id-XXXXXXXXXX",
      "name": "your-memory-name",
      "eventExpiryDuration": 90,
      "status": "ACTIVE",
      "createdAt": "2025-12-13T00:49:03.002000+09:00",
      "updatedAt": "2025-12-13T00:49:03.136000+09:00",
      "strategies": []
  }
}
```

## メモリーの種類による違い

### 長期メモリ（strategies が設定されている場合）

- `strategies` 配列に戦略が含まれる
- 名前空間（namespace）でメモリーを管理
- `batch-delete-memory-records` コマンドを使用

### 短期メモリ（strategies が空の場合）

- `strategies` が空配列 `[]`
- `actorId` と `sessionId` でメモリーを管理
- `delete-event` コマンドを使用

## 短期メモリのリセット方法

今回は `strategies: []` なので、短期メモリのリセット方法を説明します。

### ステップ 1：イベント一覧を取得  

```bash
aws bedrock-agentcore list-events \
  --memory-id your-memory-id-XXXXXXXXXX \
  --session-id your-session-id \
  --actor-id your-actor-id \
  --region us-west-2 \
  --profile your-profile \
  --output json
```

<details><summary>実行結果例（長いので折り畳み）</summary>

```json
{
  "events": [
    {
      "eventId": "1734567890123#a1b2c3d4e5f6",
      "timestamp": "2025-12-13T01:23:45.678Z",
      "branchName": "main",
      "payload": {
        "type": "USER_MESSAGE",
        "content": "こんにちは"
      }
    },
    {
      "eventId": "1734567891456#b2c3d4e5f6a1",
      "timestamp": "2025-12-13T01:24:01.234Z",
      "branchName": "main",
      "payload": {
        "type": "ASSISTANT_MESSAGE",
        "content": "こんにちは！何かお手伝いできることはありますか？"
      }
    },
    {
      "eventId": "1734567892789#c3d4e5f6a1b2",
      "timestamp": "2025-12-13T01:24:15.890Z",
      "branchName": "main",
      "payload": {
        "type": "USER_MESSAGE",
        "content": "AWS Lambdaについて教えて"
      }
    }
  ]
}
```
</details>

#### パラメータ説明

- `--memory-id`：メモリーの一意識別子
- `--session-id`：セッションID（コードで設定した値）
- `--actor-id`：アクターID（ユーザー識別子）



### ステップ 2：イベントを個別削除

取得した各 `eventId` を使って削除します。  

```bash
aws bedrock-agentcore delete-event \
  --memory-id your-memory-id-XXXXXXXXXX \
  --session-id your-session-id \
  --event-id "1234567890#abc123" \
  --actor-id your-actor-id \
  --region us-west-2 \
  --profile your-profile
```

## （おまけ）自動化スクリプト

全イベントを一括削除するシェルスクリプトを Claude に作ってもらいましたので共有します。

:::note warn
利用は自己責任でお願いいたします。
:::

:::note
私が見た限り一括削除するコマンドが見当たらなかったのですが、もしご存知の方がいらっしゃればぜひ教えていただきたいです。
:::

### reset_memory.sh  

```bash
#!/bin/bash

# 以下の値を自分の環境に合わせて変更してください
MEMORY_ID="your-memory-id-XXXXXXXXXX"
SESSION_ID="your-session-id"
ACTOR_ID="your-actor-id"
REGION="us-west-2"
PROFILE="your-profile"

echo "イベント一覧を取得中..."

EVENT_IDS=$(aws bedrock-agentcore list-events \
  --memory-id "$MEMORY_ID" \
  --session-id "$SESSION_ID" \
  --actor-id "$ACTOR_ID" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'events[].eventId' \
  --output text)

if [ -z "$EVENT_IDS" ]; then
  echo "削除するイベントがありません。"
  exit 0
fi

echo "イベントを削除中..."

for EVENT_ID in $EVENT_IDS; do
  echo "削除中: $EVENT_ID"
  aws bedrock-agentcore delete-event \
    --memory-id "$MEMORY_ID" \
    --session-id "$SESSION_ID" \
    --event-id "$EVENT_ID" \
    --actor-id "$ACTOR_ID" \
    --region "$REGION" \
    --profile "$PROFILE"
done

echo "完了！すべてのイベントを削除しました。"
```

## おわりに

簡単ではありましたが、メモリーをリセットする方法を調べてみました。いつ使う場面があるのかはあまりわかりませんが、参考になれば幸いです。
ありがとうございました。


## 参考

https://docs.aws.amazon.com/cli/latest/reference/bedrock-agentcore-control/get-memory.html

https://docs.aws.amazon.com/cli/latest/reference/bedrock-agentcore/delete-event.html

https://docs.aws.amazon.com/cli/latest/reference/bedrock-agentcore/batch-delete-memory-records.html
