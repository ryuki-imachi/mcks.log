---
title: "【AWS Organizations】複数アカウントコストを通知する仕組みを Terraform で構築してみた"
description: "みなさん、AWSアカウントのコスト管理はできていますでしょうか。私は AWS Budgets を設定しています。しかし、AWS Budgets を設定すれば「月の予算を超えそうかど…"
pubDate: 2026-03-09
tags: ['AWS', 'Terraform', 'CostExplorer']
qiitaId: 9db7c7b5c0ab750021d1
importedDate: 2026-07-11
qiitaStats:
  views: 1471
  likes: 5
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

みなさん、AWSアカウントのコスト管理はできていますでしょうか。私は AWS Budgets を設定しています。しかし、AWS Budgets を設定すれば「月の予算を超えそうかどうか」はわかりますが、「どのアカウントの何のサービスにお金がかかっているのか」まではわかりません。そのため、結局コンソールを開いて Cost Explorer を確認することになり、少し面倒です。

そこで、週次でアカウント別・サービス別のコストを集計し、先週との比較付きでメール通知するシステムを Terraform で構築しました。

こんな感じのレポートが毎週メールで届きます。

![スクリーンショット 2026-03-09 1.18.10.png](https://images.ryu-ki-learn.com/org-cost-notification-terraform/cdef9014-7c1a-403d-8cf1-afde5979e49c.png)

## 前提条件

- AWS Organizations を利用中（複数アカウント構成）
- Terraform CLI インストール済み
- AWS CLI v2 と AWS SSO（IAM Identity Center）が設定済み
- Python 3.12

## アーキテクチャ

![1.png](https://images.ryu-ki-learn.com/org-cost-notification-terraform/0c480381-e6b2-442a-8dc9-8333084c207a.png)

管理アカウントにはクロスアカウント IAM ロールだけを配置し、Lambda や SNS などの実行リソースは全て専用の監視アカウントに集約しています。監視アカウント自体も Terraform で新規作成していますが、Terraform state の保存先（S3）も同時に作る必要があるため、bootstrap（ローカル state）→ メイン（S3 backend）の 2 段構成にしています。

## クロスアカウント IAM 設計

今回は3つのロールを用意し、使い分けています。

| ロール | 配置先 | 権限 |
|---|---|---|
| `cost-monitor-cross-account-role` | 管理アカウント | Cost Explorer / Organizations の参照 |
| `cost-monitor-lambda-role` | 監視アカウント | 管理ロールの AssumeRole, SNS Publish, CloudWatch Logs |
| `cost-monitor-scheduler-role` | 監視アカウント | Lambda の InvokeFunction |

Lambda は監視アカウントで実行されますが、Cost Explorer API は管理アカウントでしか呼べません。そこで Lambda が STS の AssumeRole で管理アカウントのロールに一時的に切り替え、Cost Explorer と Organizations のクライアントを作成しています。

## Lambda のコスト集計ロジック

Lambda（Python）では、Cost Explorer の `GetCostAndUsage` API でアカウント別・サービス別にコストを取得しています。今週（過去 7 日間）と先週（7〜14 日前）の 2 期間分を取得し、比較レポートを生成して SNS に publish する流れです。

```python
def get_costs(ce_client, start_date, end_date):
    """アカウント・サービス別のコストを取得 {account_id: {service: Decimal}}"""
    response = ce_client.get_cost_and_usage(
        TimePeriod={"Start": start_date, "End": end_date},
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        GroupBy=[
            {"Type": "DIMENSION", "Key": "LINKED_ACCOUNT"},
            {"Type": "DIMENSION", "Key": "SERVICE"},
        ],
    )

    costs = {}
    for result in response["ResultsByTime"]:
        for group in result["Groups"]:
            account_id, service = group["Keys"]
            amount = Decimal(group["Metrics"]["UnblendedCost"]["Amount"])
            if amount == 0:
                continue
            if account_id not in costs:
                costs[account_id] = {}
            # 月跨ぎで同じサービスが複数エントリに分かれるため加算する
            costs[account_id][service] = costs[account_id].get(service, Decimal("0")) + amount
    return costs
```

`Granularity` を `MONTHLY` にすることでレスポンスのサイズを抑えていますが、7 日間の期間が月を跨ぐ場合は `ResultsByTime` に月ごとに分割された 2 つのエントリが返されます。そのため、同じサービスの値は代入ではなく加算しています。

レポート生成では、先週との集合演算で新規サービスを検出して `★` で強調しています。

```python
# 先週なかった新サービスを強調
new_services = set(this_services.keys()) - set(last_services.keys())
if new_services:
    lines.append("  ★ 先週なかったサービス:")
    for svc in sorted(new_services):
        lines.append(f"    - {svc}: ${this_services[svc]:.2f}")
```

意図せず新しいサービスを使い始めたときにすぐ気づけるので、コスト管理に役立てばいいなと思っています。（あくまでの週次通知なので、リアルタイム性が必要であればリソース作成時に通知するなどの対応の方がよいかもしれません）

なお、`GetCostAndUsage` については以下ドキュメントもご覧ください。

https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_GetCostAndUsage.html

## Makefile で Terraform の認証を楽にする

今回のプロジェクトでは、クロスアカウント構成のために管理アカウントの AWS SSO プロファイル（`root-profile`）を使って Terraform を実行する必要があります。しかし、Terraform の AWS プロバイダーは `aws login` で取得した SSO セッションを直接参照できないため、一時認証情報を環境変数として渡す必要があります。

毎回手で認証情報を展開するのは面倒なので、Makefile でラップしています。

```makefile
CREDS = $(shell aws configure export-credentials --profile root-profile --format env-no-export)

init:
	env $(CREDS) terraform init -backend-config=backend.tfbackend

plan:
	env $(CREDS) terraform plan

apply:
	env $(CREDS) terraform apply
```

`aws configure export-credentials` が SSO セッションから一時的な `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` を取得し、`env` で Terraform プロセスに注入しています。これにより、`aws login` で一度ブラウザ認証するだけで、あとは `make plan` / `make apply` だけで操作できます。

Makefile の詳細については以下ドキュメントをご覧ください。

https://www.gnu.org/software/make/manual/html_node/Introduction.html

https://docs.oracle.com/cd/E19620-01/805-5827/6j5gfranb/index.html

## まとめ

以上、AWS Organizations のマルチアカウントコスト監視を自動化してみました。Makefile は触ったことがなかったので便利だなーと感動していました。また、Terraform で一からリソース構築をしたことはなかったので楽しかったです。今後は LINE での通知対応や、CI/CD の仕組みを整備していきたいなと思います。

ありがとうございました。
