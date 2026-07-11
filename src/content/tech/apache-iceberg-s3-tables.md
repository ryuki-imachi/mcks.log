---
title: "【Iceberg】Apache Icebergとは？～S3 Tablesから触ってみた～"
description: "データレイクは、構造化・非構造化を問わず、あらゆる形式の大量のデータを元の形式のまま一箇所に保存できる大規模なデータストレージシステムです。"
pubDate: 2025-04-14
tags: ['AWS', 'S3', 'Iceberg']
qiitaId: 4b4c676f774342dd692c
importedDate: 2026-07-11
qiitaStats:
  views: 6190
  likes: 4
  stocks: 3
  fetchedAt: 2026-07-11
---

# はじめに
「大規模データ分析の世界ではよくApache Icebergが使われている」とか、「最近出てきたS3 TablesではIcebergを比較的簡単にIcebergを扱うことができる」といった話を聞いたり聞かなかったりしていたのですが、結局何なんだというところで、実際に調べたり触ってみたりしたことを整理したいと思います。

# そもそもデータレイクとは

データレイクは、構造化・非構造化を問わず、**あらゆる形式の大量のデータを元の形式のまま一箇所に保存できる**大規模なデータストレージシステムです。

### 主な特徴

- **柔軟性**
    - あらゆる種類のデータを保存可能
        - テキスト、画像、ログファイル、センサーデータ など
- **保存優先アプローチ**
    - 「スキーマ・オン・リード」という考え方を採用
        - データを使用する時点で構造を定義
- **大規模**
    - ペタバイト規模のデータを扱えるように設計
- **コスト効率**
    - クラウドストレージなどの比較的安価なストレージを活用

### 主な用途
- ビッグデータ分析
- 機械学習モデルのトレーニング
- 様々なシステムからのデータ統合
- 履歴データの長期保存

しかし、データレイクには課題もあります。管理が適切でないと「データスワンプ（沼）」と呼ばれる状態になり、データの品質や整理が悪くなって使い物にならなくなるリスクがあります。ここで、Apache IcebergやAWS S3 Tablesのようなテーブルフォーマットが重要な役割を果たします。

# Apache Icebergとは

https://iceberg.apache.org/

Apache Icebergは、大規模なデータレイク管理のための**オープンソーステーブル形式**です。
（ソフトウェアのことではなく、あくまでもテーブル形式のことを指すと強調されることが多いです）

### 簡単なアーキテクチャ

https://www.dremio.com/resources/guides/apache-iceberg-an-architectural-look-under-the-covers/

上記ページによると、以下のような3つのレイヤーで構成されています。
- **Iceberg Catalog**
    - カタログ内の、各テーブルへのポインタ（`current metadata pointer`）を管理
- **Metadata Layer**
    - Metadata File
        - テーブルに関するメタデータを管理
            - スキーマ・パーティション情報・スナップショット など
    - Manifest List
        - Manifest Fileのリストで、各Manifest Fileに関する情報を管理
    - Manifest File
        - データファイルや、各ファイルに関する追加の詳細と統計を管理
            - 大規模な並列処理と再利用の効率性のため
- **Data Layer**
    - データファイルを管理

### 主な特徴

- **高性能なテーブル形式**
    - Hadoop、Spark、Prestoなどの様々なエンジンと互換性がある
- **スナップショット方式**
    - 一貫性のある読み取りを実現
- **スキーマ進化**
    - フィールドの追加・削除・名前変更などが簡単に行える
- **パーティション進化**
    - データ構造の変更に柔軟に対応
- **隠しパーティション**
    - 高速クエリを実現
- **タイムトラベル**
    - 過去のデータスナップショットへのアクセスが可能

### （おまけ）開発背景

Icebergは元々Netflixが主導して開発されました。現在は名前からもわかるように、Apache Software Foundationのもとで管理されています。Amazon、Netflix、Apple、LinkedIn、Expediaなど多くの大企業で採用されており、**ペタバイト規模のデータ管理に活用**されています。

# AWS S3 Tablesとは

https://aws.amazon.com/jp/s3/features/tables/

AWS S3 Tablesは、Amazon Web Services（AWS）が2023年11月末に発表した、Amazon S3上に構築されたサーバーレスのデータレイク管理サービスです。

### S3 Tablesの主な特徴

- **サーバーレス**
    - インフラストラクチャの管理が不要
- **トランザクションサポート**
    - 一貫性のあるデータ操作を保証
- **スキーマ管理**
    - データ構造の定義と進化をサポート
- **自動最適化**
    - クエリとデータ分析を高速化
- **Apache Iceberg互換**
    - オープンなテーブルフォーマットに基づいている

### S3 Tablesの利点

- S3に保存されたデータへの高速なクエリ処理
- データの整合性確保
- AWS Athena、Amazon Redshift、Amazon EMRなどの他のAWSサービスとの統合

# 実際に試してみる

以上を踏まえて実際に触ってみたいと思います。
今回は以下のような形になります。

なお、作業は以下ページを参考に実施します。

https://aws.amazon.com/jp/about-aws/whats-new/2025/03/amazon-s3-tables-create-query-table-s3-console/

https://dev.classmethod.jp/articles/add-s3-tables-iceberg-rest-catalog-api/

### 1. AWS 分析サービスとの統合 の有効化
メニューから`テーブルバケット`を選択し、AWS 分析サービスとの統合を有効化します。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/beaa7299-307d-4631-b79f-affdc1801a8b.png)

### 2. テーブルバケットの作成
適当な名前のバケットを作成します。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/dcb6e2d7-2ffc-4932-929d-fc11c8edaab5.png)

### 3. 名前空間の作成
Athenaから名前空間を作成します。
`Athenaでテーブルを作成`を選択して適当なnamespaceを作成します。（がっつりタイポしてますが無視してください）

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/90e5768c-ee79-4f93-9602-28a75950ef49.png)

### 4. スキーマの作成
名前空間を作成し、`Athenaでテーブルを作成`を選択すると、以下のようなAthenaのエディタ画面に遷移します。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/d7555a66-c3ba-451b-af07-5801595a1a9d.png)

先に画面の通り、クエリ結果の場所を設定します。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/9a8afd83-dbc8-4c69-95e4-511e59bb3c10.png)

では、テーブル作成に移りましょう。
今回は、サンプルとして既に入力されているものをそのまま実行してみたいと思います。

```sql
CREATE TABLE `duck_namespase`.daily_sales (
sale_date date, 
product_category string, 
sales_amount double)
PARTITIONED BY (month(sale_date))
TBLPROPERTIES ('table_type' = 'iceberg')
```

実行すると、以下のようにテーブルが作成されていることがわかります。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/a7763287-1e4f-4634-ae70-57ef79a736cc.png)

続けて、以下コマンドでデータをインサートしてみます。

```sql
INSERT INTO daily_sales VALUES
(DATE '2024-01-15', 'Laptop', 900.00),
(DATE '2024-01-15', 'Monitor', 250.00),
(DATE '2024-01-16', 'Laptop', 1350.00),
(DATE '2024-02-01', 'Monitor', 300.00),
(DATE '2024-02-01', 'Keyboard', 60.00),
(DATE '2024-02-02', 'Mouse', 25.00),
(DATE '2024-02-02', 'Laptop', 1050.00),
(DATE '2024-02-03', 'Laptop', 1200.00),
(DATE '2024-02-03', 'Monitor', 375.00);
```

### 5. 作成したテーブルの確認
最後に、以下select文で確認してみます。

```sql
SELECT 
product_category,
COUNT(*) as units_sold,
SUM(sales_amount) as total_revenue,
AVG(sales_amount) as average_price
FROM daily_sales
WHERE sale_date BETWEEN DATE '2024-02-01' and DATE '2024-02-29'
GROUP BY product_category
ORDER BY total_revenue DESC;
```

以下のように正しくselectできていることが確認できました。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/9988ba14-9e63-4779-9ee8-0a53fde23ca0.png)

### 6. テーブルバケットの削除
2025/04/13現在、S3 Tablesはマネコンから削除できないため、CLIで削除する必要があります。今回は以下コマンドで削除を行いました。

- テーブルの削除
```bash
aws s3tables delete-table --table-bucket-arn <bucket arn> --namespace <namespace name> --name daily_sales
```

- 名前空間の削除
```bash
aws s3tables delete-namespace --table-bucket-arn <bucket arn> --namespace <namespace name>
```

- テーブルバケットの削除
```bash
aws s3tables delete-table-bucket --region ap-northeast-1 --table-bucket-arn <bucket arn>
```

#### （おまけ）Amazon Q Developer CLIで聞いてみた
せっかくなので、Amazon Q Developer CLIに聞いてみました。
Amazon Q Developer CLIについては以下のページなどを参照してください。

https://docs.aws.amazon.com/ja_jp/amazonq/latest/qdeveloper-ug/command-line.html

https://business.ntt-east.co.jp/content/cloudsolution/ih_column-191.html

`aws s3tables help`の実行許可などをしながら進めてもらうと以下のような出力を返してくれました。

```md
S3 Tablesサービスを使用している場合、完全に削除するには以下の3ステップが必要です：

1. まずテーブルを削除する
2. 次に名前空間を削除する
3. 最後にテーブルバケットを削除する

具体的な手順は以下の通りです：

### ステップ1: テーブルを削除する
bash
aws s3tables delete-table \
  --table-bucket-arn arn:aws:s3tables:<region>:<account-id>:tablebucket/duckdb-iceberg-read-test \
  --namespace <namespace-name> \
  --name <table-name>


### ステップ2: 名前空間を削除する
bash
aws s3tables delete-namespace \
  --table-bucket-arn arn:aws:s3tables:<region>:<account-id>:tablebucket/duckdb-iceberg-read-test \
  --namespace <namespace-name>


### ステップ3: テーブルバケットを削除する
bash
aws s3tables delete-table-bucket \
  --table-bucket-arn arn:aws:s3tables:<region>:<account-id>:tablebucket/duckdb-iceberg-read-test


各コマンドで必要な情報（リージョン、アカウントID、名前空間名、テーブル名）を実際の値に置き換える必要があります。
```

ついでに実行してもらいました。実行後、確認してもらったところちゃんと削除できていそうです。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/4bb6fb00-2432-443e-92ae-371295b112cd.png)

マネコン上からも削除できていそうなことが確認できました。

![image.png](https://images.ryu-ki-learn.com/apache-iceberg-s3-tables/543d169a-5f70-4f14-93d6-50a9adec9b90.png)

# まとめ

Apache IcebergとAWS S3 Tablesは、データレイク管理における有効なソリューションです。

- **Apache Iceberg**
    - オープンソースのテーブル形式として、異なるエンジン間でのデータ整合性と高性能なクエリを実現
- **AWS S3 Tables**
    - AWSのマネージドサービスとして、Icebergの機能を活用しつつ、サーバーレスで簡単に利用可能

データ分析の規模が大きくなればなるほど、これらのテクノロジーがもたらす恩恵は大きくなります。


# おわりに
S3 Tablesと、そこで取り扱われているApache Icebergとはなんだ？というところを調査しました。正直、実践的な触り方ができていないので、ありがたみがわからない部分もあるにはありますが、どのようなものなのかといったところはわかったかなと思います。
今度は、Lambdaを使ってDuckDBからS3 Tablesへのアクセスも実践してみたいなと思っています。
ありがとうございました。
