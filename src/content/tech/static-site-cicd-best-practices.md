---
title: "【CI/CD】GitHub Actions + AWS S3 + CloudFrontで静的サイトのCI/CD環境を構築してみた（べスプラ版）"
description: "しかし、セキュリティベストプラクティスの観点から、永続的なクレデンシャルを避け、短期間有効なトークンを使用するOIDC（OpenID Connect）を利用したAssume Rol…"
pubDate: 2025-07-07
tags: ['AWS', 'CICD', 'GitHubActions']
qiitaId: cd9c85240b154a9580bb
importedDate: 2026-07-11
qiitaStats:
  views: 2256
  likes: 6
  stocks: 2
  fetchedAt: 2026-07-11
---

# はじめに
以前、GitHubで管理しているhtmlファイルを更新すると、**自動的にS3上のファイルが更新され、CloudFrontのキャッシュも無効化される環境**を構築しました。

![profile_domain_cicd.png](https://images.ryu-ki-learn.com/static-site-cicd-best-practices/a725ce7d-fc8c-454c-bc8e-26d809b91eca.png)

https://qiita.com/ryu-ki/items/4117fc08969d055358f5

しかし、セキュリティベストプラクティスの観点から、**永続的なクレデンシャルを避け、短期間有効なトークンを使用するOIDC（OpenID Connect）を利用したAssume Role方式**に移行することが推奨されています。

今回はこちらに移行した手順などを備忘として残しておきたいと思います。

# 移行前の構成（従来のIAMユーザー方式）

### ymlファイル

```yml:github-actions-s3upload.yml
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
            aws s3 cp contents/profile-website.html s3://${{ secrets.S3_BUCKET_NAME }}/profile-website.html \
                --content-type "text/html; charset=utf-8"
      
        # CloudFrontのキャッシュ無効化
        - name: Invalidate CloudFront
          run: |
            aws cloudfront create-invalidation \
                --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
                --paths "/profile-website.html"
```

### 従来のIAMユーザー方式の問題点

#### 1. 永続的なクレデンシャルのセキュリティリスク
IAMユーザーのアクセスキーは一度作成されると、明示的に削除するまで永続的に有効です。そのため以下のようなリスクが考えられます。

- GitHub Secretsが何らかの方法で漏洩した場合、攻撃者は24時間365日AWSアカウントにアクセス可能
- アクセスキーがログファイルに誤って出力された場合の長期的な影響

#### 2. キーローテーションの運用負荷
セキュリティベストプラクティスでは、アクセスキーを定期的にローテーション（更新）する必要があります。その際、以下のような課題が考えられます。

- 手動でのキー更新作業が必要
- 複数のリポジトリで同じIAMユーザーを使用している場合、全てのSecretsを同時に更新する必要

#### 3. 最小権限の原則への違反
IAMユーザーに付与された権限は常時有効で、実際に必要な時間（ワークフロー実行時の数分間）を大幅に超えて維持されます。

:::note warn
実際に必要な時間：2-3分（ワークフロー実行時のみ）
IAMユーザーの権限有効時間：24時間365日（永続的）
:::

これは「必要最小限の時間だけ権限を与える」というゼロトラストセキュリティモデルに反しています。

以上のような問題点（リスク）があるため、移行が推奨されています。


### 従来方式との比較
以下のように簡単に違いを整理しました。

| 項目 | 従来のIAMユーザー方式 | Assume Role + OIDC方式 |
|------|---------------------|----------------------|
| **クレデンシャルの有効期間** | 永続的（削除まで有効） | 15分〜1時間（自動期限切れ） |
| **Secretsに保存する情報** | アクセスキー + シークレットキー | なし（ロールARNのみ） |
| **キーローテーション** | 手動で定期実行が必要 | 不要（自動更新） |
| **アクセス元の特定** | IAMユーザー名のみ | リポジトリ・ブランチ・コミット情報 |
| **条件付きアクセス** | 限定的 | 詳細な条件設定が可能 |
| **セキュリティリスク** | 高（永続的なキー） | 低（短期間トークン） |

:::note
情報量が多くなってしまうので、Assume Role + OIDC方式 の詳細な仕組みについては、別記事で書きたいと思います。
:::


# 実際に移行する

### ステップ1：AWS側での設定

#### 1.1 OpenID Connectプロバイダーの作成

1. IAMコンソールの左側メニューから「IDプロバイダ」→「プロバイダーを追加」を選択
2. 以下の情報を入力し、「プロバイダーを追加」を選択
   - プロバイダーのタイプ：`OpenID Connect`
   - プロバイダーのURL：`https://token.actions.githubusercontent.com`
   - 対象者：`sts.amazonaws.com`

![image.png](https://images.ryu-ki-learn.com/static-site-cicd-best-practices/6001e0aa-f563-48fd-9d23-f182e0122f88.png)

#### 1.2 IAMロールの作成

1. IAMコンソールの左側メニューから「ロール」→「ロールを作成」を選択
2. 信頼できるエンティティのタイプ：「ウェブアイデンティティ」を選択
3. 以下の情報を入力し、「次へ」を選択
   - アイデンティティプロバイダー：`token.actions.githubusercontent.com`（先ほど作成したGitHubプロバイダー）
   - Audience：`sts.amazonaws.com`
   - GitHub organization：個人アカウントなのでGitHubユーザー名
   - GitHub repository：利用するリポジトリ名

![image.png](https://images.ryu-ki-learn.com/static-site-cicd-best-practices/f542ad9d-55e8-45a3-835d-54a86363fe9c.png)



#### 1.3 権限ポリシーのアタッチ
必要な権限をアタッチします。今回のS3デプロイ用途では以下のポリシをアタッチしました。
- AmazonS3FullAccess
- CloudFrontFullAccess

#### 1.4 ロール名の設定
最後にロール名を入力し、権限などの確認をしてロールを作成します。

![image.png](https://images.ryu-ki-learn.com/static-site-cicd-best-practices/476dbfa0-41ed-477d-ac8a-0b87d1cb8a02.png)

AWS側の作業は以上で終了です。

### ステップ2：GitHub Actions側の設定

#### 2.1 ワークフローファイルの更新

```yaml
name: Deploy to S3

on:
    push:
        branches:
            - develop

# OIDCトークン取得に必要な権限
permissions:
  id-token: write   # OIDCトークンを取得するために必要
  contents: read    # リポジトリのコンテンツを読み取るために必要

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
        - name: Checkout code
          uses: actions/checkout@v4
      
        # OIDC経由でAWSクレデンシャルを設定
        - name: Configure AWS credentials
          uses: aws-actions/configure-aws-credentials@v4
          with:
            role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActions-S3Deploy-Role
            role-session-name: GitHubActionsSession
            aws-region: ${{ secrets.AWS_REGION }}
      
        - name: Upload to S3
          run: |
            aws s3 cp contents/profile-website.html s3://${{ secrets.S3_BUCKET_NAME }}/profile-website.html \
                --content-type "text/html; charset=utf-8"
      
        - name: Invalidate CloudFront
          run: |
            aws cloudfront create-invalidation \
                --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
                --paths "/profile-website.html"
```

**主な変更点**
1. permissions セクションの追加：OIDCトークン取得に必要
2. 認証方法の変更：`aws-access-key-id`と`aws-secret-access-key`を削除し、`role-to-assume`、`role-session-name`を追加

### 2.2 GitHub Secretsの整理
不要になった、以下のSecretsは削除しておきましょう。
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

私の場合は最終的に以下のようになりました。

![GuyE0tfWwAApW0u.png](https://images.ryu-ki-learn.com/static-site-cicd-best-practices/d3d07b82-6126-4b16-91b0-61c7ede0bdba.png)

以上で作業としては完了です。

### ステップ3：動作確認

最後に適当に変更して、developブランチへプッシュしてみましょう。

![image.png](https://images.ryu-ki-learn.com/static-site-cicd-best-practices/80a6b25a-3fad-44bd-a5ad-b15b2cced2c7.png)

無事、問題なく動いてくれてそうですね。以上で移行は完了です。

# おわりに
OIDCを使用したAssume Role方式により、以下を実現できました。

- 永続的なクレデンシャルの排除
- セキュリティの向上
- 管理の簡素化
- より細かいアクセス制御

実際に移行した感想としては、いざやってみるとそこまで大変ではない印象でした。一方で、仕組みについてはまだ理解があやふやな部分もあるので、整理して記事などでアウトプットしたいと思います。
また、まだ従来のIAMユーザーを利用した方法をとられている方は、この記事をここまで読んでいただいたこの機会に移行することをお勧めします。
ありがとうございました。

# 参考サイト

https://aws.amazon.com/jp/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/

https://zenn.dev/pyhrinezumi/articles/d020f6109db8c1

https://zenn.dev/kou_pg_0131/articles/gh-actions-oidc-aws

https://qiita.com/natsumi_a/items/11d22f4812fcbdc5f98d
