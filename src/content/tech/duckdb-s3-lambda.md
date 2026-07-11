---
title: "【DuckDB】DuckDBを用いてS3のデータを操作するLambdaを作ってみた"
description: "しかし、この記事ではCloud9上で実施しており、Lambda上で実施したいと考えていました。本記事では、Lambdaで実現する際に注意が必要な点について説明できればと思います。"
pubDate: 2025-04-28
tags: ['AWS', 'S3', 'Lambda', 'DuckDB']
qiitaId: 10e456ffc1f2eb225bb4
importedDate: 2026-07-11
qiitaStats:
  views: 1811
  likes: 1
  stocks: 1
  fetchedAt: 2026-07-11
---

# はじめに
以前、DuckDBを用いて、S3バケット上に保管されているALBアクセスログをクエリする取り組みをしました。

https://qiita.com/ryu-ki/items/584c6b832dedc4f5fcb8

しかし、この記事ではCloud9上で実施しており、Lambda上で実施したいと考えていました。本記事では、Lambdaで実現する際に注意が必要な点について説明できればと思います。

# 今回やること
S3バケットにあるcsvデータを取得し、クエリを実行をした結果をDataFrameで出力するところまでを実施してみたいと思います。

使用するcsvデータはKaggleの有名なデータセットであるTitanicです。

https://www.kaggle.com/c/titanic/data?select=gender_submission.csv

# Lambda Layerについて
今回、DuckDBライブラリを利用するため、ライブラリをレイヤーに追加する必要があります。しかし、本記事ではLambdaの実装に関する説明をしたいので割愛させていただきます。

レイヤー追加に関しては以下記事で手順などを説明していますので、興味のある方はこちらをご覧ください。

https://qiita.com/ryu-ki/items/636c0e2f8ad34991dac0

# 作成したコード
以下のようなコードを作成しました。

<details><summary>長いため折り畳み</summary>

```py
import json
import duckdb
import os
import pandas as pd

def setup_duckdb_connection():
    """DuckDBの接続と設定を行う"""
    # Lambdaの一時ディレクトリを使用する
    temp_dir = '/tmp'
    os.environ['HOME'] = temp_dir
    
    # DuckDBコネクションを作成
    conn = duckdb.connect(database=':memory:')
    
    # 設定を適用
    conn.execute(f"SET home_directory='{temp_dir}';")
    conn.execute("INSTALL httpfs;")
    conn.execute("LOAD httpfs;")
    conn.execute("SET s3_region='ap-northeast-1';")
    
    return conn

def execute_s3_query(conn, bucket, file_path, limit):
    """S3のデータに対してクエリを実行する"""
    query = f"""
    SELECT PassengerID, Survived, Fare 
    FROM read_csv_auto('s3://{bucket}/{file_path}') 
    WHERE Fare > 30 
    LIMIT {limit};
    """
    
    return conn.execute(query).fetchdf()

def lambda_handler(event, context):
    try:
        # リクエストからパラメータ取得
        bucket = event.get('bucket', 'duckdb-demo-qiita')
        file_path = event.get('file_path', 'train.csv')
        limit = event.get('limit', 10)
        
        # DuckDB接続のセットアップと実行
        conn = setup_duckdb_connection()
        df = execute_s3_query(conn, bucket, file_path, limit)
        
        print(df)
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Query executed successfully'})
        }
    
    except Exception as e:
        print(f"エラーが発生しました: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
```
</details>

### 実行結果
きちんとクエリ結果を取得できていそうです。

```bash
PassengerId  Survived      Fare
0            2         1   71.2833
1            4         1   53.1000
2            7         0   51.8625
3           10         1   30.0708
4           14         0   31.2750
5           24         1   35.5000
6           26         1   31.3875
7           28         0  263.0000
8           32         1  146.5208
9           35         0   82.1708
```


# 注意が必要な点
DuckDBからS3バケットにアクセスするために`httpfs`拡張機能をインストール・ロードする必要があります。

https://duckdb.org/docs/stable/extensions/httpfs/overview.html

その際、ホームディレクトリの設定が必要であることに注意する必要があります。

https://github.com/duckdb/duckdb/issues/3855

これは以下で説明するLambdaのローカルファイルシステムの制約があるためです。

### Lambdaのローカルファイルシステムの制約
Lambda関数内では、**`/tmp`ディレクトリのみ書き込み可能**となっています。これは、Lambda関数が実行される間だけ存在する一時的なストレージで、**エフェメラルストレージ**と呼ばれます。
（デフォルトでは、512MBのサイズとなっており、最大10GBまで設定することができます。ただし、デフォルトから追加したエフェメラルストレージに関しては料金が発生します。）

https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/configuration-ephemeral-storage.html

DuckDBは、デフォルトでは`HOME`ディレクトリ以下にファイル書き込みしようとするため、`HOME`ディレクトリを`/tmp`に設定する必要があります。

# まとめ
- DuckDBからS3バケットにアクセスするために`httpfs`拡張機能をインストール・ロードする必要がある
- DuckDBは、デフォルトでは`HOME`ディレクトリ以下にファイル書き込みしようとする
- Lambda上では、`/tmp`ディレクトリのみ書き込み可能である
- 以上より、`HOME`ディレクトリを`/tmp`に設定する必要がある


# おわりに
本記事では、DuckDBをLambdaで扱うことに取り組みました。少し設定が必要なものの、無事S3バケットのデータを取り扱うことができました。
今後、他のライブラリを利用するときにも今回の知識が活かせるのではないかと思います。
ありがとうございました。
