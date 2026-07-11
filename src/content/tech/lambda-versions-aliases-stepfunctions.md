---
title: "【Lambda】更新したLambdaをStep Functionsに正しく反映させるには　～バージョンとエイリアス～"
description: "私は以下のような構成でAWSサービスを利用していました。"
pubDate: 2025-04-01
tags: ['AWS', 'Lambda', 'StepFunctions']
qiitaId: e2eba536d60c93ca2dc3
importedDate: 2026-07-11
qiitaStats:
  views: 2085
  likes: 0
  stocks: 0
  fetchedAt: 2026-07-11
---

# はじめに
AWSでStep FunctionsとLambda関数を連携させており、Lambda関数を更新したのに、Step Functionsからの実行時に変更が反映されないという問題に遭遇しました。この記事では、その原因と解決方法について実施したことを整理してアウトプットします。

# 問題の概要

私は以下のような構成でAWSサービスを利用していました。

- EventBridgeで毎朝7時にStep Functionを起動
- Step Function内からLambda関数を呼び出して処理を実行

ある日、Lambda関数のコードを更新したにもかかわらず、Step Functionの実行時にその変更が反映されていないことに気づきました。（以下画像のように、`published_date`列を削除して、`published_at`列を作成したつもりが混在している）

![スクリーンショット 2025-03-30 165355.png](https://images.ryu-ki-learn.com/lambda-versions-aliases-stepfunctions/e6a9890e-4cc8-4222-a12d-efb0c4883b28.png)

調査の結果、いくつかのポイントが明らかになりました。

# 問題の原因

Step FunctionsからLambda関数を呼び出す際、以下のような参照方法があります。

```json
"FunctionName": "arn:aws:lambda:ap-northeast-1:123456789012:function:myFunction:$LATEST"
```

ここでの問題点は、Lambda関数の参照方法とバージョン管理の仕組みにあります。

### Lambda関数のバージョンとエイリアスについて

Lambdaには「バージョン」と「エイリアス」という2つの重要な概念があります。

#### バージョン
- 特定時点のLambda関数のコードと設定を保存したスナップショット
- 一度発行されたバージョンは変更できない（不変）
- 自動的に1, 2, 3...と番号が割り当てられる
- 例：`arn:aws:lambda:region:account-id:function:function-name:1`
    - 修飾ARNという（バージョンのサフィックスが付いた関数ARN）

#### エイリアス
- 特定のバージョンを指す「名前付きの参照」（ポインタ）
- いつでも別のバージョンを指すように変更可能
- 「prod」「dev」などの意味のある名前を付けることができる
- 例：`arn:aws:lambda:region:account-id:function:function-name:prod`

#### $LATESTについて
- 常に最新にデプロイされたコードを指す特殊な識別子
- 予測不可能な動作を引き起こす可能性があるため、本番環境での使用は推奨されていない

私の場合、Step Functionsの定義で`$LATEST`を使用していたため、Lambda関数の更新が自動的に反映されると思っていましたが、実際にはそうなっていませんでした。

# 解決方法

以下のような手順で問題を解決しました。

### 1. Lambda関数の新しいバージョンを発行する

1. AWSマネジメントコンソールにログインし、Lambda サービスに移動
2. 対象のLambda関数を選択
3. 「アクション」ボタン → 「新しいバージョンを発行」を選択
4. 必要に応じて説明を入力し、「発行」をクリック

これにより、現在のコードが新しいバージョン（例：バージョン1）として保存されます。

![スクリーンショット 2025-03-30 165127.png](https://images.ryu-ki-learn.com/lambda-versions-aliases-stepfunctions/50ce874f-1929-4d14-9e48-b7f23cd45f8b.png)

### 2. エイリアスを作成する

1. 同じLambda関数の画面で、「エイリアス」タブを選択
2. 「エイリアスの作成」をクリック
3. 以下の情報を入力：
   - 名前：「dev」（または任意の名前）
   - バージョン：先ほど発行した新しいバージョン
   - 説明：任意の説明

![スクリーンショット 2025-03-30 165023.png](https://images.ryu-ki-learn.com/lambda-versions-aliases-stepfunctions/f8352af2-e032-4720-a657-0a6bc59ed3e3.png)

### 3. Step Functionsのステートマシン定義を更新する

1. Step Functions サービスに移動
2. 対象のステートマシンを選択し、「編集」をクリック
3. 定義内のLambda関数参照部分を以下のように更新

変更前:
```json
"FunctionName": "arn:aws:lambda:ap-northeast-1:123456789012:function:myFunction:$LATEST"
```
変更後:
```json
"FunctionName": "arn:aws:lambda:ap-northeast-1:123456789012:function:myFunction:dev"
```

### 4. IAM権限の確認と追加

Step FunctionsがLambda関数を呼び出せるよう、適切なIAM権限が設定されていることを確認します。

1. IAM サービスに移動
2. Step Functionsに関連付けられたロールを選択
3. 必要に応じて以下のようなインラインポリシーを追加：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "lambda:InvokeFunction",
            "Resource": [
                "arn:aws:lambda:ap-northeast-1:123456789012:function:myFunction:*"
            ]
        }
    ]
}
```

以上を実施し、Step Functionsを実行したところ、問題なく実行することができました。

# 将来的なLambda関数の更新方法

エイリアスを使用する設定に変更した後は、以下の手順でLambda関数を更新できます。

1. Lambda関数のコードを更新
2. 「アクション」→「新しいバージョンを発行」で新バージョンを作成
3. 「エイリアス」タブで作成したエイリアス（例：dev）を選択
4. 「編集」をクリックし、新しいバージョンを指すように更新

この方法より、Step Functionsの定義を変更する必要がなく、エイリアスの更新だけで新しいバージョンのLambda関数が呼び出されるようになります。

# まとめ

Lambda関数とStep Functionsを連携させる際は、以下のポイントに注意しましょう。

1. 本番環境では`$LATEST`の使用を避け、代わりにバージョンとエイリアスを活用する
2. Lambda関数を更新した後は新しいバージョンを発行し、エイリアスを更新する
3. Step FunctionsのIAM権限が正しく設定されていることを確認する

# おわりに
今回はLambdaの変更がStep Functions実施時に反映されていなかった問題に対して実施したことをまとめました。バージョンやエイリアスについての理解が曖昧だったので良い勉強になりました。私は現状ではまだ1つの環境（開発環境）でしか構築していませんが、本番環境など複数の環境で構築していく際にはより重要になってくるのかなと思います。今後より適切にこのあたりを扱っていければと思います。ありがとうございました。


# 参考サイト

https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/configuration-aliases.html

https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/configuration-versions.html

https://docs.aws.amazon.com/ja_jp/step-functions/latest/dg/connect-lambda.html
