---
title: "【CloudShell】DuckDB を使って S3 上のデータをサクッと取得してみた"
description: "以前、S3上のデータを取得するためにDuckDBを利用する記事を書きました。"
pubDate: 2025-11-29
updatedDate: 2025-11-30
tags: ['AWS', 'S3', 'DuckDB']
qiitaId: 5f14513682099980dddc
importedDate: 2026-07-11
qiitaStats:
  views: 1130
  likes: 1
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

以前、S3上のデータを取得するためにDuckDBを利用する記事を書きました。

https://qiita.com/ryu-ki/items/584c6b832dedc4f5fcb8

しかし、そちらでは Cloud9 を使っており、今から試そうと思うとなかなか難しいです。(Cloud9 帰ってきてくれ…！)

ということで、比較的サクッと使える CloudShell を使って同じことを試してみたいと思います。

## DuckDBとは

DuckDBは、組み込み型のOLAP（分析向け）データベース管理システムです。OSSとして公開されており、以下のような特徴があります。

- 多様なファイル形式に対応：CSV、JSON、Parquet、Excelなど、様々なフォーマットをインポート・エクスポート可能
- 豊富なAPIサポート：Python（Pandas連携も可能）をはじめ、多様な言語から利用可能
- 軽量・高速：ローカル環境でサクッと分析できる

詳細は以下をご覧ください。

https://duckdb.org/

## CloudShell とは

端的に言いますと、ブラウザから直接使えるコマンドライン環境です。

今回詳細は省きますが、こちらの記事を参照していただければイメージがつかめると思います。

https://qiita.com/ymd65536/items/14f6dc1164cbf83b7de8

## CloudShellでDuckDBを使ってみる

それでは、実際にCloudShell上でDuckDBをセットアップし、S3上のデータを分析してみましょう。

### Step 0：データの準備

雑に Claude にテストデータを作ってもらい、それらを S3 に置きました。

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/6352894c-6a82-478f-934e-000a0e701db3.png)

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/388d0999-b22e-4be1-9b9b-3abec7047a9c.png)

### Step 1：DuckDBのインストール

CloudShellで以下のコマンドを実行します。

```bash
curl https://install.duckdb.org | sh
```

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/0ead12f3-1bd1-4b95-9a49-b795672ea97a.png)

これだけでDuckDBが使えるようになります（ダックかわいい）。インストール方法の詳細は以下の Installation ページをご確認ください。

https://duckdb.org/docs/installation/

以下コマンドで実行することができます。

```bash
duckdb
```

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/23696aa7-3120-4c4e-8de0-9553370e0486.png)

### Step 2：httpfs拡張のインストールと認証設定

S3にアクセスするために、httpfs拡張をインストールし、クレデンシャルを設定します。

```sql
-- httpfs拡張のインストールと読み込み
INSTALL httpfs;
LOAD httpfs;

-- クレデンシャルの設定
CREATE SECRET (
    TYPE s3,
    PROVIDER credential_chain
);
```

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/575d6d8f-7e4a-4878-b657-17889b4aff4b.png)

これらのコマンドの詳細は以下のページを参照してください。

https://duckdb.org/docs/stable/core_extensions/httpfs/s3api

https://duckdb.org/docs/stable/core_extensions/httpfs/overview

https://duckdb.org/docs/operations_manual/access_management/secrets_manager.html

### Step 3：テーブルの作成

S3上のファイルからテーブルを作成してみます。

```sql
CREATE TABLE users AS SELECT * FROM read_csv('s3://duckdb-demo-20251128/*.csv');
```

### Step 4：クエリの実行

あとは通常のSQLでクエリを実行できます。

```sql
SELECT * FROM users;
```

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/25e149a4-e3e5-49b6-943c-0029a18c7f6b.png)

```sql
SELECT * FROM users ORDER BY salary DESC, age DESC;
```

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/a59c1992-44e9-453d-85c6-a4130cbb0244.png)

きちんと値を取得できていることが分かります。

## （おまけ）直接S3の情報を探索
先ほどはいったんテーブルを作成してデータを覗いていましたが、直接見ることもできます。

```sql
SELECT * FROM read_csv('s3://duckdb-demo-20251128/data1.csv') limit 3;
```

```sql
SELECT * FROM read_csv('s3://duckdb-demo-20251128/*.csv');
```

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/66b7f2e3-155a-440f-a54f-4c4f15f80ebd.png)

## うまくいかないときは

S3へのアクセスがうまくいかない場合は、一度ローカルにファイルをコピーしてから処理する方法もあります。

```bash
aws s3 cp s3://duckdb-demo-20251128/data1.csv data
```

https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/bbf1ef05-2bee-48d9-8a77-c86c31fc5d85.png)

read_csv に渡すパスを変えるだけで、基本的には同じ要領でデータを扱うことができます。

```sql
SELECT * FROM read_csv('data/*.csv');
```

![image.png](https://images.ryu-ki-learn.com/cloudshell-duckdb-s3/845ec075-bda5-423d-811b-ed3bec43465b.png)

また、認証周りについて知りたい方は、以下の記事がとても参考になります。

https://dev.classmethod.jp/articles/duckdb-s3-authentication-methods/

## まとめ

DuckDBは軽量で様々なデータ形式に対応しており、ちょっとしたデータ分析に最適なツールです。

- コストを気にせず何度でもクエリを試せる
- 環境構築も簡単
- S3のデータに直接アクセスして分析可能
- 状況によってはローカルにまるっとデータを落として、そこから分析する使い方もあり

今回触れませんでしたが、大規模データの定期的な分析など Athena が適している場合もありますので、ユースケースに応じて適切にツールを使い分けていくことが大切だと思います。
ありがとうございました。
