---
title: "【Lambda】Lambda LayerへのDuckDBライブラリの追加方法"
description: "しかし、この記事ではCloud9上で実施しており、Lambda上で実施したいと考えていました。本記事では、その前段階にあたる、Lambda Layerに、DuckDBライブラリを追…"
pubDate: 2025-04-21
tags: ['Python', 'AWS', 'Lambda', 'DuckDB']
qiitaId: 636c0e2f8ad34991dac0
importedDate: 2026-07-11
qiitaStats:
  views: 2074
  likes: 1
  stocks: 0
  fetchedAt: 2026-07-11
---

# はじめに
以前、DuckDBを用いて、S3バケット上に保管されているALBアクセスログをクエリする取り組みをしました。

https://qiita.com/ryu-ki/items/584c6b832dedc4f5fcb8

しかし、この記事ではCloud9上で実施しており、Lambda上で実施したいと考えていました。
本記事では、その前段階にあたる、Lambda Layerに、DuckDBライブラリを追加する作業について、備忘を兼ねて実施したことを記録しておきたいと思います。


# 実施環境
- Lambda
    - Python 3.12
- ローカル（zipファイルを用意する環境）
    - WSL2
        - pip・zipインストール済

# Lambda Layer用のzipファイルの作成

### 1. ディレクトリ構造の作成
まず、Lambda Layer用の適切なディレクトリ構造を作成しました。以下公式ドキュメントに記載の通り、Lambda Layerでは、Pythonライブラリは特定のディレクトリ構造に配置する必要があります。（ドキュメントでは`request`ライブラリの例が挙げられています）

https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/python-layers.html#python-layer-paths

```
layer_content.zip
└ python
    └ lib
        └ python3.13
            └ site-packages
                └ requests
                └ <other_dependencies> (i.e. dependencies of the requests package)
                └ ...
```

そのため、以下コマンドを実行します。
```bash
mkdir -p python/lib/python3.12/site-packages
```


### 2. DuckDBライブラリのインストール
作成したディレクトリにDuckDBライブラリをインストールします。

```bash
python3 -m pip install duckdb -t python/lib/python3.12/site-packages
```

- `-t python/lib/python3.12/site-packages`
    - インストール先のディレクトリを指定（通常のシステムディレクトリではなく、作成したディレクトリにインストール）

### 3. Lambda Layer用のzipファイルの作成
最後に、作成したディレクトリ構造とDuckDBライブラリを含むzipファイルを作成しました。

```bash
cd <path_to_python_dir> && zip -r duckdb_layer.zip python
```

- `-r`
    - ディレクトリを再帰的に圧縮（サブディレクトリも含める
- `duckdb_layer.zip`
    - 作成する zip ファイル名
- `python`
    - 圧縮するディレクトリ

### 4. （おまけ）作成したzipファイルの確認
作成した zip ファイルのサイズを確認しました。

```bash
du -h /home/<path_to_zip_file>/duckdb_layer.zip
```

- `-h`
    - サイズに応じて読みやすい単位で表示する

実行結果はいかのようになりました
```
20M     /home/<path_to_zip_file>/duckdb_layer.zip
```

これらのコマンドで、ファイルが正常に作成されたこと（約20MBのサイズ）を確認しました。ちなみに、公式ドキュメントによると圧縮時で50MBが上限だそうです。

https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/gettingstarted-limits.html


ついでに、Amazon Q Developer CLIでも確認してもらいました。
![image.png](https://images.ryu-ki-learn.com/lambda-layer-duckdb/a1613009-4b5a-4d3c-9001-f216c2a902a8.png)

以上で、AWS Lambdaで使用できるDuckDBライブラリを含むLambda Layer用のzipファイルが作成されました。このzipファイルをマネコンまたはAWS CLIを使用してアップロードすることで、Lambda関数からDuckDBライブラリを利用できるようになります。


# Lambda Layerへのライブラリの追加
今回はせっかくなので、AWS CLIを利用してLayerへの追加を実施していきます。

### 1. DuckDBレイヤーの作成
まず、先ほど作成したzipファイルを使ってレイヤーを作成します。以下コマンドを実行します。

https://docs.aws.amazon.com/cli/latest/reference/lambda/publish-layer-version.html

```bash
aws lambda publish-layer-version \
  --region ap-northeast-1 \
  --layer-name duckdb-layer-python312 \
  --description "DuckDB Lambda Layer for Python 3.12" \
  --compatible-runtimes python3.12 \
  --zip-file fileb:///home/<path_to_zip_file>/duckdb_layer.zip
```

- `--region`
    - 使用するリージョン
- `--layer-name`
    - レイヤーの名前
- `--description`
    - レイヤーバージョンの説明
- `--compatible-runtimes`
    - 互換性のある関数のランタイムのリスト
- `--zip-file`
    - アップロードするzipファイルへのパス

マネコンから確認すると、きちんと作成されていることも確認できます。
![image.png](https://images.ryu-ki-learn.com/lambda-layer-duckdb/6be09030-b107-40ed-bd87-08c83a5584f6.png)


### 2. 作成したレイヤーをLambdaに適用
今回は`duckdbS3Access`という名前のLambdaに適用します。

https://docs.aws.amazon.com/cli/latest/reference/lambda/update-function-configuration.html

```bash
aws lambda update-function-configuration \
  --region ap-northeast-1 \
  --function-name duckdbS3Access \
  --layers arn:aws:lambda:ap-northeast-1:<accountID>:layer:duckdb-layer-python312:1
```

- `--region`
    - 使用するリージョン
- `--function-name`
    - レイヤーの名前（ARNも可）
- `--layers`
    - 適用するレイヤーのリスト
        - ARNとバージョンの指定が必要

こちらもマネコンから確認したところ、問題なく適用できていそうです。
![image.png](https://images.ryu-ki-learn.com/lambda-layer-duckdb/7e09628d-ee3e-4ee1-9da1-507539067dc4.png)

# まとめ
- Zipファイル作成時
    - Pythonライブラリの追加には規定のディレクトリ構造が必要
        - `python/lib/python3.xx/site-packages/`
    - `pip`コマンドで特定のディレクトリにライブラリをインストールする際は`-t`オプションを使用
- レイヤー作成時
    - `publish-layer-version`を使用
- レイヤー適用時
    - `update-function-configuration`を使用

# おわりに
今までレイヤーの追加には、以下リンクのような有志の方が作成してくださっているARNを利用していました。

https://github.com/keithrozario/Klayers/tree/master/deployments/python3.12

しかし、今回は自分でzipファイルを準備し、レイヤーを追加してみました。そこまで複雑なことをするわけではないので、1度経験してしまえば今後は問題なく追加できるかなと思います。

今回で、LambdaでDuckDBが使える状態にできましたので、今度は実際にS3バケットのデータにアクセスする部分の実践をしていきたいと思います。
ありがとうございました。
