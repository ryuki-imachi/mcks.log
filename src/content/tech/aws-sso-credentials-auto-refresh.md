---
title: "【AWS SSO】credentials の手動更新を自動化してみた"
description: "セッションの有効期限（通常1時間）ごとにいちいち手動更新するのは手間なので、簡単に実施できるようにしたいと思います。"
pubDate: 2025-07-28
updatedDate: 2025-07-29
tags: ['AWS', 'IAMIdentityCenter']
qiitaId: cf85d319b1e0cf974713
importedDate: 2026-07-11
qiitaStats:
  views: 2496
  likes: 4
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに
個人で使っているAWS環境では、おひとり様Organizations環境でSSOを利用しています。そこでの認証情報は以下のように、`~/.aws/credentials`の情報を逐次手動で書き換えるような対応をしていました。

```
[sandbox]
aws_access_key_id=...
aws_secret_access_key=...
aws_session_token=...
```

セッションの有効期限（通常1時間）ごとにいちいち手動更新するのは手間なので、簡単に実施できるようにしたいと思います。

## 実際に設定してみる
いくつか方法があるようですが、本記事では以下リンクを参考に、configファイルを使用した手動設定を実施します。

https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/cli-configure-sso.html#cli-configure-sso-manual

### configファイルの設定
`~/.aws/config`ファイルに以下の設定を追加します。（私は間違えて`~/.aws/credentials`に記載して一度うまくいかなかったので、皆さんは注意してください。）

```
[profile sandbox-profile]                                   # 任意の名前
sso_session = sandbox-sso-session                           # sso-sessionで指定した名前
sso_account_id = xxx                                        # 利用するAWSアカウントID
sso_role_name = xxx                                         # 利用するロール名
region = us-east-1                                          # デフォルトリージョン
output = json                                               # デフォルトの出力形式

[sso-session sandbox-sso-session]                           # 任意の名前
sso_start_url = https://xxx.awsapps.com/start               # IAM Identity CenterのAccessポータルのURL
sso_region = us-east-1                                      # IAM Identity Centerの設定しているリージョン名
sso_registration_scopes = sso:account:access                # この値そのままでOK
```

sandbox-sso-sessionの情報は以下の画像のようにIAM Identity Centerのコンソールから取得しました。

![image.png](https://images.ryu-ki-learn.com/aws-sso-credentials-auto-refresh/fb1a0e27-8dac-4bcf-829f-14056ceadbf0.png)

### AWS CLIでログインする
configに必要な情報を記載できたので、以下コマンドで一時的な認証情報を取得します。

```bash
$ aws sso login --profile sandbox-profile
Attempting to automatically open the SSO authorization page in your default browser.
If the browser does not open or you wish to use a different device to authorize this request, open the following URL:

https://...
```

コマンド実行後に表示されるURLにアクセスすることで、以下画像のような認証画面が表示されます。（環境によっては自動でブラウザに接続されるようです）

![image.png](https://images.ryu-ki-learn.com/aws-sso-credentials-auto-refresh/7ea4d738-1fea-46c1-8a0e-4b0424519d55.png)

### ログイン確認をする
以下コマンドで、現在の認証情報を確認してみます。

```bash
$ aws sts get-caller-identity --profile sandbox-profile
{
    "UserId": "xxx",
    "Account": "xxx",
    "Arn": "arn:aws:iam::xxx:user/Ryu-ki_dev"
}
```

AWSリソースにもアクセスしてみます。
```
$ aws bedrock list-foundation-models --output table \
     --query 'modelSummaries[*].[modelId,modelName,providerName]' \
     --region us-east-1
----------------------------------------------------------------------------------------------------
|                                       ListFoundationModels                                       |
+-----------------------------------------------+----------------------------------+---------------+
|  amazon.titan-tg1-large                       |  Titan Text Large                |  Amazon       |
|  amazon.titan-image-generator-v1:0            |  Titan Image Generator G1        |  Amazon       |
```

情報を取得できており、ちゃんとアクセスできていそうです。

### 注意点
セッションには有効期限があります。期限が切れた場合は再度ログインが必要です。


## おわりに
簡単ではありますが、configファイルを設定し、AWS CLIを利用することで、認証情報の手動更新をしなくてもよい状態にすることができました。AWS CLIはまだまだ使いこなせていないので今後もいろいろ試していきたいと思います。
ありがとうございました。
