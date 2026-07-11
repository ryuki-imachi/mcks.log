---
title: "【OpenTelemetry】OpenTelemetry Demo で遊んでみよう（ローカル × CloudWatch × DevOps Agent 編）"
description: "前回の記事では、OpenTelemetry Demo をローカルで起動し、Feature Flag で障害を注入して Jaeger・Grafana・OpenSearch で原因を追…"
pubDate: 2026-03-02
updatedDate: 2026-03-04
tags: ['AWS', 'OpenTelemetry', 'DevOpsAgent']
qiitaId: e90d3b9b90dcaf17e1f4
importedDate: 2026-07-11
qiitaStats:
  views: 1101
  likes: 2
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

前回の記事では、OpenTelemetry Demo をローカルで起動し、Feature Flag で障害を注入して Jaeger・Grafana・OpenSearch で原因を追いかける体験をしました。

https://qiita.com/ryu-ki/items/cf5d325b172a28c6cdde

手動で3つのツールを巡回して障害原因を特定できましたが、サービス数が増えるほど大変になりそうという課題も感じました。そこで今回は、同じローカル環境のテレメトリデータを AWS（CloudWatch / X-Ray）に送信し、AWS DevOps Agent に障害の分析を任せてみます。

### 今回のゴール

ローカルの OTel Demo から CloudWatch / X-Ray にデータを送信し、DevOps Agent に障害の分析を依頼します。前回の手動分析と比較して、DevOps Agent がどこまで分析できるかを確認するのがゴールです。

### 前提条件

- 前回の記事の環境構築が完了していること
- AWS アカウントがあり、AWS CLI v2 が設定済みであること
- AWS SSO（IAM Identity Center）でログインできること
- Docker / Docker Compose が使えること

### 構成イメージ

![otel-devops-architecture-2.png](https://images.ryu-ki-learn.com/otel-demo-cloudwatch-devops-agent/4667da25-fea5-41a4-b6ec-7a7b27f4059e.png)

前回のローカル観測基盤はそのまま残しつつ、AWS への送信を並行で追加する形になっています。OTel Collector のパイプラインに exporter を足すだけで、データの送信先を柔軟に増やせるのは便利ですね。

## AWS DevOps Agent とは

AWS DevOps Agent は、re:Invent 2025 で発表されたインシデント解決・予防を自動化する AI エージェントです。DevOps エンジニアのようにリソース関係を学習し、テレメトリ・コード・デプロイメントデータを横断的に分析して根本原因を特定してくれます。

https://docs.aws.amazon.com/devopsagent/latest/userguide/what-is.html

今回は Agent Space を作成し、DevOps Agent の UI から手動で調査を依頼します。DevOps Agent は Agent Space に紐づいた AWS アカウントの CloudWatch / X-Ray のテレメトリを自動的に参照して分析してくれます。

:::note warn
DevOps Agent は Preview のため制限があります。インシデント解決は月20時間・同時3件まで、インシデント予防は月10時間・同時1件まで、チャットメッセージは月1,000件まで、Agent Space はアカウントあたり最大10個です。また、CloudWatch のメトリクス・ログクエリなど他サービスの利用料は別途発生します。
:::

## CloudWatch へデータを流し込む

### やること

OTel Collector に AWS 向けの exporter を追加し、テレメトリデータを CloudWatch / X-Ray に送信します。変更するファイルは2つだけです。

### AWS 認証情報の受け渡し（`docker-compose.override.yml`）

OTel Collector コンテナに AWS の一時認証情報を環境変数で渡します。

```yaml
services:
  otel-collector:
    environment:
      - AWS_REGION=us-east-1
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY
      - AWS_SESSION_TOKEN
```

環境変数名だけ書いて値を省略すると、ホスト側の同名環境変数がそのままコンテナに渡されます。

:::note warn
最初は `~/.aws` をコンテナにマウントして `AWS_PROFILE` を指定する方式を試しましたが、うまくいきませんでした。`aws login` が `~/.aws/config` に書き込む `login_session` というキーは AWS CLI 独自の形式で、コンテナ内の OTel Collector が使う AWS Go SDK v2 はこの形式を認識できません。結果として認証情報が見つからず、EC2 のメタデータサービスにフォールバックしてエラーになります。そのため、`aws configure export-credentials` で標準的な一時認証情報に変換してから環境変数で渡す方式にしています。
:::

https://docs.aws.amazon.com/sdkref/latest/guide/feature-login-credentials.html

なお、Docker Compose の override ファイルは、同じディレクトリに置くだけで自動的にマージされます。既存の `docker-compose.yml` を変更せずに済むので、デモアプリの設定を汚さなくて良いですね。

https://docs.docker.jp/compose/extends.html

### AWS exporter 追加（`otelcol-config-extras.yml`）

OTel Collector のパイプラインに AWS 向けの exporter を追加します。

| パイプライン | 追加した exporter | 送信先 |
|---|---|---|
| traces | `awsxray` | AWS X-Ray |
| metrics | `awsemf` | CloudWatch Metrics（EMF: Embedded Metric Format 経由） |
| logs | `awscloudwatchlogs` | CloudWatch Logs |

:::note
Embedded Metric Format はログに埋め込まれたメトリクスを自動的に CloudWatch Logs から Metrics へ発行するように指示できる JSON 仕様です。
:::

https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html

<details><summary>otelcol-config-extras.yml の全体</summary>

```yaml
exporters:
  # トレース → AWS X-Ray
  awsxray:
    region: us-east-1
    local_mode: true  # ローカル環境なので EC2 メタデータ取得をスキップ

  # メトリクス → CloudWatch Metrics（EMF 経由）
  awsemf:
    region: us-east-1
    local_mode: true
    log_group_name: "/otel/demo/metrics"
    log_stream_name: "otel-demo-metrics"
    namespace: "OTelDemo"
    log_retention: 7
    resource_to_telemetry_conversion:
      enabled: true

  # ログ → CloudWatch Logs
  awscloudwatchlogs:
    region: us-east-1
    local_mode: true
    log_group_name: "/otel/demo/logs"
    log_stream_name: "otel-demo-logs"
    log_retention: 7

# パイプライン設定
# 注意: service.pipelines の exporters 配列は「完全上書き」される。
#       既存の exporter（otlp, spanmetrics 等）も必ず含めること。
service:
  pipelines:
    traces:
      exporters: [spanmetrics, otlp, debug, awsxray]
    metrics:
      exporters: [otlphttp/prometheus, debug, awsemf]
    logs:
      exporters: [opensearch, debug, awscloudwatchlogs]
```

</details>

:::note alert
詳細は以下記事で説明していますが、この方法だと、24000個ほどのカスタムメトリクスが作成されてしまいます。そのため、1日で20ドルほどの請求が発生する恐れがあります。みなさんが実施する際は、AWSへ流し込む情報を絞り込むことをおすすめします。本記事ではそのような対策は行なっておりません。ご了承ください。
:::

https://qiita.com/ryu-ki/items/209330643960e327601f

### 起動スクリプトの実行（`start.sh`）

上記2ファイルを配置したら、起動スクリプトを実行します。

```bash
./start.sh
```

なお、`start.sh` の中身は以下のとおりです。

```bash
#!/bin/bash
set -euo pipefail

echo "AWS 一時認証情報を取得中..."
eval $(aws configure export-credentials --profile devops-agent-profile --format env)

echo "OTel Demo を起動中..."
docker compose up --force-recreate --remove-orphans -d

echo "起動完了。2〜3 分後に CloudWatch へのデータ着信を確認してください。"
```

`aws configure export-credentials` が SSO の認証情報を `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` の形式で出力し、`eval` でシェル環境変数にセットしています。`docker-compose.override.yml` がこれらの環境変数をコンテナにパススルーするので、OTel Collector が AWS に認証できるようになります。

### データ着信の確認

起動して少し待ってから、データが届いているか確認します。

```bash
# CloudWatch Metrics
aws cloudwatch list-metrics --namespace "OTelDemo" --region us-east-1 --profile devops-agent-profile

# CloudWatch Logs
aws logs describe-log-groups --log-group-name-prefix "/otel/demo" --region us-east-1 --profile devops-agent-profile

# X-Ray トレース
aws xray get-trace-summaries \
  --start-time $(date -u -v-5M +%s) \
  --end-time $(date -u +%s) \
  --region us-east-1 \
  --profile devops-agent-profile
```

上記コマンドでデータが返ってくれば送信成功です。

コマンドの結果は長くて見にくいので、マネコンで確認した様子を添付しておきます。きちんとデータは取れていそうです。

![image.png](https://images.ryu-ki-learn.com/otel-demo-cloudwatch-devops-agent/9b7855c0-3309-4f42-8797-bd6ebb0f6d5d.png)

## DevOps Agent のセットアップ

DevOps Agent を使うには Agent Space を作成するだけです。Agent Space は、DevOps Agent がアクセスするツールやインフラを定義する論理的なコンテナです。

マネコンで us-east-1 を選択し、AWS DevOps Agent コンソールに移動して「Create Agent Space」をクリックします。設定内容は以下のとおりです。

| 項目 | 設定値 |
|------|-------|
| Name | `otel-demo-validation` |
| Description | `OpenTelemetry Demo の障害検証用` |
| IAM ロール | 新しいロールを自動作成（推奨） |

![image.png](https://images.ryu-ki-learn.com/otel-demo-cloudwatch-devops-agent/f55b0a06-2f1c-404d-ac8f-37e330a2ae82.png)

:::note warn
IAM ロール自動作成には `iam:CreateRole` / `iam:AttachRolePolicy` 権限が必要です。権限がない場合は手動でロールを作成してください。
:::

Agent Space を作成すると、同じ AWS アカウントの CloudWatch / X-Ray のテレメトリを DevOps Agent が自動的に参照できるようになります。追加のデータソース設定は不要です。

## DevOps Agent に障害を分析させる

前回と同じ手順で `imageSlowLoad` フラグを有効化して画像読み込みの遅延を発生させたうえで、DevOps Agent に「画像の読み込みが重い」とだけ伝えて、どんな調査をしてくれるか試してみます。

### 1. Feature Flag で遅延を発生させる

`http://localhost:8080/feature` から `imageSlowLoad` を有効化します。（前回と同じ手順です）

### 2. DevOps Agent に調査を依頼

Agent Space の UI から「Start an investigation」を選び、以下の内容で調査を依頼しました。アラームやメトリクス名などの具体的な情報は渡さず、ユーザー目線の症状だけを伝えています。

| 項目 | 入力内容 |
|------|---------|
| Investigation details | Our application is running locally and sending telemetry data to CloudWatch and X-Ray. Users are reporting that product image loading is very slow. Please investigate the root cause using the available telemetry data. （当社のアプリケーションはローカルで実行されており、CloudWatchとX-Rayにテレメトリーデータを送信しています。ユーザーから製品画像の読み込みが非常に遅いという報告が上がっています。利用可能なテレメトリーデータを使用して根本原因を調査してください。）|
| Investigation starting point | Users are reporting slow product image loads on the frontend. （ユーザーからフロントエンドでの製品画像読み込みの遅延が報告されています。）|

### 3. DevOps Agent の調査結果を確認

情報が不足していたからか、追加情報を聞かれたので答えます。

![スクリーンショット 2026-02-16 2.02.52.png](https://images.ryu-ki-learn.com/otel-demo-cloudwatch-devops-agent/fd07b33e-255e-4d8d-8614-9d840782ad45.png)

少し待つと、根本原因を突き止めてくれました。意図的に遅延をかけていることが筒抜けのようです。

![image.png](https://images.ryu-ki-learn.com/otel-demo-cloudwatch-devops-agent/115adf60-8c89-4b51-943c-5fe4fb63baeb.png)

![image.png](https://images.ryu-ki-learn.com/otel-demo-cloudwatch-devops-agent/7a5144e8-633b-4484-ad30-a0dd99ecb34c.png)

そのままの対応ではあるものの、緩和策も提案してくれました。

![image.png](https://images.ryu-ki-learn.com/otel-demo-cloudwatch-devops-agent/942cd2fb-42d6-4094-9ba9-7a65e08e254a.png)

### 4. 回復確認

最後にフラグを無効化して回復を確認し、終了します。

## おわりに

以上、簡単でしたが、ローカルで動かしているシステムの情報を DevOps Agent に渡して調査してもらいました。

今回の構成（ローカル × CloudWatch）では、AWS上にシステムがある状態と比べて、DevOps Agent の機能をフルに活かせないなと感じました。ローカル環境では AWS リソース（ECS タスク、EC2 インスタンスなど）が存在しないため、リソース間の依存関係を自動認識したり、CodeDeploy のデプロイ履歴と障害発生タイミングを相関分析したりする機能が使えません。

次は、AWS上（ECS or EKS？）にこのデモアプリを載せて試せるとよいなと思います。

ありがとうございました。
