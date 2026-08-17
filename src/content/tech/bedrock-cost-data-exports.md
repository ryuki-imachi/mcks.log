---
title: "【Bedrock】モデル別コストの集計が楽になったので Data Exports で確かめてみた"
description: "2026年7月20日に、AWS Data Exports が Amazon Bedrock の標準化されたプロダクトメタデータを提供開始した、という発表がありました。"
pubDate: 2026-07-23
tags: ['AWS', 'DataExports', 'DuckDB', 'Bedrock', 'コスト']
qiitaId: 4c4222d994b6e8f87002
importedDate: 2026-08-17
qiitaStats:
  views: 511
  likes: 3
  stocks: 2
  fetchedAt: 2026-08-17
---

## はじめに

2026年7月20日に、AWS Data Exports が Amazon Bedrock の標準化されたプロダクトメタデータを提供開始した、という発表がありました。

https://aws.amazon.com/about-aws/whats-new/2026/07/aws-data-exports-amazon-bedrock-product-metadata/

CUR（Cost and Usage Report）に、モデルプロバイダー名やモデル名といった属性が構造化された形で入るようになり、Bedrockのコストをモデル別に追いやすくなったとのことです。

この記事では、Data Exports（CUR 2.0）の実データを使って、追加された標準メタデータでモデル別のコスト集計を実際に確かめてみます。

## 追加された標準メタデータ

発表によると、追加された属性は次のとおりです。

> The standardized attributes include model provider, model name, pricing unit, inference type (such as input tokens or output tokens), and feature (the inference serving mode, such as On-Demand or Batch), along with a unified "Amazon Bedrock" product family name that consolidates all Bedrock costs.

整理すると、以下の6つです。

| 属性 | 内容 |
|---|---|
| model provider | モデルの提供元 |
| model name | モデル名 |
| pricing unit | 価格の単位 |
| inference type | 推論タイプ（入力トークン、出力トークンなど） |
| feature | 推論の提供モード（On-Demand、Batchなど） |
| product family | 「Amazon Bedrock」に統一されたファミリー名 |

CUR 2.0では、これらは product というMap型のカラムに入ります（価格単位とファミリー名には専用のカラムもあります）。実際にどのキーで入っているかは後ほど確認します。

利用条件と料金についても確認しておきます。

> The standardized fields are available by default, at no additional cost, to Amazon Bedrock customers using AWS Data Exports.

Data Exportsを使っていればデフォルトで利用でき、追加コストはかかりません。

そして従来については、こう書かれています。

> With these attributes, you can attribute Bedrock spend without building custom logic to parse various product metadata in CUR 2.0.

これまでは、CUR 2.0のプロダクトメタデータを独自のロジックでパースしないと、Bedrockの費用をモデル別に振り分けられなかった、ということです。ここが今回の便利になったポイントかと思います。

## 動作環境

| 項目 | バージョン |
|------|-----------|
| AWS CLI | 2.35.14 |
| DuckDB | 1.5.4 |
| リージョン | us-east-1 |

:::note
本記事の内容は、2026年7月時点の検証に基づきます。発表直後の機能のため、仕様が変わっている可能性がある点はご承知おきください。
:::

## 実際に確かめてみる

Data Exports（CUR 2.0）のエクスポートは作成済みの前提で進めます。作成手順は以下の公式ドキュメントどおりで、標準メタデータのための特別な設定は要りません（`product` カラムが標準のカラムセットに含まれています）。

https://docs.aws.amazon.com/cur/latest/userguide/dataexports-create.html

なお、新しくエクスポートを作った場合、初回のデータ配信までは最大24時間かかります（私の場合は約10時間でした）。さらに初回配信の時点ではBedrockモデルの明細がまだ入っておらず、揃ったのは翌日の日次更新でした。配信直後に数字が少なく見えたら、Cost Explorerと突き合わせてみるのが安全です。

### 出力された Parquet を手元で開く

出力されたParquetの確認にDuckDBを使います。

:::note
今回、私は好き好んでDuckDBを使っていますが、Athenaで十分かと思います。
:::

ローカルで動く軽量なデータベースで、S3上のParquetを直接読めるため、この手のちょっとした確認に便利です（詳しい使い方は本題ではないので割愛します）。

https://duckdb.org/

ファイルは次の構造で出力されていました。パスにエクスポート名と請求月のパーティションが入る形です。

```
s3://<バケット名>/cur2/bedrock-cost-check/
├── data/BILLING_PERIOD=2026-07/bedrock-cost-check-00001.snappy.parquet
└── metadata/BILLING_PERIOD=2026-07/bedrock-cost-check-Manifest.json
```

DuckDBからS3へのアクセスには、AWS CLIの認証情報を使います。私の環境はSSOのため、そのままの credential_chain では認証情報を拾えず、いったん環境変数に書き出してから読み込ませました。

```bash
eval "$(aws configure export-credentials --format env)"
duckdb
```

https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configure/export-credentials.html

```sql
CREATE SECRET s3creds (TYPE s3, PROVIDER credential_chain, CHAIN 'env');
```

https://duckdb.org/docs/stable/core_extensions/httpfs/s3api.html

スキーマを確認すると、エクスポートに含めたカラムがそのまま入っていて、product は MAP(VARCHAR, VARCHAR) でした。Bedrockのレコードを1行取り出して、product の中身を見てみます。

```sql
SELECT product
FROM read_parquet('s3://<バケット名>/cur2/bedrock-cost-check/data/BILLING_PERIOD=2026-07/*.parquet')
WHERE product['model'] IS NOT NULL
LIMIT 1;
```

```
{feature=On-demand Inference, provider=Anthropic, model=Claude Sonnet 4.6,
 inference_type=Output tokens, product_name='Claude Sonnet 4.6 (Amazon Bedrock Edition)',
 region=us-east-1, servicename='Claude Sonnet 4.6 (Amazon Bedrock Edition)'}
```

発表にあった属性と実データの対応は、次のとおりでした。

| 発表の属性 | 実データでの場所 | 実際の値の例 |
|---|---|---|
| model provider | product['provider'] | Anthropic |
| model name | product['model'] | Claude Sonnet 4.6 |
| inference type | product['inference_type'] | Input tokens |
| feature | product['feature'] | On-demand Inference |
| pricing unit | product_pricing_unit カラム | （今回の検証では全行NULL） |
| product family | product_product_family カラム | Amazon Bedrock |

なお、このメタデータは発表（7/20）より前の利用分にも遡って付与されていました。7月上旬のレコードにも同じキーが入っています。また、私の利用はすべてOn-Demandのため、featureの他の値（Batchなど）での見え方は確認できていません。

### モデル別コストを集計する

いよいよ本題です。product mapに入った標準メタデータを使って、モデル別のコストを集計してみます。

その前に1つ、従来の面倒さを実感した出来事がありました。最初に `line_item_product_code = 'AmazonBedrock'` で絞って集計したところ、gpt-ossの行しか出てきませんでした。Claudeの利用分は「Claude Sonnet 4.6 (Amazon Bedrock Edition)」という専用のプロダクト（プロダクトコードは `7zgyu5r4...` のような直感的でないID）として計上されており、若干不便です。

ここでファミリー名が活きてくるようです。product_product_family は「Amazon Bedrock」に統一されているので、ファミリーで絞ってモデル名でGROUP BYするだけでモデル別の表が出ます。

```sql
SELECT
    product['provider'] AS provider,
    product['model']    AS model,
    ROUND(SUM(line_item_unblended_cost), 2) AS cost_usd
FROM read_parquet('s3://<バケット名>/cur2/bedrock-cost-check/data/BILLING_PERIOD=2026-07/*.parquet')
WHERE product_product_family = 'Amazon Bedrock'
  AND product['model'] IS NOT NULL
  AND line_item_line_item_type = 'Usage'
GROUP BY 1, 2
ORDER BY cost_usd DESC;
```

```
┌───────────┬───────────────────┬──────────┐
│ provider  │       model       │ cost_usd │
├───────────┼───────────────────┼──────────┤
│ Anthropic │ Claude Sonnet 4.6 │    15.31 │
│ Anthropic │ Claude Haiku 4.5  │     1.57 │
│ Anthropic │ Claude Sonnet 4.5 │     0.03 │
│ OpenAI    │ gpt-oss-120b      │      0.0 │
└───────────┴───────────────────┴──────────┘
```

なお `product['model'] IS NOT NULL` を外すと、同じファミリーに属するAgentCore（RuntimeやBrowserの消費課金）の行も入ってきます。こちらはモデル推論ではないのでmodelキーが無く、このフィルタで自然に分けられます。

推論タイプ別（入力トークン・出力トークン）の内訳も見てみます。クエリは先ほどのSELECTとGROUP BYに `product['inference_type']` を足すだけです。

```
┌───────────────────┬────────────────┬──────────┐
│       model       │ inference_type │ cost_usd │
├───────────────────┼────────────────┼──────────┤
│ Claude Haiku 4.5  │ Input tokens   │      1.5 │
│ Claude Haiku 4.5  │ Output tokens  │     0.07 │
│ Claude Sonnet 4.5 │ Input tokens   │     0.02 │
│ Claude Sonnet 4.5 │ Output tokens  │     0.01 │
│ Claude Sonnet 4.6 │ Input tokens   │    14.79 │
│ Claude Sonnet 4.6 │ Output tokens  │     0.52 │
│ gpt-oss-120b      │ Input tokens   │      0.0 │
│ gpt-oss-120b      │ Output tokens  │      0.0 │
└───────────────────┴────────────────┴──────────┘
```

私のBedrock利用はブラウザ操作エージェントの検証が大半なので、入力トークンに極端に偏っています。こういう使い方の癖が見えるのも面白いところです。

:::note
ちなみに、これまでモデル別の内訳を出そうとすると、名前の文字列から情報を切り出す工夫が必要でした。たとえばCost Explorerでは、Bedrockの利用は「Claude Sonnet 4 (Amazon Bedrock Edition)」のような名前で出てきます。実際、私も以前作ったコスト通知ツールの中で、この文字列を正規表現で短縮していました。

```python
# Bedrock モデル名: "Claude Sonnet 4 (Amazon Bedrock Edition)" → "Sonnet 4"
bedrock_match = re.match(r"(.+?)\s*\(Amazon Bedrock Edition\)", name)
if bedrock_match:
    model = bedrock_match.group(1)
    model = re.sub(r"^(Claude|Amazon)\s+", "", model)
    return model
```

動きはするのですが、モデル名の形式が変わったら壊れる類のコードです。標準メタデータがあれば、この手の工夫は不要になります。
:::

### 呼び出し元（IAMプリンシパル）別に見る

もう1つ、ドキュメントを読んでいて見つけた機能も試します。CUR 2.0には、Bedrockの推論コストに呼び出し元のIAMプリンシパルを付与する設定があります（INCLUDE_IAM_PRINCIPAL_DATA）。有効にすると line_item_iam_principal カラムが追加され、どのIAMロール・ユーザーからの利用かまで追えるようになります。対象は2026年4月8日以降のデータです。

https://docs.aws.amazon.com/cur/latest/userguide/table-dictionary-cur2.html

有効化は、エクスポートの設定（TableConfigurations）で INCLUDE_IAM_PRINCIPAL_DATA を TRUE にするだけです。作成済みのエクスポートでも update-export で変更できます。

https://awscli.amazonaws.com/v2/documentation/api/latest/reference/bcm-data-exports/update-export.html

今回のエクスポートではこれを有効にしてあるので、モデル別と合わせて確認してみます。

```sql
SELECT
    line_item_iam_principal AS principal,
    product['model'] AS model,
    ROUND(SUM(line_item_unblended_cost), 2) AS cost_usd
FROM read_parquet('s3://<バケット名>/cur2/bedrock-cost-check/data/BILLING_PERIOD=2026-07/*.parquet')
WHERE product['model'] IS NOT NULL
  AND line_item_line_item_type = 'Usage'
GROUP BY 1, 2
ORDER BY cost_usd DESC
LIMIT 3;
```

```
arn:aws:sts::<アカウントID>:assumed-role/<ロール名>/BedrockAgentCore-0b425b4e-...  Claude Sonnet 4.6  9.61
arn:aws:sts::<アカウントID>:assumed-role/<ロール名>/BedrockAgentCore-a45ec63c-...  Claude Sonnet 4.6  1.96
arn:aws:sts::<アカウントID>:assumed-role/<ロール名>/BedrockAgentCore-3ab38916-...  Claude Sonnet 4.6  1.55
```

私のBedrock利用の大半はAgentCore Runtime上のエージェント経由なのですが、その場合はセッションごとのassumed-role ARNとして出てきました。ロール単位どころか「どのエージェント実行がいくら使ったか」まで割れる粒度です。

## おわりに

以上、Data Exportsに追加されたBedrockの標準メタデータを実際に確かめてみました。

発表のとおり、SELECT文1つでモデル別のコスト表が出せることを確認できました。個人的には、Bedrock Editionのプロダクトコードを気にしなくてよくなったのが一番の実利かと思います。同じような需要のある方の参考になれば幸いです。

ありがとうございました。
