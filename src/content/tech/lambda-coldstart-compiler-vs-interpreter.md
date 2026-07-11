---
title: "【Lambda】コンパイラ型言語をLambdaで扱ってみるついでにインタープリタ型言語と比較してみた"
description: "先日某所で Lambda を用いてコンパイル型とインタープリタ型の違いを比較するLTを聴きました。その際、そういえばコンパイル型の言語を Lambda で扱ったことがないな〜となり…"
pubDate: 2026-05-23
tags: ['Python', 'Go', 'AWS', 'Lambda', 'CDK']
qiitaId: 0b9736313e7bedc6262e
importedDate: 2026-07-11
qiitaStats:
  views: 2507
  likes: 5
  stocks: 2
  fetchedAt: 2026-07-11
---


## はじめに

先日某所で Lambda を用いてコンパイル型とインタープリタ型の違いを比較するLTを聴きました。その際、そういえばコンパイル型の言語を Lambda で扱ったことがないな〜となりました。せっかくなので簡単に触ってみたいと思います。ついでに実行速度を測って比較もしてみます。

## 前提環境

検証時の手元環境は以下のとおりです。

- macOS（Apple Silicon）
- Node.js v25.2.1
- AWS CDK v2.1124.1
- Go 1.26.3
- Python 3.12（計測スクリプト実行用）

## コンパイラとインタープリタの違い

まず軽くおさらいです。

| 種別 | 変換タイミング | 言語例 |
|------|--------------|---------|
| コンパイラ | 実行前に一括で機械語へ変換 | Go, Rust, C |
| インタープリタ | 実行しながら 1 行ずつ解釈 | Python, Ruby |
| JIT（ハイブリッド） | 実行直前に機械語化 | Java, JavaScript |

コンパイラは「先に全部翻訳しておいて、あとは実行するだけ」、インタープリタは「翻訳しながら走る」というイメージです。

https://www.hpcs.cs.tsukuba.ac.jp/~msato/lecture-note/comp-lecture/note1.html

## Lambda での実装イメージ

Lambda はリクエストが来るたびにコンテナを起動して関数を実行する仕組みなので、起動時に何が走るかでコールドスタート時間が変わります。

### Go（コンパイル型）

手元で `go build` を走らせて機械語バイナリ（`bootstrap`）を作り、それを zip にして Lambda にデプロイします。Lambda 側では bootstrap をメモリに読み込んで実行するだけなので、追加の変換処理は発生しません。

```
[手元]                                   [Lambda]
main.go ──go build──→ bootstrap ──zip──→ ロードして実行するだけ
```

https://docs.aws.amazon.com/lambda/latest/dg/golang-package.html

### Python（インタープリタ型）

`.py` ファイルをそのまま zip して Lambda にデプロイします。Lambda 側では Python インタープリタを起動して、ハンドラを 1 行ずつ解釈しながら実行します。

```
[手元]              [Lambda]
handler.py ──zip──→ Python インタープリタが解釈して実行
```

https://docs.aws.amazon.com/lambda/latest/dg/python-package.html

## 実測の準備

### 計測する4パターン

最小構成だけだと、コンパイル型・インタープリタ型の差というよりは Lambda ランタイムの起動コストの比較になってしまいそうなので、AWS SDK を入れたケースも用意しました。

| 関数名 | 構成 |
|--------|-----|
| go-minimal | Go + aws-lambda-go のみ |
| go-aws | Go + aws-lambda-go + aws-sdk-go-v2 (S3 client) |
| python-minimal | Python のみ（標準ライブラリ） |
| python-boto3 | Python + boto3 (S3 client) |

すべて同じ条件で揃えます。

| 項目 | 値 |
|------|----|
| リージョン | us-east-1 |
| アーキテクチャ | arm64 |
| メモリ | 256 MB |
| Go ランタイム | provided.al2023 |
| Python ランタイム | python3.12 |

### Go の関数コード

最小構成です。

```go
// go-minimal/main.go
package main

import (
	"context"
	"github.com/aws/aws-lambda-go/lambda"
)

type Response struct {
	Message string `json:"message"`
}

func handler(ctx context.Context) (Response, error) {
	return Response{Message: "hello from go-minimal"}, nil
}

func main() {
	lambda.Start(handler)
}
```

AWS SDK 込みの方は `init()` で S3 クライアントを初期化するようにしました。

```go
// go-aws/main.go
import (
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var s3Client *s3.Client

func init() {
	cfg, _ := config.LoadDefaultConfig(context.Background())
	s3Client = s3.NewFromConfig(cfg)
}
```

### Python の関数コード

こちらも最小構成です。

```python
# python-minimal/handler.py
def lambda_handler(event, context):
    return {"message": "hello from python-minimal"}
```

boto3 込みの方は、トップで import + クライアント初期化までを済ませます。これで初期化のコストが Init Duration に乗ります。

```python
# python-boto3/handler.py
import boto3

s3_client = boto3.client("s3")

def lambda_handler(event, context):
    _ = s3_client
    return {"message": "hello from python-boto3"}
```

### CDK でまとめてデプロイ

CDK（TypeScript）でスタックを書きました。

Go のビルドは CDK の `bundling.local` 機能で `go build` を呼び出すようにして、`cdk deploy` 一発で完結するようにしています。

```typescript
// cdk/lib/cdk-stack.ts（抜粋）
function goBundling(srcDirName: string) {
  const srcDir = path.join(PROJECT_ROOT, srcDirName);
  return {
    image: lambda.Runtime.PROVIDED_AL2023.bundlingImage,
    local: {
      tryBundle(outputDir: string): boolean {
        execSync('go mod tidy', { cwd: srcDir, stdio: 'inherit' });
        execSync(
          `GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" ` +
          `-o "${outputDir}/bootstrap" main.go`,
          { cwd: srcDir, stdio: 'inherit' }
        );
        return true;
      },
    },
    command: [
      'bash', '-c',
      'go mod tidy && GOOS=linux GOARCH=arm64 CGO_ENABLED=0 ' +
      'go build -ldflags="-s -w" -o /asset-output/bootstrap main.go',
    ],
  };
}
```

:::note
CDK部分は Claude Code に用意してもらいました。
これで簡単にデプロイできるようになってるんですね。
:::

### 計測スクリプト（コールドスタートを誘発して10回計測）

Lambda のコールドスタートを観測するため、今回は各計測前に環境変数をユニークな値で更新しました。

環境変数は Lambda の関数設定の一部であり、設定更新後は新しい設定でイベントを処理する実行環境が用意されます。これにより、更新完了後の Invoke でコールドスタートを発生させやすくしています。

:::note warn
環境変数の更新によって既存の実行環境がすべて即座に破棄される、と公式に明記されているわけではありません。本記事ではコールドスタートを誘発しやすくするための実験的な手法として扱っています。
:::

```python
# scripts/measure.py（抜粋）
def force_cold_start(function_name: str, marker: str) -> None:
    lambda_client.update_function_configuration(
        FunctionName=function_name,
        Environment={"Variables": {"COLD_START_MARKER": marker}},
    )
    waiter = lambda_client.get_waiter("function_updated")
    waiter.wait(FunctionName=function_name)
```

この後で関数を invoke し、CloudWatch Logs の `REPORT` 行から `Init Duration` を取り出します。

```python
REPORT_RE = re.compile(
    r"Duration: ([\d.]+) ms\s+"
    r"Billed Duration: (\d+) ms\s+"
    r"Memory Size: (\d+) MB\s+"
    r"Max Memory Used: (\d+) MB\s+"
    r"Init Duration: ([\d.]+) ms"
)
```

これを各関数で 10 回ずつ繰り返します。

## 実測結果

実行結果を整理してみると以下の表のようになりました。

| 関数 | 平均 | 中央値 | 最小 | 最大 |
|------|----:|------:|----:|----:|
| Go（最小） | 58.39 ms | 60.57 ms | 52.27 ms | 62.24 ms |
| Go + AWS SDK | 83.03 ms | 85.15 ms | 73.34 ms | 95.45 ms |
| Python（最小） | 80.77 ms | 83.98 ms | 67.60 ms | 87.71 ms |
| Python + boto3 | 575.22 ms | 538.32 ms | 415.49 ms | 789.81 ms |

Python + boto3 だけ明らかに時間がかかっていますね。

## 考察

### 最小構成だけなら Go と Python はほぼ同じ

Go（58 ms）と Python（81 ms）の差は約 23 ms しかありません。

インタープリタ型は起動が重いと言われがちですが、Lambda の場合は Python インタープリタの起動自体はそんなに重い処理ではないようです。少なくともコンパイル型との差は数十 ms で、ほとんどのユースケースでは気にならないレベルだと思います。

### Go は AWS SDK を入れても +25 ms しか増えない

Go（最小）58 ms → Go + AWS SDK 83 ms で、差は約 25 ms となっています。

これは「`go build` の時点で AWS SDK の依存関係はすべて単一バイナリに焼き込まれている」ためです。Lambda 側はバイナリをロードするだけなので、追加されるコストは「バイナリサイズが少し増えた分のロード時間」だけになります。

### Python は boto3 を入れると約7倍重くなる

Python（最小）81 ms → Python + boto3 575 ms で、差は約 495 ms（約7倍）となりました。

`import boto3` は毎回コールドスタートのタイミングで実行されます。boto3 は内部で大量の AWS サービス定義 JSON を読み込み、`botocore` がそれをもとに各サービスのクライアントクラスを動的に生成する仕組みになっています。`import boto3` の1行の裏でこの初期化処理がまとめて走るため、コールドスタートに大きく上乗せされる形になります。

このように、Go と Python で同じく AWS SDK 込みの構成にしましたが、Go は +25 ms、Python は +495 ms かかることがわかりました。

コンパイル型とインタープリタ型の本質的な違いが Lambda のコールドスタート時間という形でわかりやすく観測できたと思います。

## おわりに

以上、簡単ではありましたが、コンパイル型言語を Lambda で動かしてみるついでに、インタープリタ型言語との比較を行ってみました。個人的にはあまり実行時間をシビアに考える機会がなかったのですが、違いを知ることができてよかったです。

ありがとうございました。
