---
title: "【GitHub Actions】ユーザー名を変えたら AWS の AssumeRole がうまくいかなくなった"
description: "先日、GitHub のユーザー名を変更しました。"
pubDate: 2026-09-14
tags: ['GitHubActions', 'OIDC', 'AWS', 'IAM', 'Terraform']
qiitaId: 2172b704b225f4cce7f8
importedDate: 2026-09-27
qiitaStats:
  views: 296
  likes: 1
  stocks: 0
  fetchedAt: 2026-09-27
---

## はじめに

先日、GitHub のユーザー名を変更しました。

その後、GitHub Actions から AWS へデプロイしているワークフローが、AssumeRole のところで止まるようになりました。

IAM ロールのポリシーに旧ユーザー名が入っていたので、そこを新しい名前に直せばいいと思っていましたが、実際には直しても通らず、原因は OIDC トークンの `sub` クレームの形式にありました。

この記事では、その切り分けと対処を書きます。

## 前提環境

| 項目         | 内容                                             |
| ---------- | ---------------------------------------------- |
| ワークフロー     | push で S3 へアップロード                              |
| 認証         | aws-actions/configure-aws-credentials@v4（OIDC） |
| IAM ロール    | 生産者のぬくもりを感じる手作り（IaC 管理外）                       |
| リポジトリ作成日   | 2025年5月                                        |
| AWS CLI    | 2.35.14                                        |
| GitHub CLI | 2.92.0                                         |

## 起きていた現象

ユーザー名を変更した直後に push したワークフローが、`Configure AWS credentials` のステップで失敗しました。

```text
##[error]Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity
```

ロールのポリシーを見ると、`sub` の条件に旧ユーザー名が入ったままでした。以下、旧ユーザー名を `old-user`、新しいユーザー名を `new-user`、リポジトリ名を `my-website` と置き換えて書きます。ID も架空の値です。

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:old-user/my-website:*"
  }
}
```

これが原因だと思い、`old-user` を `new-user` に書き換えました。

```bash
aws iam update-assume-role-policy \
  --role-name GitHubActions-S3Deploy-Role \
  --policy-document file://trust-policy.json
```

https://docs.aws.amazon.com/cli/latest/reference/iam/update-assume-role-policy.html

ところが、ワークフローを再実行しても同じエラーで失敗しました。IAM の反映待ちかと思って数分置いてもう一度実行しましたが、結果は変わりませんでした。

## 切り分ける

`aws iam get-role` でポリシーを再度確認しましたが、`sub` は新しいユーザー名になっていて、書き換えは反映されていました。となると、GitHub 側が送ってくる `sub` のほうが想定と違うのではないかと思われます。

そこで、GitHub Actions の OIDC の `sub` について調べていると、2026年7月15日以降に作られたリポジトリでは `sub` の形式が変わる、という話が見つかりました。こちらの記事がわかりやすくまとめてくださっています。

https://kakakakakku.hatenablog.com/entry/2026/08/21/084709

また、公式ドキュメントの OpenID Connect reference には、次のように書かれています。

> For repositories created after July 15, 2026, or that have opted in to immutable subject claims, the `sub` claim includes immutable owner and repository IDs

訳すと、2026年7月15日以降に作られたリポジトリと、immutable subject claim にオプトインしたリポジトリでは、`sub` クレームに変更されない owner ID とリポジトリ ID が含まれる、とのことです。

https://docs.github.com/actions/reference/openid-connect-reference

従来の形式と新しい形式を並べると、以下のようになります。

| 形式 | `sub` の例 |
|------|------|
| 従来 | `repo:new-user/my-website:ref:refs/heads/main` |
| immutable | `repo:new-user@12345678/my-website@987654321:ref:refs/heads/main` |

ただ、私のリポジトリは2025年5月に作ったもので、オプトインもしていません。ドキュメントの記述どおりなら従来の形式のはずですが、念のためリポジトリの `sub` の設定を GitHub CLI で確認してみました。

```bash
gh api repos/new-user/my-website/actions/oidc/customization/sub
```

https://docs.github.com/en/rest/actions/oidc

```json
# 実行結果
{"use_default":true,"use_immutable_subject":false,"sub_claim_prefix":"repo:new-user@12345678/my-website@987654321"}
```

`use_immutable_subject` は false なのに、`sub_claim_prefix` は ID 入りの immutable 形式でした。ポリシーに書いた `repo:new-user/my-website:*` とは一致しません。

## エラーの原因

ユーザー名を変更したあと、このリポジトリの OIDC トークンの `sub` は ID 入りの形式になっており、ポリシーとは一致しなかったため、AssumeRole が拒否されていた、ということのようです。

ドキュメントには「既存のリポジトリはオプトインしない限り影響を受けない」とありますが、手元ではユーザー名の変更をきっかけに新しい形式に切り替わったように見えます。

:::note warn
ユーザー名変更が引き金になったのか、それとも別のタイミングで切り替わっていたのかは、公式ドキュメントに記述が見つかりませんでした。変更前は同じロールで問題なくデプロイできていたので、少なくとも変更の前後で挙動が変わったのは確かです。
:::

## 対処する

ポリシーの `sub` の条件に、従来の形式と immutable 形式の両方を並べました。`StringLike` の値は配列にできます。

```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": [
    "repo:new-user/my-website:*",
    "repo:new-user@12345678/my-website@987654321:*"
  ]
}
```

`StringLike` はワイルドカードの `*` と `?` が使える文字列比較の条件演算子で、値を配列で並べるとどれか一つに一致すれば条件を満たします。

https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html#Conditions_String

owner ID とリポジトリ ID は GitHub CLI で以下のように取れます。

```bash
gh api users/new-user --jq .id
# 実行結果
12345678

gh api repos/new-user/my-website --jq .id
# 実行結果
987654321
```

この状態でワークフローを再実行したところ、3回目にして成功しました。

:::note warn
両方の形式を並べる対処が正解かどうかはわかりません。旧形式の `sub` を許可し続ける必要が無いのであれば、immutable 形式だけに絞るほうが本来の形かもしれません。私の環境ではまず動くことを優先して両方を残しています。
:::

Terraform で管理しているロールでは、あらかじめ両方の形式を `locals` で組み立てておくと、どちらのトークンが来ても通ります。

```hcl
locals {
  github_subjects = concat(
    ["repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"],
    [
      format("repo:%s@%s/%s@%s:ref:refs/heads/%s",
        split("/", var.github_repository)[0], var.github_owner_id,
        split("/", var.github_repository)[1], var.github_repository_id,
        var.github_branch)
    ]
  )
}
```

`var.github_repository` は `owner/repo` の形で受け取り、`split` で owner とリポジトリ名に分けています。こちらのロールは、ユーザー名変更後も `terraform apply` で値を差し替えるだけで問題なく動作しました。

ひとまずめでたしめでたし。

## おわりに

ユーザー名や組織名を変える予定があるなら、変える前にポリシーへ immutable 形式の `sub` を足しておくとエラーの予防になるかと思います。ID は `gh api` ですぐ取れるので、既存のロールに一行足しておいてもいいんじゃないかなと思いました。

同じエラーで困っている方の参考になれば幸いです。

ありがとうございました。
