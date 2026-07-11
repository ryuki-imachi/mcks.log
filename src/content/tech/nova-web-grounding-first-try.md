---
title: "【Amazon Nova】Amazon Nova Web Grounding をとりあえず触る"
description: "2025/10/29 に、Amazon NovaモデルにWeb Grounding機能が追加されたことが発表されました。"
pubDate: 2025-10-31
updatedDate: 2025-11-10
tags: ['AWS', 'AmazonNova']
qiitaId: 005155ebe999e37be7f1
importedDate: 2026-07-11
qiitaStats:
  views: 1613
  likes: 2
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

2025/10/29 に、Amazon NovaモデルにWeb Grounding機能が追加されたことが発表されました。

また、現時点（2025/10/31）では、Nova Premierで利用可能となっており、クロスリージョン推論を用いて、バージニア北部、オハイオ、オレゴンリージョンで利用可能のようです。（使えるモデルやリージョンは拡大予定だそうです）

https://aws.amazon.com/jp/about-aws/whats-new/2025/10/web-grounding-ai-applications-amazon-nova-models/

https://aws.amazon.com/jp/blogs/aws/build-more-accurate-ai-applications-with-amazon-nova-web-grounding/

今回は実際にこちらを触ってみたいと思います。

## Web Grounding について簡単に整理

実際に触ってみる前に簡単に Web Grounding について説明したいと思います。

特徴としては、最新のWeb情報を取得し、活用することができます。そのため、ハルシネーションを削減することができたり、最新情報を反映した正確な回答が出来たりするといったメリットがあります。

この機能が、Novaモデル向けに組み込みツールとして利用できるようになったわけですね。

## 実際に確認してみる

### いったんWeb Groundingなしを確認

#### 簡単な確認用コード

以下のようなシンプルなコードを書きました。

```python
import boto3
from dotenv import load_dotenv
import os
import json

# .envファイルを読み込む
load_dotenv()

# Bedrock クライアントの作成
client = boto3.client(
    'bedrock-runtime',
    region_name='us-east-1'  # 現在はこのリージョンのみ対応
)

# 質問を準備
question = "今日の東京都の天気を教えて。"
messages = [
    {
        "role": "user",
        "content": [{"text": question}]
    }
]  

# Web Groundingを有効にせずそのまま実行
response = client.converse(
    modelId="us.amazon.nova-premier-v1:0",
    messages=messages
)

# 結果を表示
print(json.dumps(response, indent=2, ensure_ascii=False, default=str))
```

#### 実行結果

結果は以下の通りです。想定通りわからないとのことでした。

```json
{
  "ResponseMetadata": {
    "RequestId": "755e7963-42f1-4f07-9439-5140ca2d159c",
    "HTTPStatusCode": 200,
    "HTTPHeaders": {
      "date": "Fri, 31 Oct 2025 12:29:52 GMT",
      "content-type": "application/json",
      "content-length": "618",
      "connection": "keep-alive",
      "x-amzn-requestid": "755e7963-42f1-4f07-9439-5140ca2d159c"
    },
    "RetryAttempts": 0
  },
  "output": {
    "message": {
      "role": "assistant",
      "content": [
        {
          "text": "申し訳ありませんが、リアルタイムの天気情報を提供することはできません。最新の天気予報については、気象庁のウェブサイトや天気予報アプリをご確認ください。これらのリソースは、正確で最新の天気情報を提供します。東京都の天気は変動があるので、外出前に必ず確認することをおすすめします。"
        }
      ]
    }
  },
  "stopReason": "end_turn",
  "usage": {
    "inputTokens": 44,
    "outputTokens": 76,
    "totalTokens": 120
  },
  "metrics": {
    "latencyMs": 1711
  }
}
```

### Web Grounding を試してみる

#### 確認用コード

以下が確認用のコードです。`toolConfig`の設定を少し追加してあげるだけです。

```python
import boto3
from dotenv import load_dotenv
import os
import json

# .envファイルを読み込む
load_dotenv()

# Bedrock クライアントの作成
client = boto3.client(
    'bedrock-runtime',
    region_name='us-east-1'  # 現在はこのリージョンのみ対応
)

# 質問を準備
question = "今日の東京都の天気を教えて。"

messages = [
    {
        "role": "user",
        "content": [{"text": question}]
    }
]

# Web Groundingを有効にして実行
response = client.converse(
    modelId="us.amazon.nova-premier-v1:0",
    messages=messages,
    toolConfig={
        "tools": [
            {
                "systemTool": {
                    "name": "nova_grounding"  # これでWeb Groundingを有効化
                }
            }
        ]
    }
)

# 結果を表示
print(json.dumps(response, indent=2, ensure_ascii=False, default=str))
```

#### 実行結果

実行結果は以下の通りです。結果を見る限りweb検索はしてくれていそうなのですが、今日（2025/10/31）は雨だったと思うので、若干怪しさがありました。時間の指定の仕方がよくなかったかもしれないです...

また、ソースなどの情報は`[HIDDEN]`となっていて一目ではわからないようになっていました。

```json
{
  "ResponseMetadata": {
    "RequestId": "7dace794-97f8-460b-a8f9-e2207c96d9d9",
    "HTTPStatusCode": 200,
    "HTTPHeaders": {
      "date": "Fri, 31 Oct 2025 12:36:54 GMT",
      "content-type": "application/json",
      "content-length": "1130",
      "connection": "keep-alive",
      "x-amzn-requestid": "7dace794-97f8-460b-a8f9-e2207c96d9d9"
    },
    "RetryAttempts": 0
  },
  "output": {
    "message": {
      "role": "assistant",
      "content": [
        {
          "text": "<thinking>Get today's Tokyo weather</thinking>\n"
        },
        {
          "toolUse": {
            "toolUseId": "tooluse_cqd96yjeO4bcI0cLdNGXpw",
            "name": "nova_grounding",
            "input": {
              "query": "今日の東京都の天気"
            },
            "type": "server_tool_use"
          }
        },
        {
          "toolResult": {
            "toolUseId": "tooluse_cqd96yjeO4bcI0cLdNGXpw",
            "content": [
              {
                "text": "[HIDDEN]"
              }
            ],
            "status": "success",
            "type": "nova_grounding_result"
          }
        },
        {
          "text": "<thinking>Based on the search results, I need to extract the relevant Tokyo weather information for today. The results show various weather details but I must focus on the current date's forecast. The key details are:</thinking> \n\n東京都の今日の天気は、晴れ時々曇り、最高気温は20度、最低気温は14度の予報です。\n\n- 天気: 晴れ時々曇り\n- 最高気温: 20℃ \n- 最低気温: 14℃\n\n午後は南部を中心に晴れる見込みです。洗濯指数は「乾く」、傘指数は「不要」となっています。"
        }
      ]
    }
  },
  "stopReason": "end_turn",
  "usage": {
    "inputTokens": 359,
    "outputTokens": 174,
    "totalTokens": 533
  },
  "metrics": {
    "latencyMs": 12780
  }
}
```

ということで、日付指定して、再度確認してみました。

以下は結果を抜粋したものですが、（完璧ではないものの）今日の天気を適切に引っ張ってこれてそうでした。みなさんもプロンプトを書くときは気を付けましょう。

```json
{
  "text": "<thinking>Based on the search results, it seems there was patchy rain in Tokyo on October 30, 2025, with temperatures ranging from 19°C (66°F) in the morning to 12°C (54°F) at night. The humidity was around 73%, with a south wind of 4.9 meters per second. However, the most definitive answer comes from the search result stating it would be \"patchy rain possible\" that day.</thinking> \n2025年10月30日の東京都の天気は、最高気温が19°C、最低気温が12°Cで、湿度は73%でした。南の風が4.9メートル/秒で、雨の可能性がありました。"
}
```

#### 実行時間

premierというのもあるのか、やや不安になるくらいのレスポンスの遅さでした。（15～20秒くらい？）

### コストについて

サクッと使えてよいですが、こちらの機能は追加コストがかかります。こちらの画像の通り、1,000リクエストごとに30ドルほどかかるようです。試す方は気を付けましょう。

![image.png](https://images.ryu-ki-learn.com/nova-web-grounding-first-try/1d9eae93-e7e9-4754-9446-4e40b25a5158.png)

## おわりに
以上、サラッとではありましたが、Amazon Nova の Web Grounding を試してみました。今すぐ使えるかは正直何とも言えないですが、こういう機能が追加されたんだと認識しておくことは後々役立つかもしれません。うまい使いどころが思いついたら試してみたいと思います。
ありがとうございました。
