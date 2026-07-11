---
title: "【Bedrock】 恥を忍んでモデル呼び出しのログ記録の設定をする"
description: "恥ずかしながら今まで Bedrock のモデル呼び出しのログを設定しておらず、ちょっと困ったことがあったので、設定します。以下のドキュメント・記事を参考に進めました。"
pubDate: 2025-12-13
updatedDate: 2025-12-18
tags: ['AWS', 'ログ', 'Bedrock']
qiitaId: 7b67f2846748f457656c
importedDate: 2026-07-11
qiitaStats:
  views: 2183
  likes: 2
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

恥ずかしながら今まで Bedrock のモデル呼び出しのログを設定しておらず、ちょっと困ったことがあったので、設定します。以下のドキュメント・記事を参考に進めました。

https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/model-invocation-logging.html

https://dev.classmethod.jp/articles/amazon-bedrock-model-invocation-logging/

## 流れ

設定の流れは以下の通りです。

- ログを格納する S3 バケットの用意
- ログを格納する CloudWatch Logs ロググループの用意
- Bedrock 設定画面にて、モデル呼び出しのログ記録の設定

## S3 バケットの用意

任意の名前の S3 バケットを作成します。設定については、私はすべてデフォルトで作成しました。

その後、バケットポリシーを設定します。以下はドキュメントから引用したもので、`accountId`、`region`、`bucketName`、`prefix` を書き換える形です。

```json
{
    "Version":"2012-10-17",		 	 	 
    "Statement": [
        {
            "Sid": "AmazonBedrockLogsWrite",
            "Effect": "Allow",
            "Principal": {
                "Service": "bedrock.amazonaws.com"
            },
            "Action": [
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::bucketName/prefix/AWSLogs/123456789012/BedrockModelInvocationLogs/*"
            ],
            "Condition": {
                "StringEquals": {
                    "aws:SourceAccount": "123456789012"
                },
                "ArnLike": {
                    "aws:SourceArn": "arn:aws:bedrock:us-east-1:123456789012:*"
                }
            }
        }
    ]
}
```

また、過去のものを置いていてもおそらく見ることはなかなかないので、30日を経過したデータは削除するようなライフサイクルルールを設定しています。

![image.png](https://images.ryu-ki-learn.com/bedrock-invocation-logging/6bc44143-d9e6-4bb6-9f0f-6ceafc7eb042.png)

## CloudWatch Logs ロググループの用意

こちらは自由にロググループを作成するだけです。私は基本触っているタイミングでしか見ないと思うので、とりあえず保持期間を1日に設定しています。

![image.png](https://images.ryu-ki-learn.com/bedrock-invocation-logging/15bfad68-5fd0-41f6-8f60-255c2b5c829f.png)

:::note
ドキュメントではロールを作成する手順が説明されていますが、後続の Bedrock の設定画面で新しいロールを作成できるので、ロールを作成する手順はスキップしています。
:::


## モデル呼び出しのログ記録の設定

Bedrock の設定画面から設定を行います。

ログに含めるデータタイプはとりあえず、すべて選択しておき、先ほど設定した、S3 と CloudWatch Logs の設定を入力します。前述の通り、CloudWatch Logs の部分のロールについては新しいロールを作ってもらいました。

なお、100KB を超えるデータは CloudWatch Logs に吐き出されないようです。こちらのデータを置いておく S3 の場所も聞かれるのですが、とりあえず上記で作成したものと同じ場所を設定しました。

![スクリーンショット 2025-12-13 013457.png](https://images.ryu-ki-learn.com/bedrock-invocation-logging/fa8fdd89-91d9-4eb7-97c1-c1b018a1c7f9.png)

## ログが出力されているか確認

以上で設定は完了しました。最後にちゃんとログが出力されているか確認しましょう。

![image.png](https://images.ryu-ki-learn.com/bedrock-invocation-logging/a4450386-3f20-4a47-af00-bc3fe6ac4b72.png)

ちゃんと出力されていそうですね。以上で作業は終了です。

## おわりに

思った以上に簡単にできたので、なんで今までやっていなかったんだと自分を叱りながらこの記事を書きました。

実は設定していなかったそこのあなたもこちらを参考にこそっと設定していただけると幸いです。

ありがとうございました。
