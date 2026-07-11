---
title: "【CI/CD】GitHub Actions + AWS S3 + CloudFrontで静的サイトのCI/CD環境を構築してみた"
description: "運用していく中で、htmlファイルを更新する度にS3のファイルを更新する（+ CloudFrontのキャッシュ削除）のが手間に感じたので、GitHub Actionsを使って自動デ…"
pubDate: 2025-06-09
tags: ['AWS', 'CICD', 'GitHubActions']
qiitaId: 4117fc08969d055358f5
importedDate: 2026-07-11
qiitaStats:
  views: 11977
  likes: 17
  stocks: 18
  fetchedAt: 2026-07-11
---

# はじめに
以前、デジタル名刺用のプロフィールページをAWS S3（htmlファイル） + CloudFrontで作成しました。（htmlファイルはGitHubで管理しています）

運用していく中で、htmlファイルを更新する度にS3のファイルを更新する（+ CloudFrontのキャッシュ削除）のが手間に感じたので、GitHub Actionsを使って自動デプロイ環境を構築してみました。本記事では、**developブランチにpushするだけで、自動的にS3上のファイルが更新され、CloudFrontのキャッシュも無効化される環境**をどのように構築したのかを解説します。

### 構成図

![profile_domain_cicd.png](https://images.ryu-ki-learn.com/static-site-cicd-github-actions/cc8f5484-f9f8-4c5e-86c4-b21aebd4a3a6.png)

Route53とACMについては以下の記事で解説していますので、そちらをご覧ください。

https://qiita.com/ryu-ki/items/badfd87700b016b414a4

S3とCloudFrontについては以下の記事で解説していますので、そちらをご覧ください。

https://qiita.com/ryu-ki/items/965d35a5b9abe86d0054

:::note warn
後述しますが、本手順で作成されるCI/CD環境は**ベストプラクティスに則しておりません**。その点ご注意ください。（GitHub Actionsを試してみることに重きを置いています）
:::

# 前提条件

- S3バケットで静的ウェブサイトホスティングを設定済み
- CloudFrontディストリビューションを設定済み
- GitHubリポジトリでHTMLファイルを管理している

# 構築手順
### 1. IAMポリシーの設定
以下の必要最小限の権限を持ったポリシーを設定します。
- 該当S3バケットへのファイルの格納
- 該当CloudFrontディストリビューションのキャッシュ削除

#### IAMポリシー作成手順
1. IAMコンソールで「ポリシー」→「ポリシーを作成」
2. ポリシーエディタの「JSON」タブを選択
3. 以下のJSONを入力し、「次へ」を選択
4. ポリシー名を設定し、「このポリシーで定義されている許可」に問題がなければ「ポリシーの作成」を選択

#### ポリシー内容
```json:deploy-to-s3
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation"
            ],
            "Resource": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
        }
    ]
}
```

**注意**：以下は実際の値に置き換えてください。
- `YOUR-BUCKET-NAME`
- `YOUR-ACCOUNT-ID`
- `YOUR-DISTRIBUTION-ID`


### 2. AWS IAMユーザーの作成

GitHub Actionsから使用する専用のIAMユーザーを作成します。

1. AWS IAMコンソールにログイン
2. 「ユーザー」→「ユーザーを作成」を選択
3. ユーザー名：`github-actions-for-profile-website`（任意）を入力
4. 「次へ」を選択
5. 「ポリシーを直接アタッチする」を選択
6. 先ほど作成したポリシーを選択
7. 「次へ」→「ユーザーの作成」を選択

### 3. 作成したIAMユーザーのアクセスキー取得
1. 作成されたユーザーを選択し、「セキュリティ認証情報」タブを開く
2. 「アクセスキーを作成」を選択
3. 「その他」を選択し、「次へ」を選択
4. アクセスキーとシークレットアクセスキーを**安全な場所に保存**
**※この画面を閉じると再度確認できません**

:::note
取得したアクセスキーは「4. GitHub Secretsの設定」で使用します
:::

### 4. GitHub Secretsの設定

リポジトリに認証情報を安全に保存します。

1. GitHubリポジトリの「Settings」タブを選択
2. 「Secrets and variables」→「Actions」を選択
3. 「New repository secret」で以下を追加

| Name | Value |
|------|-------|
| `AWS_ACCESS_KEY_ID` | IAMユーザーのアクセスキー |
| `AWS_REGION` | リージョン（例：ap-northeast-1） |
| `AWS_SECRET_ACCESS_KEY` | IAMユーザーのシークレットキー |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFrontディストリビューションID |
| `S3_BUCKET_NAME` | S3バケット名 |

設定後、以下の画像のようになっていればOKです。

![image.png](https://images.ryu-ki-learn.com/static-site-cicd-github-actions/65c4128a-52e2-4c6c-b458-3012d424bd9d.png)


### 5. GitHub Actionsワークフローの作成

`.github/workflows/deploy-to-s3.yml`を作成します。

```yml:deploy-to-s3.yml
name: Deploy to S3

# developブランチへのpush時に実行
on:
  push:
    branches:
      - develop

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      # リポジトリのコードをチェックアウト
      - name: Checkout code
        uses: actions/checkout@v4
      
      # AWS CLIの認証設定
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      
      # S3へファイルをアップロード
      - name: Upload to S3
        run: |
          aws s3 cp YOUR-HTML-FILE-PATH s3://${{ secrets.S3_BUCKET_NAME }}/YOUR-HTML-FILE-NAME \
            --content-type "text/html; charset=utf-8"
      
      # CloudFrontのキャッシュ無効化
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/YOUR-HTML-FILE-NAME"
```

# トラブルシューティング
以上でCI/CD環境を構築することができますが、ここにたどり着くまでに何度か失敗がありました。

![image.png](https://images.ryu-ki-learn.com/static-site-cicd-github-actions/25f9181c-27de-44bb-a1e9-f56219baac7e.png)

本項では、私が経験した失敗をいくつか共有します。

### 1. S3 PutObject権限エラー

```
An error occurred (AccessDenied) when calling the PutObject operation
```

#### 原因
IAMユーザーにS3への書き込み権限がない

#### 解決方法
- IAMポリシーに`s3:PutObject`権限が含まれているか確認
- リソースARNのバケット名が正しいか確認（**私はこれが原因でした…**）
- S3バケットポリシーでアクセスがブロックされていないか確認

### 2. CloudFront CreateInvalidation権限エラー

```
An error occurred (AccessDenied) when calling the CreateInvalidation operation
```

#### 原因
IAMユーザーにCloudFrontの無効化権限がない

#### 解決方法
- IAMポリシーに`cloudfront:CreateInvalidation`権限を追加
- リソースARNのディストリビューションIDが正しいか確認（**私はこれが原因でした…**）
- アカウントIDが正しいか確認

### 3. ファイルパスの誤り

リポジトリ内のディレクトリ構造に応じてパスを調整
```yaml
# ルートディレクトリの場合
aws s3 cp YOUR-HTML-FILE-NAME s3://...

# サブディレクトリの場合
aws s3 cp YOUR-HTML-FILE-PATH s3://...
```

# 注意したこと

### 1. 最小権限の原則
   - 必要最小限の権限のみを付与
   - 特定のバケット、特定のディストリビューションのみにアクセスを制限

### 2. Secretsの管理
   - 認証情報は必ずGitHub Secretsを使用
   - コードに直接記載しない

# 今後の改善点

本記事で紹介した方法は、IAMユーザーのアクセスキーを使用する従来の方法です。これは動作確認が簡単で導入しやすい一方で、セキュリティのベストプラクティスではありません。

**※より安全な方法として、以下の実装が推奨されます**
- GitHub ActionsのOIDC（OpenID Connect）プロバイダーを使用
- IAMロールとAssumeRoleによる**一時的な認証情報の取得**
- 長期的なアクセスキーの保存を回避

今後、本記事の続編として、OIDCとAssumeRoleを使用したベストプラクティス版の実装に挑戦したいと考えています。

# まとめ
### やったこと
GitHub ActionsとAWS S3 + CloudFrontを組み合わせ、CI/CD環境を構築

### できるようになったこと
以下のワークフローの自動化
1. developブランチへの**push**
2. S3への**ファイルアップロード**
3. CloudFront**キャッシュの無効化**

# おわりに
今回はいちいち手作業で実施していた作業をGitHub Actionsで実現しました。前述の通り、セキュリティ的観点からはまだ不足している部分もありますが、**GitHub Actionsを実際に使ってみることができたのはよかった**と思います。触ってみると簡単に実現できてかなり身近に感じられるようになった気がします。（**IAM周りの設定は大変**でしたが...）
近いうちにベストプラクティスに準拠した形にしたいと思います。
ありがとうございました。
