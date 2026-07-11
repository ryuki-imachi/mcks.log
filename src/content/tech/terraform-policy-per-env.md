---
title: "【Terraform】環境ごとにポリシー（Resource部分のみ）を調整したい"
description: "例として今回はそれぞれの環境で以下のS3バケットのアクセスが許可されていることを目標とします。- 開発環境    - arn:aws:s3:::prd-bucket/    - a…"
pubDate: 2025-03-06
tags: ['AWS', 'Terraform']
qiitaId: d9587bb07d195d8b8fc7
importedDate: 2026-07-11
qiitaStats:
  views: 1349
  likes: 1
  stocks: 0
  fetchedAt: 2026-07-11
---

# はじめに
terraformを使用して、開発（`develop`）環境と本番（`production`）環境で異なるポリシー（`Resource`部分のみ）を設定するのに少し苦戦したので備忘もかねてアウトプットします。

例として今回はそれぞれの環境で以下のS3バケットのアクセスが許可されていることを目標とします。
- 開発環境
    - `arn:aws:s3:::prd-bucket/*`
    - `arn:aws:s3:::dev-bucket/*`
- 本番環境
    - `arn:aws:s3:::prd-bucket/*`

# 作成したコード
```hcl:local.tf
locals {
    # 環境ごとのリソース定義
    resources_by_environment = {
        develop = [
        "arn:aws:s3:::prd-bucket/*",
        "arn:aws:s3:::dev-bucket/*"
        ]
        production = [
        "arn:aws:s3:::prd-bucket/*"
        ]
    }

    # 環境毎に動的に生成されるポリシー
    # ※今回は各環境で環境情報をvar.tags.Environmentとして持っている想定
    dynamic_resources = lookup(local.resources_by_environment, var.tags.Environment, [])

    # 共通ポリシー
    policy = {
        Version = "2012-10-17"
        Statement = [
            {
                Sid    = "Allow access from resources in vpc to S3"
                Effect = "Allow"
                Principal = {
                    AWS = "*"
                }
                Action = [
                    "s3:GetObject",
                    "s3:PutObject"
                ]
                # 動的に作成されたリソースが渡される
                Resource = local.dynamic_resources
            }
        ]
    }
}
```

```hcl:vpc_endpoint.tf（ポリシー設定部分のみ）
resource "aws_vpc_endpoint_policy" "s3" {
  vpc_endpoint_id = aws_vpc_endpoint.s3.id
  policy = jsonencode(local.policy)
}
```

# ポイント説明
### 1. 環境ごとに動的に生成したい部分を`local.tf`として分離
- 今回の例では、ポリシーの`Resource`を`local.tf`で作成

### 2. `lookup()`の利用
- 第1引数で指定したmapに対して、第2引数で指定したキーに対応する値を取得
    - 環境ごとに動的に`Resource`情報を生成することができた

https://developer.hashicorp.com/terraform/language/functions/lookup

### 3. `jsonencode()`の利用
- 与えられた値をJSON文字列に変換
    - `local.tf`で作成したポリシーを変換

https://developer.hashicorp.com/terraform/language/functions/jsonencode


# まとめ
今回は、`locals`と`lookup()`、`jsonencode()`を活用することで、環境ごとに異なるポリシーを作成できるコードについて試してみたことをお話ししました。
正直、terraformは1つのことに対していろいろなコードの書き方があり、正解が1つではないように感じています。
そのような奥深さを楽しみつつ、よりよい（管理しやすい）コード作成をしていきたいと思います。
ありがとうございました。
