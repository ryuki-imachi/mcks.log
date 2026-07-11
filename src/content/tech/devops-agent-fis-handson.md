---
title: "【DevOps Agent】AWS DevOps Agent にサクッと入門してみよう ～AWS DevOps Agent × FIS ハンズオン～"
description: "AWS DevOps Agent について、使ったことのなかった FIS と組み合わせて試してみたいと思いましたので、ハンズオン記事を書いてみました。なお、AWSには以下のようなハ…"
pubDate: 2026-01-26
updatedDate: 2026-02-12
tags: ['AWS', 'AWSFIS', 'DevOpsAgent']
qiitaId: 6420687a34ce2a562f7d
importedDate: 2026-07-11
qiitaStats:
  views: 7385
  likes: 9
  stocks: 6
  fetchedAt: 2026-07-11
---

## はじめに

AWS DevOps Agent について、使ったことのなかった FIS と組み合わせて試してみたいと思いましたので、ハンズオン記事を書いてみました。なお、AWSには以下のようなハンズオン記事もありますので、こちらで試していただくこともできます。

https://docs.aws.amazon.com/devopsagent/latest/userguide/getting-started-with-aws-devops-agent.html

:::note
筆者が一通り確認しましたが、不備などありましたらご連絡いただけますと幸いです。
:::

:::note
プレビュー中のため、動作が不安定なことが想定されます。ご了承ください。
:::

### この記事で学ぶこと

- AWS DevOps Agent の基本的な使い方
- AWS Fault Injection Service (FIS) を使った障害注入の方法
- AI エージェントによるインシデント調査の流れ
- 緩和策（Mitigation Plan）と予防策（Prevention）の活用方法

### 前提条件

- GitHub アカウント
- AWS アカウント（ブラウザでマネジメントコンソールにログイン済み）
- 以下の権限を持つ IAM ユーザーまたはロール
  - CloudFormation の作成・削除
  - EC2, VPC, IAM の作成・削除
  - FIS の実験作成・実行
  - CloudWatch アラームの作成・削除
  - DevOps Agent のエージェントスペース作成
  - `signin:AuthorizeOAuth2Access` / `signin:CreateOAuth2Token`（aws login 用）

ここから、今回使うサービスについて簡単に説明します。

:::note
ハンズオンだけやりたいという方は「**5. 環境構築**」までスキップしてください。
:::

## 1. AWS DevOps Agent とは

### 1-1. サービス概要

AWS DevOps Agent は、re:Invent 2025 で発表された Frontier Agent の1つです。

インシデント発生時に、（経験豊富な DevOps エンジニアのように）自律的に調査を行い、根本原因の特定から緩和策の提案まで支援することができます。

https://aws.amazon.com/jp/devops-agent/

### 1-2. 主な機能（できること）

| 機能カテゴリ           | できること                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **インシデント調査** | アラートやチケットを起点に自動で調査開始、メトリクス・ログ・トレースを横断的に分析、仮説を立てて検証を繰り返す、根本原因（Root Cause）を特定 |
| **緩和策の提案**     | 具体的な復旧手順をステップ形式で提示、CLI コマンドやコンソール操作手順を含む、ロールバック手順も提供                                 |
| **インシデント予防** | 過去のインシデントパターンを分析、オブザーバビリティ改善の提案、インフラ構成の改善提案、デプロイパイプラインの改善提案                  |
| **チーム連携**       | Slack チャンネルへの通知、ServiceNow チケットの自動更新、調査の進捗をリアルタイム共有                                              |

### 1-3. アーキテクチャの主要コンポーネント

#### エージェントスペース (Agent Space)

DevOps Agent がアクセスできる範囲を定義する論理的なコンテナです。
AWS アカウント、外部ツール連携、ユーザーアクセス権限を管理します。

#### トポロジー (Topology)

AWS アカウント内のリソースとその関係性を自動検出します。
調査時のコンテキストとして活用され、EC2、Lambda、ECS、RDS、API Gateway など主要サービスをマッピングします。

#### Web アプリ

オペレーター向けのインターフェースです。
調査の開始、進捗確認、チャットでの対話が可能です。
AWS マネジメントコンソールとは別の専用 URL でアクセスします。

### 1-4. 連携可能なサービス
以下のような多様なサービスと連携することができます。

#### オブザーバビリティツール

- Amazon CloudWatch（メトリクス、ログ、アラーム）
- AWS X-Ray（トレース）
- Datadog / Dynatrace / New Relic / Splunk

#### ソースコード・CI/CD

- GitHub / GitHub Actions
- GitLab / GitLab CI/CD

#### インシデント管理・コラボレーション

- ServiceNow
- PagerDuty（Webhook 経由）
- Slack

#### 拡張性

- MCP (Model Context Protocol) サーバーによるカスタムツール統合

## 2. AWS FIS とは

### 2-1. カオスエンジニアリングの概要

カオスエンジニアリングは、本番環境で発生しうる障害をあらかじめシミュレーションし、システムの回復力（レジリエンス）を検証・改善する手法です。

AWS Fault Injection Service (FIS) は、AWS が提供するフルマネージドのカオスエンジニアリングサービスです。

https://aws.amazon.com/jp/fis/

### 2-2. 主な機能

| 機能                     | 説明                                                       |
| ------------------------ | ---------------------------------------------------------- |
| 事前定義されたアクション | CPU 負荷、メモリ負荷、ネットワーク遅延、インスタンス停止など |
| 安全機構                 | Stop Condition（CloudWatch Alarm）による自動停止            |
| SSM 連携                 | Systems Manager Agent 経由でインスタンス内部に障害を注入     |
| 実験テンプレート         | 再現可能な実験を定義・管理                                   |

## 3. コストについて

### 3-1. AWS DevOps Agent

プレビュー期間中は無料で利用可能です。
ただし、月間のエージェントタスク時間に制限があります。

:::note warn
DevOps Agent 自体は無料でも、調査対象となる CloudWatch Logs の取得や、連携する外部ツールの利用にはそれぞれの料金が発生します。
:::

### 3-2. AWS FIS

FIS は **アクションの実行時間** に対して課金されます。

| 項目               | 料金（us-east-1）        |
| ------------------ | ------------------------ |
| アクション実行時間 | 0.10ドル / アクション分  |

例：CPU Stress を 5 分間実行した場合 → 0.10ドル × 5 分 = **0.50ドル**

https://aws.amazon.com/jp/fis/pricing/

### 3-3. その他のリソース

| リソース           | 概算コスト（ハンズオン実施時間を1時間と想定）  |
| ------------------ | ---------------------------------------------- |
| EC2 (t3.micro)     | 約 0.01ドル                                       |
| CloudWatch Alarm   | 約 0.10ドル / アラーム / 月（最初の10個は無料）   |
| CloudWatch Logs    | 取り込み: 0.50ドル/GB、保存: 0.03ドル/GB/月          |
| VPC / Subnet など  | 無料                                           |

ハンズオン全体の想定コスト: 1〜2ドル程度

:::note warn
ハンズオン終了後は後述のスクリプトを実行して、**必ずリソースを削除してください**。EC2 を起動したまま**放置すると、継続的に課金されます**。
:::

## 4. ハンズオンの全体像

### 4-1. 構成図
今回は以下のようなシンプルな構成でハンズオンを行います。（構成図は Claude Code に作ってもらいました）

![architecture.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/f8d43787-c2f9-431c-9ef4-0457c2b5ac4c.png)

### 4-2. 作成するリソース一覧

| リソース                | 名前                               | 用途                           |
| ----------------------- | ---------------------------------- | ------------------------------ |
| VPC                     | devops-agent-handson-vpc           | EC2 用ネットワーク             |
| Internet Gateway        | devops-agent-handson-igw           | インターネット接続（SSM 用）   |
| Public Subnet           | devops-agent-handson-subnet        | EC2 配置用                     |
| Route Table             | devops-agent-handson-rtb           | ルーティング                   |
| Security Group          | devops-agent-handson-sg            | EC2 用（アウトバウンドのみ許可）|
| IAM Role (EC2用)        | devops-agent-handson-ec2-role      | SSM Agent 用                   |
| IAM Instance Profile    | devops-agent-handson-ec2-profile   | EC2 にロールをアタッチ         |
| EC2 Instance            | devops-agent-handson-ec2           | CPU 負荷をかける対象           |
| IAM Role (FIS用)        | devops-agent-handson-fis-role      | FIS 実験実行用                 |
| FIS Experiment Template | devops-agent-handson-cpu-stress    | CPU Stress 実験                |
| CloudWatch Alarm        | devops-agent-handson-cpu-alarm     | CPU 高負荷検知                 |

### 4-3. ハンズオンの流れ
今回実施するハンズオンは以下のような流れで実施します。

:::note
全体通しても1時間かからない想定です。
:::

```
1. セットアップスクリプトでリソースを作成
        ↓
2. DevOps Agent エージェントスペースを作成
        ↓
3. トポロジーで EC2 が検出されていることを確認
        ↓
4. FIS 実験を開始して CPU 負荷を発生させる
        ↓
5. CloudWatch Alarm が発火することを確認
        ↓
6. DevOps Agent Web アプリで調査を開始
        ↓
7. 調査結果・根本原因を確認
        ↓
8. 緩和策（Mitigation Plan）を生成
        ↓
9. 予防策（Prevention）を確認
        ↓
10. クリーンアップ
```

## 5. 環境構築

:::note
もし、Cloud9 を利用できる環境であれば、5-1, 5-2 はスキップすることができます。
:::

### 5-1. GitHub Codespaces の準備

任意のリポジトリで Codespaces を起動するか、空のリポジトリを作成して Codespaces を起動します。

### 5-2. AWS CLI の設定（aws login）

AWS CLI v2.32.0 以降で追加された `aws login` コマンドを使用します。ブラウザでログイン中の AWS 認証情報を使って、CLI 用の短期クレデンシャルを簡単に取得できます。

```bash
# AWS CLI のインストール

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# AWS CLI のバージョン確認（v2.32.0 以上が必要）

aws --version
```

```bash
# aws login でプロファイルを作成
# --remote: CLI とブラウザが異なる環境の場合に必要（Codespaces では必須）

aws login --remote
```

実行すると以下のような URL が表示されます。

```
$ aws login --remote
No AWS region has been configured. The AWS region is the geographic location of your AWS resources.

If you have used AWS before and already have resources in your account, specify which region they were created in. If you have not created resources in your account before, you can pick the region closest to you: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html.

You are able to change the region in the CLI at any time with the command "aws configure set region NEW_REGION".
AWS Region [us-east-1]:
Browser will not be automatically opened.
Please visit the following URL:

https://us-east-1.signin.aws.amazon.com/v1/...

Enter the authorization code displayed in your browser:
```

1. 表示された URL をクリック
2. ブラウザで AWS にログイン済みの認証情報を選択
3. 認証成功後、「Verification Code」が表示される（ここで少し待たされるかもしれません）
4. コードをコピーしてターミナルに貼り付け

![image.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/6a4ef7e9-c717-4f15-9085-8aa0dac10717.png)


```bash
# 接続確認

aws sts get-caller-identity
```

アカウント ID とユーザー情報が表示されれば OK です。

:::note
`aws login` についての詳細は以下ドキュメントをご参照ください。
:::

https://docs.aws.amazon.com/ja_jp/signin/latest/userguide/command-line-sign-in.html

### 5-3. ハンズオン環境のセットアップ

ハンズオン用のリポジトリをクローンして、セットアップスクリプトを実行します。

https://github.com/ryuki-imachi/devops-agent-handson

リポジトリの構造は以下の通りです。

```
devops-agent-handson/
├── README.md              # 使い方・リソース一覧
├── setup.sh               # 環境構築スクリプト
├── start-experiment.sh    # FIS 実験開始スクリプト
├── cleanup.sh             # クリーンアップスクリプト
├── template.yaml          # CloudFormation テンプレート
└── architecture.drawio    # アーキテクチャ図（draw.io 形式）
```

```bash
# リポジトリをクローン

git clone https://github.com/ryuki-imachi/devops-agent-handson.git
cd devops-agent-handson

# セットアップスクリプトを実行（3〜5分かかります）

chmod +x setup.sh
./setup.sh
```

セットアップが完了すると、作成されたリソースの一覧が表示されます。

なお、マネジメントコンソールからもスタックが作成されていることが分かります。


### 5-4. リソースの確認

:::note
筆者の環境で、複数行のコマンドをうまく実行できなかったため、本ハンズオンではコマンドを1行で記述しています。
:::

```bash
# EC2 インスタンスの状態確認

aws ec2 describe-instances --filters "Name=tag:Name,Values=devops-agent-handson-ec2" --query 'Reservations[].Instances[].[InstanceId,State.Name]' --region us-east-1 --output table

# InstanceId と "running" が表示されれば OK
```

```bash
# SSM マネージドインスタンスの確認

aws ssm describe-instance-information --region us-east-1 --query 'InstanceInformationList[].[InstanceId,PingStatus]' --output table

# PingStatus が "Online" であれば OK
# ※ 反映まで 2〜3 分かかる場合があります
```

```bash
# CloudWatch アラームの確認

aws cloudwatch describe-alarms --alarm-names devops-agent-handson-cpu-alarm --region us-east-1 --query 'MetricAlarms[].[AlarmName,StateValue]' --output table

# StateValue が "OK" であれば準備完了
```

## 6. AWS DevOps Agent のセットアップ

:::note
見た感じ公式では日本語訳はなさそうでした。
:::

### 6-1. エージェントスペースの作成

1. AWS マネジメントコンソールで「DevOps Agent」を検索して開く
2. 「Begin setup」をクリック
3. 以下を入力
   - **Agent Space Name**：`handson-agent-space`
   - **Description**：`FIS連携ハンズオン用`
4. **Give this Agent Space AWS resource access**
   - 「Auto-create a new AWS DevOps Agent role」を選択
5. **Enable web app**
   - 「Auto-create a new AWS DevOps Operator role」を選択
6. 「Create」をクリック

![image.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/0656f249-8c1f-4c64-9d42-1fcd6e75e5be.png)

![スクリーンショット 2026-01-22 18.10.14.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/e16dcc83-237d-435d-8603-437afe583565.png)

![スクリーンショット 2026-01-22 18.16.18.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/ac50eb69-d725-4c18-96ff-afd58d2db6be.png)

作成には数十秒かかります。

### 6-2. トポロジーの確認

エージェントスペース作成後、「Topology」タブを開きます。

1. 「Topology graph」タブをクリック
2. `us-east-1` のエリアに以下が表示されていることを確認
   - EC2 インスタンス（devops-agent-handson-ec2）
   - VPC / Subnet などのネットワークリソース

![スクリーンショット 2026-01-22 18.19.24.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/2bf696c1-1970-49b7-a855-6f26d26b5f54.png)

:::note
トポロジーの反映には数分かかる場合があります。
:::

### 6-3. Web アプリへのアクセス

1. エージェントスペースの画面で「Operator access」をクリック
2. 新しいタブで DevOps Agent Web アプリが開く
3. 以下のタブがあることを確認
   - **DevOps Center**：トポロジーを確認する画面
   - **Incident Response**：インシデント調査を行う画面
       - （Web アプリを開くと最初はこのタブが開かれていました）
   - **Prevention**：予防策を確認する画面

![image.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/97bae1ec-3ac7-4be5-add2-aec8beda0f1f.png)

## 7. 障害注入と調査の実践

### 7-1. FIS 実験の開始

FIS 実験を開始する方法は2つあります。お好みの方法を選んでください。

#### 方法 A: スクリプトで実行

```bash
chmod +x start-experiment.sh
./start-experiment.sh
```

#### 方法 B: マネジメントコンソールから実行

1. AWS マネジメントコンソールで「FIS」を検索して開く
2. 左メニューの「実験テンプレート」をクリック
3. `devops-agent-handson-cpu-stress` を選択（CloudFormation で作成済）
4. 「実験を開始」をクリック
5. 確認画面で「開始」を入力

![スクリーンショット 2026-01-22 18.25.37.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/d9fd5946-6445-4b8d-a7d2-896e95da96cd.png)

![image.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/9b5f31a2-6410-4086-ad6d-7cc82cc6a2a6.png)

実験が開始されると、EC2 インスタンスに 5 分間の CPU 負荷がかかります。


### 7-2. CloudWatch アラームの発火確認

```bash
# アラームの状態を監視（1〜2分で ALARM になる）

watch -n 10 "aws cloudwatch describe-alarms --alarm-names devops-agent-handson-cpu-alarm --region us-east-1 --query 'MetricAlarms[].[AlarmName,StateValue]' --output table"

# StateValue が "ALARM" に変わったら Ctrl+C で終了
```

一度だけ確認する場合は以下のコマンドを実行してください。

```bash
aws cloudwatch describe-alarms --alarm-names devops-agent-handson-cpu-alarm --region us-east-1 --query 'MetricAlarms[].[AlarmName,StateValue]' --output table
```

### 7-3. DevOps Agent による調査の開始

1. DevOps Agent Web アプリを開く
2. 「Incident Response」タブをクリック
3. 「Start investigation」をクリック
4. 以下を入力する
   - **Investigation details**
     ```
     Investigate the CloudWatch alarm devops-agent-handson-cpu-alarm in ALARM state
     ```
   - **Investigation starting points**：「Latest alarms」を選択
   - **Incident date and time**：現在時刻を入力（デフォルトで入力されているはず）
5. **Name your investigation**：`cpu-stress-investigation`
6. 「Start investigation」をクリック

![image.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/4f7a2318-ad68-4779-bb7c-8038e570b31d.png)

### 7-4. 調査タイムラインの観察

調査が開始されると、「Investigation timeline」に進捗が表示されます。

DevOps Agent は以下のような手順で調査を進めます。

1. **User Request**：調査要求の確認
2. **Alarm context**：アラームの状態・履歴を確認
3. **Metric analysis**：CPUUtilization メトリクスを分析
4. **Resource investigation**：EC2 インスタンスの設定を確認
5. **Log analysis**：システムログを確認
6. **Finding**：発見事項をまとめる
7. **Root cause**：根本原因を特定

![image.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/fe1ad1d8-11d3-4c4b-a708-2a804eaedf8c.png)

:::note
調査完了まで 10〜15 分程度かかります。
:::

### 7-5. 根本原因の確認

調査が完了すると、「Root cause」が表示されます。

期待される結果は以下の通りです。
- EC2 インスタンスの CPU 使用率が異常に高い
- FIS による CPU Stress テストが原因
- SSM Agent 経由で AWSFIS-Run-CPU-Stress ドキュメントが実行された

![スクリーンショット 2026-01-22 18.42.38.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/f2d00530-7808-4478-a7df-3cb782f50665.png)

概ね期待通りになっていそうですね。

また、「Go to root cause」をクリックすると、詳細なサマリーが表示されます。

![image.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/4149cce2-a86f-4c04-8672-ab2509425409.png)

## 8. 緩和策・予防策の確認

### 8-1. Mitigation Plan の生成

1. root cause のページで「Generate mitigation plan」をクリック
2. 1〜2 分で緩和策が生成される
3. 「Mitigation Plan」タブで内容を確認

緩和策の例は以下の通りです。
- FIS 実験を停止するコマンド
- EC2 インスタンスの CPU 使用率を監視する追加アラームの設定
- インスタンスタイプの変更（より大きいインスタンスへ）
- Auto Scaling の設定

### 8-2. Prevention の実行

1. Web アプリ上部の「Prevention」タブをクリック
2. 「Run now」をクリック
3. 数分後に予防策が生成される

予防策の例は以下の通りです。
- CPU 使用率のしきい値を段階的に設定（Warning / Critical）
- CloudWatch Logs への詳細メトリクス送信の有効化
- Auto Scaling グループの導入提案
- インスタンスのサイジング見直し

今回のハンズオンでは、おそらくFISの仕業だとバレているからか、特に予防策の提示はありませんでした...（ここの体験ができるような方法を今後考えてみたいと思います）

:::note warn
以下リンクの通り、CFn で作成されたリソースは エージェントに認識されてしまいますが、CFn で作成していないリソースに関してはタグを使って認識させる仕組みになっています。これを利用して、FIS を手動で作成すればバレないようにできるかもしれません。
:::

https://docs.aws.amazon.com/devopsagent/latest/userguide/getting-started-with-aws-devops-agent-creating-an-agent-space.html

![スクリーンショット 2026-01-22 18.52.27.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/7b49ec69-8052-4664-af2e-5eb96b4bc59e.png)

---

## 9. クリーンアップ

### 9-1. DevOps Agent エージェントスペースの削除

AWS マネジメントコンソールで DevOps Agent を開き、エージェントスペース `handson-agent-space` を削除します。

![スクリーンショット 2026-01-22 19.09.30.png](https://images.ryu-ki-learn.com/devops-agent-fis-handson/a17e1da9-e227-46b4-848f-44c29bf279d3.png)

:::note
自動作成された IAM ロールも一緒に削除されます。
:::

### 9-2. AWS リソースの削除

ハンズオン用リポジトリのディレクトリでクリーンアップスクリプトを実行します。

:::note warn
ここまでで、認証が切れている可能性が非常に高いので `aws login --remote` を再実行しておきましょう。
:::

```bash
cd devops-agent-handson

chmod +x cleanup.sh
./cleanup.sh
```

「すべてのリソースが削除されました」と表示されれば完了です。

## まとめ

### 学んだこと
今回のワークを通じて以下のようなことを体験・学べていれば幸いです。

1. **AWS DevOps Agent** は、インシデント調査を自律的に行う AI エージェント
2. **AWS FIS** を使うことで、再現可能で制御された障害を注入できる
3. FIS で障害を発生 → CloudWatch Alarm 発火 → DevOps Agent が調査という**エンドツーエンドの流れ**を体験
4. 緩和策（Mitigation Plan）と予防策（Prevention）で、**復旧と再発防止**の両方をサポート

### 次のステップ
より理解を深めたい場合は以下のようなことを試してみるとよいかと思います。

- Slack 連携を設定して、調査の進捗をリアルタイムで共有
- ServiceNow や PagerDuty と連携して、チケットから自動調査を開始
- GitHub/GitLab 連携で、デプロイ起因の障害を特定
- MCP サーバーでカスタムツールを統合

## おわりに
シンプルではありましたが、一通りハンズオンを行ってみました。お疲れ様でした。
このハンズオンで全ての機能を余すことなく確認することはできていませんが、触ってみるきっかけになれば幸いです。

私も何かあったときに活用できるように、プレビュー期間中に色々調べてみたり触ってみたりして理解を深められるといいなと思います。

ありがとうございました。
