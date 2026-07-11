---
title: "【DuckDB】新人でもDuckDBでALBアクセスログを処理したい"
description: "このようなことから、DuckDBを用いたログ収集を試みることにしました。"
pubDate: 2025-01-24
updatedDate: 2025-01-29
tags: ['AWS', 'ALB', 'DuckDB']
qiitaId: 584c6b832dedc4f5fcb8
importedDate: 2026-07-11
qiitaStats:
  views: 2526
  likes: 5
  stocks: 1
  fetchedAt: 2026-07-11
---

# はじめに
タイトルの通り、ALBアクセスログを簡単に収集するために、DuckDBの検証などに取り組んだので、その内容を記事としてアウトプットしました。
DuckDBに関してはある程度広まっていて、n番煎じな内容になりますが、自分がやったことの記録として記事に残しておきたいと思います。

:::note info
以下作業は、Cloud9上で実施しておりますのでご注意ください。
:::

# 状況
私が保守を担当しているシステムでは（レスポンスタイムに関する）アラートが発生した際、原因を特定するために、まずALBアクセスログを確認しています。（その後、ECSのログを確認していますが、今回の話題とは関係ないので割愛します。）
ALBアクセスログはS3バケットに保管されています。

## As-Is
現状では、ログ収集が以下のような手順の手作業になっており、時間がかかったり収集漏れがあったりする状態になっています。
1. マネコンからS3バケットを開く
1. オブジェクトの保存時間を見てログが入っていそうなオブジェクト（gzファイル）をダウンロードする
1. ローカルで解凍する
1. ログを確認する
1. 圧縮ファイルを削除する
1. 欲しいログがなければ、再度ダウンロードする（2に戻る...）


## To-Be
そのため、ログ収集の簡単化を目指します。
（最終的にはアラートをトリガーに自動でログが集まっている状態が理想？）
※簡単化：（SQLを実行して結果を取得する）スクリプトを実行すれば、集めたい期間のログを集めることができる状態であること

このようなことから、DuckDBを用いたログ収集を試みることにしました。

# DuckDBとは
DuckDBは、オープンソースの組み込み型OLAPデータベース管理システムです。
SQLiteのOLAP版と言われることが多いそうです。
※OLAP（Online Analytical Processing）：データを多次元的に分析し、その結果を迅速にユーザーに返す手法のこと（Online：リアルタイムに分析結果を返すこと）

また、公式では、以下のようなことが強みとして挙げられています。
- シンプル（Simple）
- ポータブル（Portable）
- 豊富な機能（Feature-Rich）
- 高速（Fast）
- 拡張可能（Extensible）
- 無料（Free）
- 徹底したテスト（Thorough Testing）

https://duckdb.org/

https://duckdb.org/why_duckdb

では、ログ取得の仕組みについて説明する前に、まずは事前に必要な準備について簡単に説明します。

# 事前準備
## ALBアクセスログの保存の有効化
今回は説明を省略しますので、以下の記事などを参考に実施してください。

https://docs.aws.amazon.com/ja_jp/elasticloadbalancing/latest/application/enable-access-logging.html

## S3バケットポリシーの追加
今回はCloud9で作業をしますので、Cloud9からS3バケットへアクセスできるようにポリシーを追加します。
以下のようなポリシーを追加しました。
```json
{
    "Sid": "AlbAccessLogsPolicyForDuckDB",
    "Effect": "Allow",
    "Principal": {
        "AWS": "Cloud9にアタッチされているIAMロールのarn"
    },
    "Action": "s3:GetObject",
    "Resource": [
        "ALBアクセスログを保管しているS3バケットのarn"
    ]
}
```

## DuckDBのインストール
以下を参考にインストールできます。（とても軽いです）

https://duckdb.org/docs/installation/?version=stable&environment=cli&platform=linux&download_method=direct&architecture=x86_64

  ```bash
  curl -LO https://github.com/duckdb/duckdb/releases/download/v1.1.3/duckdb_cli-linux-amd64.zip
  unzip duckdb_cli-linux-amd64.zip
  ```

※python APIも用意されており、pythonで扱いたい場合は以下のように`pip install`します。

https://duckdb.org/docs/api/python/overview

```sh
pip install duckdb
```

事前準備は以上です。
ここからアクセスログを取得する仕組みについて説明していきます。

  ---

# ログを取得する仕組みのイメージ
1. S3から指定した期間の**ログファイルをダウンロード**する
1. 取得したログファイルをDuckDBにインポートする（**テーブル化**する）
1. クエリを叩き、**結果をcsvファイルとして出力**する

# 実際の実装例
## 実行するスクリプト（ラッパースクリプト）
- `get_alb_log.sh`
  - `yyyy/mm` `env`を引数に取ります。

```sh:get_alb_log.sh
#!/bin/bash

set -e

# 引数の確認
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <yyyy/mm> <env>"
    exit 1
fi

# 引数の取得
DATE="$1"
ENV="$2"

# pythonスクリプト用の変換(yyyy/mm → yyyymm)
DATE_FOR_PY=${DATE//\//}

# s3からALBログをダウンロード
./get_alb_log_from_s3.sh "$DATE" "$ENV"

# ログをテーブルへインポートする
echo "import table"
python3 create_tables.py "$DATE_FOR_PY"

# クエリ結果をcsvに出力する
echo "outout result"
python3 get_result.py "$DATE_FOR_PY"

# DBファイルを削除する
rm -f alb_log.db
```

## 1. ログファイルのダウンロード
- `get_alb_log_from_s3.sh`
  - `yyyy/mm` `env`を引数に取ります。

```sh:get_alb_log_from_s3.sh
#!/bin/bash

# 引数の確認
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <yyyy/mm> <env>"
    exit 1
fi

# 引数の取得
DATE_PATH=$1
ENV=$2

ACCOUNT_ID="0"

# 環境ごとのアカウントidを設定
# ※S3バケットURIの指定時に利用
if [ "$ENV" = "dev" ]; then
    ACCOUNT_ID="YOUR_DEV_ACCOUNT_ID"
elif [ "$ENV" = "prd" ]; then
    ACCOUNT_ID="YOUR_PRD_ACCOUNT_ID"
else
    echo "Error: <env> must be dev or prd."
    exit 1
fi

# yyyy/mm/dd フォーマットの確認
if ! [[ "$DATE_PATH" =~ ^[0-9]{4}/[0-9]{2}$ ]]; then
    echo "Error: Date must be in yyyy/mm format."
    exit 1
fi

# ダウンロード元とダウンロード先のパスの作成
S3_PATH="アクセスログを保存しているS3バケットURI"
LOCAL_DIR="ダウンロードするログファイルの、Cloud9上での保存場所"

# フォルダが存在するかを確認
if [ -d "$LOCAL_DIR" ]; then
  echo "'$LOCAL_DIR' already exists."
else
  # フォルダを作成
  mkdir -p "$LOCAL_DIR"
  if [ $? -eq 0 ]; then
    echo "'$LOCAL_DIR' has been created."
  else
    echo "Failed to create '$LOCAL_DIR'"
    exit 1
  fi
fi

# aws s3 cp コマンドの実行
echo "Downloading from $S3_PATH to $LOCAL_DIR..."
if aws s3 cp "$S3_PATH" "$LOCAL_DIR" --recursive; then
    echo "Download completed successfully."
else
    echo "Error during download."
    exit 1
fi
```

## 2. ログファイルをDuckDBへインポート
- `create_tables.py`
  - `yyyymm`を引数に取ります。

こちらで行われている処理は、パーティション射影と呼ばれ、こちらの記事を参考にさせていただきました。

https://road288.hatenablog.com/entry/2024/11/06/113954

```py:create_tables.py
import duckdb
import argparse

# 引数をパース
parser = argparse.ArgumentParser(description="引数の指定する期間のALBログをテーブルへインポートする")
parser.add_argument("date", type=str, help="yyyy/mm を指定してください")
args = parser.parse_args()

# データベースファイルを作成または接続
con = duckdb.connect(database='alb_log.db', read_only=False)

# テーブルの作成
con.execute(f"""
    CREATE TABLE alb_log AS
    SELECT *
    FROM read_csv(
        '[Cloud9上での保存場所]/*/*.gz',
        columns={{
            'type': 'VARCHAR',
            'timestamp': 'TIMESTAMP',
            'elb': 'VARCHAR',
            'client_ip_port': 'VARCHAR',
            'target_ip_port': 'VARCHAR',
            'request_processing_time': 'DOUBLE',
            'target_processing_time': 'DOUBLE',
            'response_processing_time': 'DOUBLE',
            'elb_status_code': 'INTEGER',
            'target_status_code': 'VARCHAR',
            'received_bytes': 'BIGINT',
            'sent_bytes': 'BIGINT',
            'request': 'VARCHAR',
            'user_agent': 'VARCHAR',
            'ssl_cipher': 'VARCHAR',
            'ssl_protocol': 'VARCHAR',
            'target_group_arn': 'VARCHAR',
            'trace_id': 'VARCHAR',
            'domain_name': 'VARCHAR',
            'chosen_cert_arn': 'VARCHAR',
            'matched_rule_priority': 'VARCHAR',
            'request_creation_time': 'TIMESTAMP',
            'actions_executed': 'VARCHAR',
            'redirect_url': 'VARCHAR',
            'error_reason': 'VARCHAR',
            'target_port_list': 'VARCHAR',
            'target_status_code_list': 'VARCHAR',
            'classification': 'VARCHAR',
            'classification_reason': 'VARCHAR',
            'conn_trace_id': 'VARCHAR'
        }},
        delim=' ',
        quote='"',
        escape='"',
        header=False,
        auto_detect=False
    )
""")

# 接続を閉じる
con.close()

```

## 3. クエリの実行・結果の出力
- `get_result.py`
  - `yyyymm`を引数に取ります。
  - 本例では、レスポンスタイムが0より大きいものだけを抽出しています。
    - `WHERE response_processing_time > 0 `

```py:get_result.py
import duckdb
import argparse

# 引数をパース
parser = argparse.ArgumentParser(description="引数の指定する期間のALBログをクエリした結果を返す")
parser.add_argument("date", type=str, help="yyyymm を指定してください")
args = parser.parse_args()

# データベースファイルに接続
con = duckdb.connect(database='alb_log.db', read_only=True)

# クエリ結果をCSVファイルへのエクスポート
con.execute(f"""
    COPY (
        SELECT
            timestamp, 
            elb, 
            client_ip_port, 
            target_ip_port, 
            response_processing_time, 
            elb_status_code, 
            target_status_code, 
            request
        FROM
            alb_log
        WHERE
            response_processing_time > 0        
    )
    TO 'output_{args.date}.csv' (HEADER, DELIMITER ',')
""")

# 接続を閉じる
con.close()
```
実行すると以下のようなcsvファイルが取得できています。
（`timestamp`と`response_processing_time`以外の情報はマスキングしています）
![duck_query_result_example_masking.png](https://images.ryu-ki-learn.com/duckdb-alb-access-logs/9064895f-6629-ac62-579a-5b0baa824ddc.png)

# 今後の展望
以上で、自動化が（いったん）実現できました。
次は以下のようなことに取り組みたいと考えています。
- GUIを導入し、簡単にクエリを叩くことができるようにする
  - DBeaverなどを利用すれば簡単に実現できそう
- ALBアクセスログの各メトリクスの可視化
  - DuckDBのテーブルにインポートできているので、PowerBIのようなBIツールなどを用いれば実現可能と考えられる
- 他サービス（ECS）のログとの紐づけ
  - うまく利用できる外部キーを用意することができれば（ここがポイントではあるが）実現できそうに感じる

# おまけ（Athenaについて）
ここまでDuckDBでの実装について書いてきましたが、アクセスログがS3バケットに保存されているのであればAthenaを使わないのかと思われた方もいるかと思います。
私も実際にAthenaについて調べ、触ってみたのですが、以下のようなことが理由で採用を見送りました。（Athenaのいいところについてご存じの方がいらっしゃれば教えてください）

- スクリプトで実施する際に優位性を感じる
  - 使い慣れているpythonでAPIが提供されているため、比較的**簡単に実装可能**（イメージとしてはSQLiteのようなもの）
  - Athenaも不可能ではないと思われるが、情報があまりなく、ハードルを感じる
- Cloud9上で作業を実施する（IAMロールでアクセス制御する）ため、**セキュリティリスクはAthenaと同等程度**と思われる
- 以下の条件に合致するので**データ転送に料金はかからない**認識である
  - Amazon S3 バケットから S3 バケットと同じ AWS リージョン内の任意の AWS のサービスに転送されたデータ (同じ AWS リージョン内の別のアカウントに転送されたデータを含む)
    - [公式](https://aws.amazon.com/jp/s3/pricing/) より引用

## 比較の際に作成した表
| 比較観点 | DuckDB | Athena |
| --- | --- | --- |
| **アーキテクチャ** | ローカル動作の列指向データベースエンジン | サーバーレスの分散クエリサービス |
| **利用用途** | 小～中規模データ処理、ローカル分析 | 大規模データ分析、データレイククエリ |
| **デプロイメント** | シンプルなローカルセットアップ | AWSアカウントとS3データの設定が必要<br>※現環境であればほぼ不要 |
| **パフォーマンス** | メモリ内計算で小～中規模データに最適 | 分散処理で大規模データセットに対応 |
| **スケーラビリティ** | 1台のマシンに依存<br>※本ケースではCloud9上で利用 | 分散クエリエンジンでスケーラブル |
| **対応データフォーマット** | CSV、Parquet、JSON、SQLiteなど | CSV、Parquet、ORC、Avro、JSONなど |
| **接続性と統合** | Python、R、CLIなどから利用可能 | JDBC/ODBCでBIツールやAWSサービスと統合 |
| **データセキュリティ** | ローカル管理でネットワーク依存が少ない<br>※本ケースではCloud9上で利用<br>（→ IAMロールによるアクセス制御） | IAMによるアクセス制御、データ暗号化可能 |
| **ユースケースの柔軟性** | 機械学習前処理、ローカルETL、データ分析<br>※ECSなど他サービスのログも活用可能 | データレイク分析、ログ解析、サーバーレスETL<br>※S3に保存・蓄積したログに対してのみ分析可能 |

# おわりに
以上、DuckDBを用いて自動でALBアクセスログをクエリし、その結果をcsvファイルで取得する仕組みの説明を行いました。
DuckDBは敷居が低く、比較的簡単にここまでの実装ができたと思います。
今後の展望に書いたようなことを進めながら、保守作業がより簡単で漏れのないようなものにできればと思います。
ありがとうございました。

# 参考にさせていただいたサイト

https://road288.hatenablog.com/entry/2024/11/06/113954

https://zenn.dev/babyjob/articles/mackey0225-use-duckdb-in-cloudshell

https://qiita.com/watany/items/a2d4f767674b969c5e89#%E4%BD%BF%E3%81%84%E6%96%B9
