---
title: "【AgentCore】新しく発表された Policy 機能を試してみる"
description: "12/2に、Amazon Bedrock AgentCore に Policy 機能が追加されました（プレビュー版）。この機能によって、Runtime から Gateway を経由…"
pubDate: 2025-12-04
updatedDate: 2025-12-08
tags: ['AWS', 'AgentCore']
qiitaId: 855d35dda379bf83b9dc
importedDate: 2026-07-11
qiitaStats:
  views: 2530
  likes: 4
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

12/2に、Amazon Bedrock AgentCore に Policy 機能が追加されました（プレビュー版）。この機能によって、Runtime から Gateway を経由してツールを実行する際に、誰がどのツールを使えるのかを Cedar というポリシー言語を用いて制御できるようになりました。今回はそちらについて試してみたいと思います。

https://aws.amazon.com/jp/blogs/aws/amazon-bedrock-agentcore-adds-quality-evaluations-and-policy-controls-for-deploying-trusted-ai-agents/

https://www.aboutamazon.com/news/aws/aws-amazon-bedrock-agent-core-ai-agents

## そもそも Cedar とは

Cedar とは、AWS によって開発され、オープンソースとして公開されたポリシー言語です。AWS では本機能以外に Amazon Verified Permissions という認可サービスで利用されています。以下は公式ドキュメントです。

https://www.cedarpolicy.com/en

書き方としては，以下のようになるようです。

```json
// 太郎がVacationPhoto94.jpgを表示することを許可
permit(
    principal == User::"taro", 
    action == Action::"view", 
    resource == Photo::"VacationPhoto94.jpg" 
);
```
```json
// 次郎がVacationPhoto94.jpgを削除することを禁止
forbid( 
    principal == User::"jiro", 
    action == Action::"delete", 
    resource == Photo::"VacationPhoto94.jpg" 
);
```

## 実際に試してみる

以下手順を参考に試してみます。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-getting-started.html

なお、今回は GitHub Codespaces で実施しています。~~（本当は今回のイベント中の検証は復活した Cloud9 でやるつもりでした。）~~
Codespaces については以下を参照してください。

https://github.co.jp/features/codespaces

### Step 1：環境のセットアップ

まずは、仮想環境を作成します。

```bash
mkdir agentcore-policy-quickstart
cd agentcore-policy-quickstart
python3 -m venv .venv
source .venv/bin/activate
```

次にライブラリをインストールします。

```bash
pip install boto3
pip install bedrock-agentcore-starter-toolkit
pip install requests
pip install "botocore[crt]"
```

ついでに以下ドキュメントを参考に AWS CLI も使えるようにしておきます。

```
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/getting-started-install.html


また、以下ドキュメントを参考に`aws login --remote --profile dev`を実行します。

https://qiita.com/watany/items/ee3709aa9530d4504d46

### Step 2：セットアップスクリプトの作成

続いて、`setup_policy.py` というセットアップスクリプトを作成します。

このスクリプトでは以下が実施されます。
- OAuth 認証サーバー（Cognito）の作成
- Gateway の作成
- Lambda 関数（返金ツール）の作成
- Policy Engine の作成
- Cedar ポリシーの作成
- Gateway に Policy Engine をアタッチ

:::note warn
このまま実行すると、Python スクリプトが AWS 認証情報を見つけられず、`NoCredentialsError: Unable to locate credentials`というエラーになってしまうので環境変数を設定しておきましょう。

```
# 環境変数の設定と確認
$ export AWS_PROFILE=dev
$ echo $AWS_PROFILE
dev

# 以下コマンドでも確認
$ aws sts get-caller-identity
```
:::

```python
"""
Setup script to create Gateway with Policy Engine
Run this first: python setup_policy.py
"""

from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient
from bedrock_agentcore_starter_toolkit.operations.policy.client import PolicyClient
from bedrock_agentcore_starter_toolkit.utils.lambda_utils import create_lambda_function
import boto3
import json
import logging
import time


def setup_policy():
    # Configuration
    region = "us-west-2"
    refund_limit = 1000
    
    print("🚀 Setting up AgentCore Gateway with Policy Engine...")
    print(f"Region: {region}\n")
    
    # Initialize clients
    gateway_client = GatewayClient(region_name=region)
    gateway_client.logger.setLevel(logging.INFO)
    
    policy_client = PolicyClient(region_name=region)
    policy_client.logger.setLevel(logging.INFO)
    
    # Step 1: Create OAuth authorizer
    print("Step 1: Creating OAuth authorization server...")
    cognito_response = gateway_client.create_oauth_authorizer_with_cognito("PolicyGateway")
    print("✓ Authorization server created\n")
    
    # Step 2: Create Gateway
    print("Step 2: Creating Gateway...")
    gateway = gateway_client.create_mcp_gateway(
        name=None,
        role_arn=None,
        authorizer_config=cognito_response["authorizer_config"],
        enable_semantic_search=False,
    )
    print(f"✓ Gateway created: {gateway['gatewayUrl']}\n")
    
    # Fix IAM permissions
    gateway_client.fix_iam_permissions(gateway)
    print("⏳ Waiting 30s for IAM propagation...")
    time.sleep(30)
    print("✓ IAM permissions configured\n")
    
    # Step 3: Create Lambda function with refund tool
    print("Step 3: Creating Lambda function with refund tool...")
    
    refund_lambda_code = """
def lambda_handler(event, context):
    amount = event.get('amount', 0)
    return {
        "status": "success",
        "message": f"Refund of ${amount} processed successfully",
        "amount": amount
    }
"""
    
    session = boto3.Session(region_name=region)
    lambda_arn = create_lambda_function(
        session=session,
        logger=gateway_client.logger,
        function_name=f"RefundTool-{int(time.time())}",
        lambda_code=refund_lambda_code,
        runtime="python3.13",
        handler="lambda_function.lambda_handler",
        gateway_role_arn=gateway["roleArn"],
        description="Refund tool for policy demo",
    )
    print("✓ Lambda function created\n")
    
    # Step 4: Add Lambda target with refund tool schema
    print("Step 4: Adding Lambda target with refund tool schema...")
    lambda_target = gateway_client.create_mcp_gateway_target(
        gateway=gateway,
        name="RefundTarget",
        target_type="lambda",
        target_payload={
            "lambdaArn": lambda_arn,
            "toolSchema": {
                "inlinePayload": [
                    {
                        "name": "process_refund",
                        "description": "Process a customer refund",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "amount": {
                                    "type": "integer",
                                    "description": "Refund amount in dollars"
                                }
                            },
                            "required": ["amount"],
                        },
                    }
                ]
            },
        },
        credentials=None,
    )
    print("✓ Lambda target added\n")
    
    # Step 5: Create Policy Engine
    print("Step 5: Creating Policy Engine...")
    engine = policy_client.create_or_get_policy_engine(
        name="RefundPolicyEngine",
        description="Policy engine for refund governance"
    )
    print(f"✓ Policy Engine: {engine['policyEngineId']}\n")
    
    # Step 6: Create Cedar policy
    print(f"Step 6: Creating Cedar policy (refund limit: ${refund_limit})...")
    cedar_statement = (
        f"permit(principal, "
        f'action == AgentCore::Action::"RefundTarget___process_refund", '
        f'resource == AgentCore::Gateway::"{gateway["gatewayArn"]}") '
        f"when {{ context.input.amount < {refund_limit} }};"
    )
    
    policy = policy_client.create_or_get_policy(
        policy_engine_id=engine["policyEngineId"],
        name="refund_limit_policy",
        description=f"Allow refunds under ${refund_limit}",
        definition={"cedar": {"statement": cedar_statement}},
    )
    print(f"✓ Policy: {policy['policyId']}\n")
    
    # Step 7: Attach Policy Engine to Gateway
    print("Step 7: Attaching Policy Engine to Gateway (ENFORCE mode)...")
    gateway_client.update_gateway_policy_engine(
        gateway_identifier=gateway["gatewayId"],
        policy_engine_arn=engine["policyEngineArn"],
        mode="ENFORCE"
    )
    print("✓ Policy Engine attached to Gateway\n")
    
    # Step 8: Save configuration
    config = {
        "gateway_url": gateway["gatewayUrl"],
        "gateway_id": gateway["gatewayId"],
        "gateway_arn": gateway["gatewayArn"],
        "policy_engine_id": engine["policyEngineId"],
        "policy_engine_arn": engine["policyEngineArn"],
        "policy_id": policy["policyId"],
        "region": region,
        "client_info": cognito_response["client_info"],
        "refund_limit": refund_limit
    }
    
    with open("config.json", "w") as f:
        json.dump(config, f, indent=2)
    
    print("=" * 60)
    print("✅ Setup complete!")
    print(f"Gateway URL: {gateway['gatewayUrl']}")
    print(f"Policy Engine ID: {engine['policyEngineId']}")
    print(f"Refund limit: ${refund_limit}")
    print("\nConfiguration saved to: config.json")
    print("\nNext step: Run 'python test_policy.py' to test your Policy")
    print("=" * 60)
    
    return config


if __name__ == "__main__":
    setup_policy()
```

実行後、少し（2,3分）待って以下のようなメッセージが表示されればセットアップは完了です。

```bash
============================================================
✅ Setup complete!
Gateway URL: https://testgatewayaf825c9d-ayvwaddm2z.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp
Policy Engine ID: RefundPolicyEngine-kwtyloz4en
Refund limit: $1000

Configuration saved to: config.json

Next step: Run 'python test_policy.py' to test your Policy
============================================================
```

#### マネコンで確認

マネコンを確認すると、Policy が新しく表示されていました。

![image.png](https://images.ryu-ki-learn.com/agentcore-policy-first-try/fdbee6f2-cd5b-4373-95b7-21a24af8a7a7.png)

PolicyEngine の詳細画面はこのようになっています。

![image.png](https://images.ryu-ki-learn.com/agentcore-policy-first-try/85a81d6d-3470-473a-823d-832d4e81b739.png)

Policy の詳細画面はこのようになっています。

![image.png](https://images.ryu-ki-learn.com/agentcore-policy-first-try/d001b4cc-f712-4687-8d30-0f0af9a6bee2.png)

編集画面を開くと、以下の通り記載されています。

![image.png](https://images.ryu-ki-learn.com/agentcore-policy-first-try/e4a2f1bf-4d26-4c80-94b1-889202836ffc.png)

こちらは自然言語で生成することができるようなので、試しに日本語で同様の指示を出してみたいと思います。

![image.png](https://images.ryu-ki-learn.com/agentcore-policy-first-try/193d40de-323d-44b7-8fed-73ccfcb337a7.png)

若干かっこの数が違うところはありますが、内容としては同等に見えます。便利ですね！
個人的にはどの程度の精度で出来るのかは気になりますが、これはまた別の機会に試してみたいと思います。

### Step 3：ポリシーのテスト

では、ポリシーテストのために`test_policy.py` を作成します。

テストとしては、以下の2種類のテストが行われます。

- $500 の返金処理：ポリシーにより許可され、成功レスポンスが返る
- $2000 の返金処理：ポリシーにより拒否され、エラーレスポンスが返る

```python
"""
Test Policy Engine with direct HTTP calls to Gateway
Run after setup: python test_policy.py
"""

import json
import sys
import requests
from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient


def test_refund(gateway_url, bearer_token, amount):
    """Test a refund request - print raw response"""
    response = requests.post(
        gateway_url,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {bearer_token}",
        },
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "RefundTarget___process_refund",
                "arguments": {"amount": amount}
            },
        },
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    return response


def main():
    print("=" * 60)
    print("🧪 Testing Policy Engine")
    print("=" * 60 + "\n")
    
    # Load configuration
    try:
        with open("config.json", "r") as f:
            config = json.load(f)
    except FileNotFoundError:
        print("❌ Error: config.json not found!")
        print("Please run 'python setup_policy.py' first.")
        sys.exit(1)
    
    gateway_url = config["gateway_url"]
    refund_limit = config["refund_limit"]
    
    print(f"Gateway: {gateway_url}")
    print(f"Refund limit: ${refund_limit}\n")
    
    # Get access token
    print("🔑 Getting access token...")
    gateway_client = GatewayClient(region_name=config["region"])
    token = gateway_client.get_access_token_for_cognito(config["client_info"])
    print("✅ Token obtained\n")
    
    # Test 1: Refund $500 (should be allowed)
    print(f"📝 Test 1: Refund $500 (Expected: ALLOW)")
    print("-" * 40)
    test_refund(gateway_url, token, 500)
    print()
    
    # Test 2: Refund $2000 (should be denied)  
    print(f"📝 Test 2: Refund $2000 (Expected: DENY)")
    print("-" * 40)
    test_refund(gateway_url, token, 2000)
    print()
    
    print("=" * 60)
    print("✅ Testing complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
```

実行結果は以下の通りです。
500ドルの返金処理は成功しており、2000ドルの返金処理は拒否されていることがわかります。

このときのエラーメッセージは`"Tool Execution Denied: Tool call not allowed due to policy enforcement [Policy evaluation denied due to no determining policies]"`となるんですね。

```bash
============================================================
🧪 Testing Policy Engine
============================================================

Gateway: https://testgatewayaf825c9d-ayvwaddm2z.gateway.bedrock-agentcore.us-west-2.amazonaws.com/mcp
Refund limit: $1000

🔑 Getting access token...
2025-12-04 11:24:10,767 - bedrock_agentcore.gateway - INFO - Fetching test token from Cognito...
2025-12-04 11:24:10,767 - bedrock_agentcore.gateway - INFO -   Attempting to connect to token endpoint: https://agentcore-375ca440.auth.us-west-2.amazoncognito.com/oauth2/token
2025-12-04 11:24:11,753 - bedrock_agentcore.gateway - INFO - ✓ Got test token successfully
✅ Token obtained

📝 Test 1: Refund $500 (Expected: ALLOW)
----------------------------------------
Status Code: 200
Response Body: {
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "isError": false,
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"success\",\"message\":\"Refund of $500 processed successfully\",\"amount\":500}"
      }
    ]
  }
}

📝 Test 2: Refund $2000 (Expected: DENY)
----------------------------------------
Status Code: 200
Response Body: {
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32002,
    "message": "Tool Execution Denied: Tool call not allowed due to policy enforcement [Policy evaluation denied due to no determining policies]"
  }
}

============================================================
✅ Testing complete!
============================================================
```

### Step 4：おそうじ

一旦一通り確認できたので、おそうじのために、`cleanup_policy.py` を作成して実行します。（と書いたものの、筆者はもう少し遊びたいのでまだ実行していません）

```python
"""
Cleanup script to remove Gateway and Policy Engine resources
Run this to clean up: python cleanup_policy.py
"""

from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient
from bedrock_agentcore_starter_toolkit.operations.policy.client import PolicyClient
import json


def cleanup():
    with open("config.json", "r") as f:
        config = json.load(f)
    
    # Clean up Policy Engine first
    print("🧹 Cleaning up Policy Engine...")
    policy_client = PolicyClient(region_name=config["region"])
    policy_client.cleanup_policy_engine(config["policy_engine_id"])
    print("✓ Policy Engine cleaned up\n")
    
    # Then clean up Gateway
    print("🧹 Cleaning up Gateway...")
    gateway_client = GatewayClient(region_name=config["region"])
    gateway_client.cleanup_gateway(config["gateway_id"], config["client_info"])
    print("✅ Cleanup complete!")


if __name__ == "__main__":
    cleanup()  
```

## おわりに

以上、ほぼドキュメントをなぞっただけレベルですが、Policy機能を試してみました。個人的には自然言語からのポリシー生成に注目していて、本当に意図したポリシーを正しく作れているのか？をもう少し深堀したいなと考えています。
とはいうものの、そもそもあまり Gateway を使いこなしているわけでもないので、まずはそこから理解を深めていきたいと思います。
ありがとうございました。
