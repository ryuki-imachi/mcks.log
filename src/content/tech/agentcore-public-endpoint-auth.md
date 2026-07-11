---
title: "【AgentCore】Runtime をパブリックにデプロイしたけど、勝手にアクセスされない？"
description: "Amazon Bedrock AgentCore Runtime を使うと、自作の AI エージェントをマネージドインフラ上にデプロイできます。"
pubDate: 2026-07-07
updatedDate: 2026-07-08
tags: ['AWS', 'Security', 'Bedrock', 'AgentCore']
qiitaId: 2cd37256824b54022bdb
importedDate: 2026-07-11
qiitaStats:
  views: 6149
  likes: 9
  stocks: 2
  fetchedAt: 2026-07-11
---


## はじめに

Amazon Bedrock AgentCore Runtime を使うと、自作の AI エージェントをマネージドインフラ上にデプロイできます。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html

触っていて、ふと気になったことがあります。AgentCore Runtime のエンドポイントの URL がパブリックに払い出されているのですが、これを用いて外部から勝手にアクセスされエージェントを不正利用されてしまわないのでしょうか。

結論としては、勝手にアクセスされることはありません。本記事ではなぜ安全なのかを整理した上で、実際に無認証でアクセスを試みて拒否されることを確認してみたいと思います。

## パブリックデプロイ時のエンドポイント

AgentCore Runtime をデフォルト設定でデプロイすると、以下のような形式のエンドポイント URL が払い出されます。

```
https://bedrock-agentcore.<region>.amazonaws.com/runtimes/<URL-encoded-ARN>/invocations?qualifier=DEFAULT
```

この URL はインターネットからアクセス可能です。ただし、URL を知っているだけではエージェントを呼び出すことはできません。

## インバウンドセキュリティの仕組み

Runtime への呼び出しは、以下のような3つの層で保護されています。

```
外部クライアント
    │
    ▼
AgentCore Runtime エンドポイント
    │
    │  【第1層】認証 — IAM SigV4 署名 or JWT Bearer Token
    │           リクエストの署名・トークンが正しいかを検証
    │
    │  【第2層】認可（IDベース）— 呼び出し側の IAM ポリシー
    │           InvokeAgentRuntime 権限を持っているか
    │
    │  【第3層】認可（リソースベース）— Runtime 側のポリシー（任意）
    │           受け付ける呼び出し元を制限（特定ロールのみ等）
    │
    ▼
InvokeAgentRuntime の実行
```

各層で必要な IAM 権限やポリシーの詳細は以下の公式ドキュメントにまとまっています。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-permissions.html

手前の層を通らない限り、次の層の評価には進みません。

### デフォルトの認証方式

Runtime はデフォルトで IAM SigV4（Signature Version 4）認証が有効になっています。これは AWS SDK や CLI が自動的に処理してくれる標準的な署名プロトコルで、リクエストには有効な AWS アクセスキー ID とシークレットアクセスキーから計算された暗号学的な署名が含まれている必要があります。

https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/reference_sigv.html

署名が正しくないリクエストは、エンドポイントに到達しても即座に拒否されます。つまり、認証情報を持たない第三者がこの URL を叩いても、エージェントのコードは一切実行されません。

## 前提環境

| 項目 | 内容 |
|------|------|
| AWS CLI | 2.32.32 |
| Python | 3.13 |
| boto3 / botocore | 1.42.96 / 1.42.96（テスト3で使用） |
| AgentCore Runtime | デフォルト設定（IAM 認証 / PUBLIC モード）でデプロイ済み |

:::note
本記事の内容は、2026年7月上旬時点の検証内容に基づきます。AgentCore は更新が活発なサービスなので、仕様が変わっている可能性がある点はご承知おきください。
:::

## アクセス可否の実測

理屈はわかりましたが、実際に確かめてみないと安心できないので、デプロイ済みの Runtime に対して「認証なし」と「認証あり」の両方でアクセスを試してみます。

### 準備

まず、デプロイ済みの Runtime 情報を確認して、呼び出し用の URL を組み立てます。

```bash
# Runtime の情報を確認
aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id <YOUR_RUNTIME_ID> \
  --region us-east-1
```

```bash
# Runtime ARN を URL エンコードしてエンドポイント URL を組み立てる
RUNTIME_ARN="arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/my_agent-EzA5oXBJQC"
ENCODED_ARN=$(printf '%s' "${RUNTIME_ARN}" | sed 's/:/%3A/g; s/\//%2F/g')
ENDPOINT_URL="https://bedrock-agentcore.us-east-1.amazonaws.com/runtimes/${ENCODED_ARN}/invocations?qualifier=DEFAULT"
```

### テスト1：認証なしでアクセスする

まずは curl で認証ヘッダーを一切付けずにアクセスしてみます。

```bash
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${ENDPOINT_URL}" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```

結果は以下の通りです。

```
HTTP Status: 403
```

```json
{
  "message": "Missing Authentication Token"
}
```

認証トークンがないため、403 Forbidden で拒否されました。エージェントのコードは一切実行されていません。

### テスト2：適当な認証情報でアクセスする

次に、適当な Authorization ヘッダーを付けてアクセスしてみます。

```bash
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "${ENDPOINT_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer fake-token-12345" \
  -d '{"prompt": "Hello"}'
```

こちらも拒否されます。

```
HTTP Status: 403
```

```json
{
  "message": "Authorization method mismatch. The agent is configured for a different authorization method than what was used in your request. Check the agent's authorization configuration and ensure your request uses the matching method (OAuth or SigV4)"
}
```

この Runtime は SigV4 認証で構成されているため、Bearer トークン形式のリクエストは認証方式の不一致として拒否されています。仮に SigV4 の形式に合わせたとしても、シークレットキーから計算される暗号学的な署名が正しくなければ通らないので、推測や偽造はできないようになっています。

### テスト3：正規の AWS 認証情報でアクセスする

最後に、AWS SDK（boto3）を使って正規の認証情報でアクセスしてみます。以下の内容で `test_invoke.py` を作成・実行します。

```python:test_invoke.py
# /// script
# requires-python = ">=3.10"
# dependencies = ["boto3", "botocore[crt]"]
# ///

import boto3
import json
import uuid

client = boto3.client("bedrock-agentcore", region_name="us-east-1")

session_id = f"security-test-{uuid.uuid4().hex[:20]}"

response = client.invoke_agent_runtime(
    agentRuntimeArn="arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/my_agent-EzA5oXBJQC",
    runtimeSessionId=session_id,
    payload=json.dumps({"prompt": "Hello"}).encode(),
)

print(f"HTTP Status: {response['ResponseMetadata']['HTTPStatusCode']}")

body = response.get("response")
if body:
    print(body.read().decode("utf-8"))
```

:::note
`runtimeSessionId` には **33文字以上256文字以下** という制約があります。上記のコードでは34文字になるようにしていますが、テスト用に短い ID へ変えると ValidationException になるので注意してください。
:::

制約の詳細は API リファレンスに記載されています。

https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeAgentRuntime.html

実行すると、こちらは正常にレスポンスが返ってきます。

```
HTTP Status: 200
data: "Hello! How can I help you today?"
```

呼び出し側の IAM エンティティに `bedrock-agentcore:InvokeAgentRuntime` 権限が付与されているため、認証・認可の両方をパスしてエージェントが実行されました。

### 検証結果

| テスト | 認証 | 結果 |
|---|---|---|
| 認証ヘッダーなし | なし | 403 — Missing Authentication Token |
| 偽トークン | 無効 | 403 — Authorization method mismatch |
| 正規の AWS 認証情報 + IAM権限 | 有効 | 200 — 正常応答 |

パブリックエンドポイントであっても、AWS の認証基盤が確実にガードしていることを確認できました。

## リソースベースポリシーによる呼び出し元の制限

デフォルトの IAM 認証だけでも無認証アクセスは防げますが、同じ AWS アカウント内で `InvokeAgentRuntime` 権限を持つ IAM エンティティなら誰でも呼び出せる状態ではあります。呼び出し元をさらに限定したい場合は、リソースベースポリシーを Runtime に直接アタッチします。

### 特定の IAM ロールだけに限定する場合

注意点として、Allow だけのポリシーでは呼び出し元を限定できません。IAM ポリシーとリソースベースポリシーは、どちらかが Allow なら許可されるためです。限定するには、以下のように明示的な Deny を組み合わせます。

```bash
aws bedrock-agentcore-control put-resource-policy \
  --resource-arn arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/my_agent-EzA5oXBJQC \
  --policy file://runtime-policy.json
```

```js:runtime-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    // 1. 許可したいロール（MyAppBackendRole）に Allow を出す
    {
      "Sid": "AllowBackendRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/MyAppBackendRole"
      },
      "Action": "bedrock-agentcore:InvokeAgentRuntime",
      "Resource": "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/my_agent-EzA5oXBJQC"
    },
    // 2. それ以外の呼び出し元をすべて拒否する
    {
      "Sid": "DenyAllOtherPrincipals",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "bedrock-agentcore:InvokeAgentRuntime",
      "Resource": "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/my_agent-EzA5oXBJQC",
      "Condition": {
        // 呼び出し元が MyAppBackendRole でないとき、この Deny が適用される
        "ArnNotEquals": {
          "aws:PrincipalArn": "arn:aws:iam::123456789012:role/MyAppBackendRole"
        }
      }
    }
  ]
}
```

:::note warn
コメントは説明用です。JSON にはコメントを書けないため、実際に使うときは `//` の行を削除してください。
:::

リソースベースポリシーの設定方法や条件キーの一覧については以下の公式ドキュメントを参照してください。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/resource-based-policies.html


### おまけ

本記事ではデフォルトの IAM SigV4 認証に焦点を当てましたが、AgentCore Runtime はもう1つの認証方式として JWT（JSON Web Token）Bearer Token 認証もサポートしています。

IAM 認証はバックエンドからの呼び出しに向いており、JWT 認証は Web アプリのエンドユーザーが直接エージェントを利用するケースに向いています。Runtime 作成時にどちらか1つを選択する形で、同時に両方を使うことはできません。

認証方式の選び方については以下の記事が参考になります。

https://qiita.com/har1101/items/594461462b452945c443

## おわりに

以上、AgentCore Runtime をパブリックにデプロイした場合のインバウンドセキュリティについて整理し、実際に無認証アクセスが拒否されることを確認しました。

私自身、最初はエンドポイントがパブリックに公開されている点についての理解が曖昧でしたが、「パブリック = 無防備」ではないことがわかりました。そのうえで、リソースベースポリシーで呼び出し元を絞るなど、最小権限を意識した設計は引き続き大切だと思います。

また、今回は IAM 認証のケースに絞りましたが、JWT 認証を使ったアーキテクチャや、Gateway / Identity / Policy といった周辺機能との組み合わせについても今後整理していきたいと考えています。

ありがとうございました。
