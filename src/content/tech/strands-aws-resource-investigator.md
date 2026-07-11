---
title: "【Strands Agents】AWSリソース調査エージェントをサクッと作ってみる"
description: "本記事では、Strands Agentsを使ったマルチエージェント構成の実装方法と、実際に動かしてみた様子を書きたいと思います。"
pubDate: 2025-08-25
updatedDate: 2025-08-26
tags: ['生成AI', 'AIエージェント', 'StrandsAgents']
qiitaId: 0997181fe16e79de1666
importedDate: 2026-07-11
qiitaStats:
  views: 6116
  likes: 5
  stocks: 2
  fetchedAt: 2026-07-11
---

## はじめに
少し前にLangChain・LangGraphを使ったAIエージェントの実装をして以来、しばらく情報をキャッチアップできていませんでした。そこで遅ればせながらStrands Agentsを使ったエージェント実装をしてみたいと思います。

本記事では、Strands Agentsを使ったマルチエージェント構成の実装方法と、実際に動かしてみた様子を書きたいと思います。

## Strands Agentsとは
Strands Agentsは、AIエージェントを簡単に構築できるAWS産のPython SDKです。とても簡単にエージェントを作成できることが特徴かと思います。雰囲気をつかむ際はこちらの記事が参考になりますので是非ご覧ください。

https://qiita.com/minorun365/items/dd05a3e4938482ac6055

Strands Agentsの詳細は以下リンクをご覧ください。

https://strandsagents.com/latest/

https://aws.amazon.com/jp/blogs/news/introducing-strands-agents-an-open-source-ai-agents-sdk/

## 今回作ってみるもの
今回は、AWSに関する質問に答えてくれる「AWSリソース調査エージェント」を作成します。

### 構成
簡単ではありますが、今回は以下のような構成を作りたいと思います。

![image.png](https://images.ryu-ki-learn.com/strands-aws-resource-investigator/12541767-60ee-47bc-9af7-70a530840017.png)


### 各エージェントの役割

#### スーパーバイザーエージェント（supervisor）
- ユーザーの質問を解析し、適切な子エージェントに振り分ける
- 子エージェントからの回答を統合し、Markdownレポートを生成する

#### AWS操作エージェント（aws_operator）
- 実際のAWSアカウントにアクセスし、リソース情報を取得
- S3バケット一覧、EC2インスタンス情報などの実データを提供

#### AWS情報調査エージェント（aws_investigator）
- AWSドキュメントから情報を検索・取得
- サービスの特徴、ベストプラクティス、料金体系などの一般的な情報を提供

## 早速実装してみる
### 事前準備
必要なライブラリを追加しておきましょう。

```bash:ターミナル
uv add strands-agents strands-agents-tools
```

AWSの認証設定なども実施しておく必要があります。

### AWS操作を行うエージェント
まずは、Strands Agentsの組み込みツールである`use_aws`を使ってAWSのリソース状況を調査する子エージェントを作ってみました。

なお、組み込みツールの詳細については以下をご覧ください。

https://github.com/strands-agents/tools

```py
from strands import Agent, tool
from strands.models import BedrockModel
from strands_tools import use_aws

bedrock_model = BedrockModel(
    model_id="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    region_name='us-west-2'
)

@tool
def aws_operator(query: str) -> str:
    """AWS操作を実行するエージェント"""
    try:
        agent = Agent(
            system_prompt="""
            あなたはAWSリソース操作の専門家エージェントです。
            use_awsツールを使用して実際のAWSリソース情報を取得・操作してください。
            
            ## 重要な制約
            - 安全性のため、読み取り専用の操作を基本とする
            - 破壊的操作は実行前に必ず確認する
            - デフォルトリージョン: us-east-1
            
            質問以上の回答をする必要はありません。簡潔に回答してください。
            """,
            model=bedrock_model,
            tools=[use_aws],
            callback_handler=None
        )
        response = agent(query)
```

### AWS情報を調査するエージェント
続いて、AWSドキュメントから情報を取得する子エージェントを作ってみました。こちらはAWS Documentation MCP Serverを利用しています。MCPサーバーの詳細については以下リンクをご覧ください。

https://awslabs.github.io/mcp/servers/aws-documentation-mcp-server/

```py
from strands import Agent, tool
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

bedrock_model = BedrockModel(
    model_id="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    region_name='us-west-2'
)

documentation_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    )
))

@tool
def aws_investigator(query: str) -> str:
    """AWS情報を調査するエージェント"""
    with documentation_mcp_client:
        try:
            agent = Agent(
                system_prompt="""
                あなたはAWSのエキスパートです。
                ユーザーの質問に対して、aws-documentation-mcp-serverを利用して、
                正確で実用的なAWS情報を日本語で提供してください。
                質問以上の回答をする必要はありません。簡潔に回答してください。
                """,
                model=bedrock_model,
                callback_handler=None
            )
            response = agent(query)
```

### スーパーバイザーエージェント
そして、作成した2つの子エージェントの親となるスーパーバイザーエージェントを作りました。今回は子エージェントをツールのように呼び出す実装をしています。

```py
supervisor = Agent(
    system_prompt="""
    あなたはAWS調査システムのスーパーバイザーです。
    質問の内容に応じて最適なツールを選択し、日本語の回答を作成してください。
    
    利用可能なツール：
    - aws_investigator: 一般的なAWSサービス情報、設定、機能について
    - aws_operator: 実際のAWSリソース操作、リソース情報取得について
    - file_write: レポート作成時に利用

    回答後、file_write を利用して、Markdown形式の簡潔なレポートを作成してください。
    """,
    model=bedrock_model,
    tools=[aws_investigator, aws_operator, file_write, think]
)
```

## 実行してみる
### AWS操作を行うエージェント
S3バケットの情報を確認してもらいました。意図通り、AWS操作を行うエージェント（aws_operator）を呼び出していることがわかります。

![image.png](https://images.ryu-ki-learn.com/strands-aws-resource-investigator/64180d9c-b92c-405a-a756-7ae1d900d88a.png)

以下は作成されたレポートです。指示通りMarkdown形式で出力してくれています。
<details><summary>S3バケット一覧レポート（長いので折り畳み）</summary>

```md
# S3バケット一覧レポート

## 概要
AWSアカウント上に存在するS3バケットの一覧です。現在、合計7つのS3バケットが確認されています。

## バケット一覧

| No. | バケット名 | 作成日 |
|-----|------------|--------|
| 1 | aws-cloudtrail-logs | 2025-03-10 |
| 2 | cdk-hnb659fds-assets | 2025-06-29 |
| 3 | duckdb-athena | 2025-04-12 |
| 4 | duckdb-demo-qiita | 2025-04-15 |
| 5 | qiita-article-content | 2025-03-18 |
| 6 | qiita-manager-website | 2025-06-29 |
| 7 | qiitamanagerfrontendstack-qiitamanagerdistribution | 2025-06-29 |

## バケット用途の推測

バケット名から以下のような用途が推測されます：

- CloudTrail用のログバケット
- AWS CDK関連のアセットバケット
- DuckDBデモ用のバケット
- Qiita関連のコンテンツバケット

## 備考
より詳細な情報（アクセス権限、バケットポリシー、ライフサイクルルールなど）が必要な場合は、個別のバケットに対して詳細調査を実施してください。
```

</details>

### AWS情報を調査するエージェント
S3の特徴について質問してみました。こちらも意図通り、AWS情報を調査するエージェント（aws_investigator）を呼び出していることがわかります。

![image.png](https://images.ryu-ki-learn.com/strands-aws-resource-investigator/9f8a6563-e8e2-4eb2-9422-81ee0aabef03.png)

以下は作成されたレポートです。こちらも指示通りMarkdown形式で出力してくれています。
<details><summary>Amazon S3 調査レポート（長いので折り畳み）</summary>

```md
# Amazon S3（Simple Storage Service）の特徴

## 基本情報
Amazon S3はAWSが提供するオブジェクトストレージサービスです。高い耐久性と可用性を備え、様々なユースケースに対応できる柔軟なストレージソリューションです。

## 主な特徴

### 1. 高い耐久性と可用性
- 99.999999999%（11ナイン）の耐久性
- 99.99%の可用性を提供
- データを複数の施設にわたって冗長に保存

### 2. 多様なストレージクラス
- **Standard**: 頻繁にアクセスされるデータ向け
- **Intelligent-Tiering**: アクセスパターンが変化するデータ向け
- **Standard-IA**: アクセス頻度が低いデータ向け
- **One Zone-IA**: 重要度の低いデータ向け（単一AZ）
- **Glacier**: 長期アーカイブ向け
- **Glacier Deep Archive**: 最も低コストな長期アーカイブ向け

### 3. 優れたスケーラビリティ
- 自動的に拡張・縮小
- データ量に関係なく高いパフォーマンスを維持
- リクエスト処理能力も自動的にスケール

### 4. 強固なセキュリティ機能
- IAMポリシー
- バケットポリシー
- アクセスコントロールリスト（ACL）
- サーバーサイド暗号化オプション
- クライアントサイド暗号化サポート

### 5. 高度なデータ管理
- ライフサイクルポリシー（自動でストレージクラスを移行）
- バージョニング（データの上書き保護）
- クロスリージョンレプリケーション
- イベント通知

### 6. コスト効率
- データアクセスパターンに最適なストレージクラスを選択可能
- 支払いは実際に使用した分のみ
- ライフサイクルポリシーによるコスト最適化

## 主なユースケース
- バックアップと復元
- データレイクの構築
- コンテンツ配信
- 静的ウェブサイトホスティング
- ビッグデータ分析
- データアーカイブ
- クラウドネイティブアプリケーション

## 他のAWSストレージサービスとの違い
- **EBS**: EC2インスタンスにアタッチする高性能ブロックストレージ
- **EFS**: 複数のEC2インスタンスから同時にアクセスできるフルマネージド型NFS
- **FSx**: Windows、Lustre、NetApp ONTAPなどのファイルシステム向けサービス
- **Storage Gateway**: オンプレミスとAWSの統合ハイブリッドストレージ

S3はオブジェクトストレージであり、無制限のスケーラビリティを実現する一方、他のサービスはブロックストレージやファイルシステムとして異なるユースケースに対応しています。

## 料金体系
S3の料金は以下の要素で構成されています：

1. **ストレージ使用量**（ストレージクラスごとに異なる料金）
2. **リクエスト料金**（PUT、COPY、POST、LIST、GETなど）
3. **データ転送料金**（取り出しやリージョン間転送）
4. **管理機能と分析機能**（S3 Select、アクセスグラントなど）

料金はリージョンによって異なり、データ量が多いほど単価が安くなる段階的な料金体系になっている場合もあります。
```

</details>


## おわりに
簡単ではありますが、AWSリソース調査エージェントをサクッと作ってみました。コードとしてはとてもシンプルなので、一度書き方がわかれば比較的難しくないのかなと感じています。

一方で、本格的に本番運用するためには、エラーハンドリング、パフォーマンス最適化、セキュリティ対策など、さらなる知識が必要かと思います。

これからも情報をキャッチアップしていき面白いエージェントを作れたらいいなと思っています。また、Amazon Bedrock AgentCoreなどにも触れて、作ったエージェントをどうデプロイするのかといったところの知識も深めていきたいと思います。

ありがとうございました。
