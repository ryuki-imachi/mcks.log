---
title: "【CloudWatch】OpenTelemetryとカスタムメトリクスをなめていたら1日で20ドル持って行かれた話"
description: "ある日、AWS Budgets から予算超過のアラート通知が届きました。確認すると、普段は月3ドル程度だったアカウントの利用料金が20ドルほどに跳ね上がっています。"
pubDate: 2026-03-04
updatedDate: 2026-03-13
tags: ['AWS', 'CloudWatch', '失敗談', 'カスタムメトリクス']
qiitaId: 209330643960e327601f
importedDate: 2026-07-11
qiitaStats:
  views: 1396
  likes: 0
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

ある日、AWS Budgets から予算超過のアラート通知が届きました。確認すると、普段は月3ドル程度だったアカウントの利用料金が20ドルほどに跳ね上がっています。

![image.png](https://images.ryu-ki-learn.com/cloudwatch-custom-metrics-cost-trap/4e31ed97-c065-426c-8cfe-7f84d02a056f.png)

ほったらかしだと不味そうなので原因を調べます。

## 原因を調べる

### まずはサービス別のコストを確認する

AWS CLI の `aws ce get-cost-and-usage` コマンドで、サービス別にコストを分解してみました。

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-02-01,End=2026-02-21 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter '{"Dimensions":{"Key":"LINKED_ACCOUNT","Values":["対象アカウントID"]}}'
```

https://docs.aws.amazon.com/cli/latest/reference/ce/get-cost-and-usage.html

```text
AmazonCloudWatch  17.47ドル
Tax               1.75ドル
```

Amazon CloudWatch が 17.47ドルで、これが原因っぽいです。さらに掘り下げていきます。

### 使用タイプを絞り込む

CloudWatch のコストを使用タイプ（USAGE_TYPE）で分解しました。

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-02-01,End=2026-02-21 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --filter '{"And":[
    {"Dimensions":{"Key":"LINKED_ACCOUNT","Values":["対象アカウントID"]}},
    {"Dimensions":{"Key":"SERVICE","Values":["AmazonCloudWatch"]}}
  ]}' \
  --group-by Type=DIMENSION,Key=USAGE_TYPE
```

https://docs.aws.amazon.com/cli/latest/reference/ce/get-cost-and-usage.html

```text
CW:MetricMonitorUsage  17.47ドル
```

`CW:MetricMonitorUsage` に17.47ドルかかっています。これは CloudWatch カスタムメトリクスの課金です。

### メトリクスの実態を確認する

では、実際にどれだけのメトリクスが登録されているのか、調べてみましょう。

```bash
# メトリクスの総数を確認
aws cloudwatch list-metrics --namespace OTelDemo --output json \
  | jq '.Metrics | length'

# ユニークなメトリクス名の数を確認
aws cloudwatch list-metrics --namespace OTelDemo --output json \
  | jq '[.Metrics[].MetricName] | unique | length'
```

https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/list-metrics.html

```text
# メトリクスの総数
24081

# ユニークなメトリクス名の数
400
```

24,081個ものカスタムメトリクスが CloudWatch に送信されていました。マネコンからも確認してみましたが、訳がわからず3度見しました。

![スクリーンショット 2026-02-20 19.42.55.png](https://images.ryu-ki-learn.com/cloudwatch-custom-metrics-cost-trap/9ebe6daf-4794-49dc-892f-b81125b6f764.png)

![](https://images.ryu-ki-learn.com/cloudwatch-custom-metrics-cost-trap/58f09f02-36d9-456f-8181-4381246097d7.avif)


また、400種類のメトリクスが、なぜ24,081個にまで膨れ上がっているのかもよくわかっていません。

## カスタムメトリクス爆増の原因調査
### まず環境構成を整理する

今回の構成は以下のようになっていました。

![article-draft-architecture.png](https://images.ryu-ki-learn.com/cloudwatch-custom-metrics-cost-trap/5c966bfa-4095-441c-933c-5375f071f584.png)

そして問題の設定がこちらです。

```yaml
# otelcol-config-extras.yml（問題のあった設定）
exporters:
  awsemf:
    region: us-east-1
    namespace: "OTelDemo"
    resource_to_telemetry_conversion:
      enabled: true  # ← これが爆増の引き金

service:
  pipelines:
    metrics:
      exporters: [otlphttp/prometheus, debug, awsemf]
      # ↑ フィルタなしで全メトリクスが awsemf に流れる
```

awsemf exporter にフィルタをかけず、全メトリクスをそのまま CloudWatch に送信していました。

### なぜ400種類が24,081個になるのか

まず前提として、CloudWatch のカスタムメトリクスは「メトリクス名 × ディメンション（ラベル）の組み合わせ」ごとに1つのメトリクスとしてカウントされます。メトリクス名が同じでも、ディメンションの組み合わせが1つでも違えば別のメトリクスとして扱われています。

今回の環境ではこれが2段階で膨張していました。

#### 膨張ポイント① `resource_to_telemetry_conversion: true`

この設定を有効にすると、OTel のリソース属性（`service.name`, `host.name`, `container.id`, `process.pid` など）がすべてメトリクスのディメンションに変換されます。ディメンションが増えるとその掛け算でメトリクス数が膨らんでいきます。

`process.cpu.time` を例に見てみましょう。

![article-draft-dim-point1.png](https://images.ryu-ki-learn.com/cloudwatch-custom-metrics-cost-trap/ed084938-f2c2-41e1-878d-86cc639f9424.png)



③で急に増えているのは、`hostmetrics` receiver がホスト上で動いている全プロセスを PID 単位で拾ってくるためです。ブラウザやエディタなど、開発中に立ち上がっているプロセスの数だけディメンションが増え、掛け算に加わります。

#### 膨張ポイント② `dimension_rollup_option`（デフォルト設定）

膨張ポイント①だけでも十分多いのですが、awsemf exporter のデフォルト設定がさらに追い打ちをかけていました。`dimension_rollup_option` のデフォルト値は `ZeroAndSingleDimensionRollup` で、1つのデータポイントから「ディメンションなし版」や「単一ディメンション版」のメトリクスを自動生成する機能です。

例えば `process.cpu.time` に `service.name=cart` と `state=system` という2つのディメンションがあった場合、元の1個に加えて以下の3個が追加で作られます。

![article-draft-dim-point2.png](https://images.ryu-ki-learn.com/cloudwatch-custom-metrics-cost-trap/65ce47eb-a434-47aa-a71e-5c237335be96.png)



これが膨張ポイント①で生まれたすべてのディメンション組み合わせに対して起きるので、メトリクス数がさらに膨らみます。

上位のメトリクスだけでもこれだけの数になっていました。

| メトリクス名 | ディメンション組み合わせ数 |
|---|---|
| process.cpu.time | 1,558個 |
| process.memory.virtual | 1,411個 |
| process.memory.usage | 1,411個 |
| traces.span.metrics.duration | 665個 |
| container.blockio.io_service_bytes_recursive | 419個 |
| process.disk.io | 357個 |
| ... | ... |
| 合計（400メトリクス名） | 24,081個 |

### 放置していたらいくらになっていたか

CloudWatch カスタムメトリクスの料金（us-east-1）は以下の通りです。

| メトリクス数 | 料金 |
|---|---|
| 最初の10,000個 | 0.30ドル/個/月 |
| 10,001〜250,000個 | 0.10ドル/個/月 |

https://aws.amazon.com/cloudwatch/pricing/

24,081個のメトリクスが1ヶ月フルで存在した場合、こうなります。

```text
最初の 10,000個  10,000 × 0.30ドル = 3,000ドル
残りの 14,081個  14,081 × 0.10ドル = 1,408ドル
───────────────────────────────────────
合計  最大 4,408ドル/月
```

今回の請求が17.47ドルで済んでいるのは、メトリクスを送信していた期間が短かったためです。CloudWatch カスタムメトリクスは時間割り（pro-rated by the hour）で課金され、データポイントを受信した時間のみ課金対象となります。

参考として概算してみると、2月（28日 = 672時間）のうち約30時間メトリクスを送信した場合は以下のようになります。

```text
10,000 × 0.30ドル × (30/672) ≒ 13.39ドル
14,081 × 0.10ドル × (30/672) ≒ 6.29ドル
──────────────────────────────────
合計 ≒ 19.68ドル
```

実際の送信メトリクス数は時間帯によって変動するため正確な計算は難しいですが、おおよそ30時間程度の送信で 17.47ドルになったと考えると辻褄が合います。

もし1ヶ月間つけっぱなしにしていたら、数千ドルの請求になるところでした。（**こまめに Docker を止める癖がついていた自分GJ**）

## 対策

### 即時対策（awsemf exporter の無効化）

今回はデモ検証が一段落していたため、AWS への送信をすべて無効化しました。設定は再有効化できるようにコメントとして残しています。

```yaml
# otelcol-config-extras.yml
# exporters と service.pipelines をすべてコメントアウト
# → ベースの otelcol-config.yml の設定（ローカル完結）が使われる
```

## 教訓

### 1. 従量課金サービスへの送信にはフィルタが必須

OpenTelemetry Demo は約20のマイクロサービスが大量のメトリクスを出力します。ローカルの Prometheus に送る分には無料ですが、CloudWatch のように「メトリクス数 × ディメンション組み合わせ」で従量課金されるサービスでは、必ず filter processor で送信対象を絞るべきです。再度 CloudWatch に送信する際は、CloudWatch 専用のパイプラインを分離して必要なメトリクスだけを流すようできるといいなと思います。

### 2. ディメンション爆発を起こす設定を把握しておく

今回の原因は `resource_to_telemetry_conversion` と `dimension_rollup_option` の2つでした。どちらもデフォルトや気軽な設定変更でメトリクス数が桁違いに膨らむ可能性があります。従量課金のサービスに送信する場合は、exporter の設定項目がメトリクス数にどう影響するかを事前に確認しておくことが大切です。

### 3. AWS Budgets によるコスト監視が効いた

今回、異常にすぐ気づけたのは AWS Budgets で予算アラートを設定していたおかげです。まだ設定していない方は、以下のように設定しておくことを強くおすすめします。

```bash
aws budgets create-budget \
  --account-id <アカウントID> \
  --budget '{
    "BudgetName": "MonthlyBudget",
    "BudgetLimit": {"Amount": "10", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{"SubscriptionType": "EMAIL", "Address": "your@email.com"}]
  }]'
```

https://docs.aws.amazon.com/cli/latest/reference/budgets/create-budget.html

### 4. 扱うサービスのコスト感覚は事前に確認しておく

今回は何も調べず無邪気に CloudWatch を利用しました。軽くでも事前にコスト感覚を把握していればもう少し使い方を工夫できたのではと思います。みなさんも気をつけましょう。（お前が言うなという話ですが）

## おわりに

今回の記事をまとめると以下の通りです。

| 項目 | 内容 |
|---|---|
| 問題 | ローカルDockerのOTelDemoからCloudWatchへのメトリクス送信で料金急増 |
| 原因 | awsemf exporter にフィルタなし + resource_to_telemetry_conversionでディメンション爆発（24,081個） |
| 被害額 | 17.47ドル（短期間の利用。放置すれば月4,000ドル超の可能性） |
| 発覚 | AWS Budgets の予算超過アラート |
| 対策 | AWS exporter の無効化 + 再有効化時は filter processor で絞り込み |

OpenTelemetry は非常に強力なオブザーバビリティ基盤ですが、何でも送れるからこそ、「どこに・何を・どれだけ送るか」を意識することが大切だと感じました。特に CloudWatch のようなディメンション組み合わせで課金されるサービスでは、`resource_to_telemetry_conversion` の影響を理解した上で使いましょう。

他の方が同じ落とし穴にハマらないことを祈っております。

ありがとうございました。
