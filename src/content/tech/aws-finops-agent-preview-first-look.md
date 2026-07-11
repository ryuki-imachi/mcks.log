---
title: "【FinOps Agent】FinOps Agent を監視アカウントで触ってみたが、組織全体のコストは見えなかった"
description: "2026年6月10日（日本時間）、AWS FinOps Agent がパブリックプレビューとして発表されました。自然言語でコストの調査を頼めて、さらにコスト異常を検知したら向こうか…"
pubDate: 2026-06-11
updatedDate: 2026-06-17
tags: ['AWS', 'FinOps', 'コスト管理', 'AIエージェント']
qiitaId: 19227641b6a0886c068c
importedDate: 2026-07-11
qiitaStats:
  views: 1076
  likes: 4
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

2026年6月10日（日本時間）、AWS FinOps Agent がパブリックプレビューとして発表されました。自然言語でコストの調査を頼めて、さらにコスト異常を検知したら向こうから知らせてくれるという、コスト管理系のAIエージェント（Frontier Agent）です。

https://aws.amazon.com/jp/blogs/news/aws-finops-agent-is-now-public-preview/

私は普段、Amazon Q に教えてもらったり、自作のコスト通知の仕組みを駆使してコスト管理をしていました。（もちろん Budgets も使ってますよ！）

https://qiita.com/ryu-ki/items/9db7c7b5c0ab750021d1

FinOps Agent がぱっと見便利そうなのと、プレビュー中で無料で使えるとのことなので本記事で触ってみたいと思います。

私の環境はマルチアカウント構成で、コスト監視は専用の監視アカウントに寄せています。そこで本記事では「監視アカウントに FinOps Agent を置いたら、組織全体のコストは見えるのか？」を確かめていきます。

## FinOps とは

FinOps とは、クラウドのコスト管理を財務とエンジニアリングの共同作業として回していくための運用プラクティスです。FinOps Foundation という団体がフレームワークを整備していて、「コストの可視化」「最適化」「継続的な運用」のサイクルを回すことが基本とされています。

https://finops-jp.github.io/

## AWS FinOps Agent とは

公式ドキュメントでは「クラウド環境全体のコストを継続的に監視し、異常を調査し、最適化の機会を浮かび上がらせることを容易にするフロンティアエージェント」と説明されています。Amazon Bedrock 上に構築されています。

https://docs.aws.amazon.com/finops-agent/latest/userguide/what-is.html

提供される機能としては以下が挙げられています。

- 自然言語でのコスト照会
  - 自分のコスト・使用状況データに基づいて、チャットでコストの質問に回答
- イベントトリガーのコスト異常調査
  - Cost Anomaly Detection のイベントを契機に調査レポートを作成
  - Jira や Slack に通知・共有
- 定期コストレポート
  - 日次・週次・月次などのスケジュールで、HTML / PDF / PPT 形式のレポートを生成
- 最適化機会の集約
  - Cost Optimization Hub と Compute Optimizer のレコメンドをまとめ、Jira チケットとして共有
- コンテキストファイルと記憶
  - 組織固有の情報（アカウントとオーナーの対応表など）をアップロードしておくと回答に反映され、セッションをまたいでも考慮

内部で連携するのは Cost Explorer、Cost Anomaly Detection、Cost Optimization Hub、Compute Optimizer、CloudTrail の5サービスで、どこまで許可するかはエージェント作成時に選べます。

### プレビュー中の条件

触る前にプレビュー中の条件を整理しておきます。

| 項目    | 内容                                    |
| ----- | ------------------------------------- |
| 料金    | プレビュー中はエージェント自体の利用は無料（月間使用量の上限あり）     |
| 注意点   | 内部で呼ばれる Cost Explorer API などには標準料金が発生 |
| リージョン | us-east-1（バージニア北部）のみ対応（東京は未対応）        |
| 言語    | 公式には英語のみサポート                          |
| 外部連携  | Slack / Jira 連携はアカウントレベルでの事前インストールが必要 |

基本的には今までにリリースされた Frontier Agent と同じ感じですね。

## 前提条件

本記事の検証は、2026年6月10日時点のプレビュー版で行っています。環境は次の通りです。

AWS Organizations のマルチアカウント構成で、コスト監視用のアカウントを運用しています。管理アカウント側でカスタム請求ビューを「フィルターなし（すべてのデータ）」で作成し、AWS RAM 経由で監視アカウントに共有してあります。カスタム請求ビューの詳細は以下を参照ください。

https://docs.aws.amazon.com/ja_jp/cost-management/latest/userguide/create-custom-billing-views.html

こんな感じでマネコンからは確認できます。

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/billing-view-shared.png)

この共有ビューが FinOps Agent からも見えるのか確認します。

## 実際に触ってみる

上述の監視アカウント上で作業していきます。

### セットアップ

早速マネコンから設定していきたいと思います。

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/setup-start.png)

まず、Agent の名前と説明を設定し、

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/setup-agent-name.png)

Agent に渡すロールを用意して、（今回はデフォルトで用意してくれるものを使います）

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/setup-agent-role.png)

Webアプリが Agent に対して行える操作を制御するロールを用意して、（こちらもデフォルトのものを使います）

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/setup-operator-role.png)

AWS外との連携の設定を行い、（今回は特に設定しません）

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/setup-integrations.png)

最後に設定内容を確認すると、

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/setup-review.png)

Agent が作成されました。簡単ですね。

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/setup-complete.png)

Open を選択することでWebアプリが別タブで開かれます。ダークですね。（ちょっと見にくいので以後はライトテーマに変えています）

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/webapp-home.png)


### 組織全体が見えるか確かめてみる

本題です。エージェントに「Cost Explorer 経由でいくつのアカウントが見えているか」を聞いてみました。

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/chat-single-account.png)

見えているのは監視アカウント自身の1アカウントだけでした。マネコンの Cost Explorer では共有ビューで組織全体が見えているのに、エージェントからは見えていません。

### エージェントの調査ログを確認

なぜ見えないのかは、エージェントが発行している Cost Explorer API のリクエストを見るとわかりました。

![](https://images.ryu-ki-learn.com/aws-finops-agent-preview-first-look/api-request-log.png)

```json
{"end_date":"2026-06-10","operation":"getDimensionValues","dimension":"LINKED_ACCOUNT","start_date":"2026-06-01"}
```

リクエストに `billingViewArn` が含まれていません。Cost Explorer API はビューの ARN を明示的に渡さない限り、そのアカウントのデフォルト（プライマリ）ビューに問い合わせる仕様です。つまり FinOps Agent は共有ビューの存在を知らないまま、監視アカウント自身のビューだけを見に行っていることになります。

`BillingViewArn` パラメータの仕様は Cost Explorer API リファレンスに記載があります（Required: No のオプションパラメータで、指定しなければデフォルトビューが対象になります）。

https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_GetDimensionValues.html

せっかく共有したカスタム請求ビューは、プレビュー時点の FinOps Agent からはスルーされてしまうようです。

## わかったこと

今回の検証でわかったことを整理します。

メンバーアカウントに FinOps Agent を置いた場合、見えるのはそのアカウント自身のコストだけです。カスタム請求ビューを共有しても、エージェントの API リクエストに `billingViewArn` が渡されないため効果はありません。

したがってプレビュー時点では、組織全体のコストを扱いたければ、管理アカウントにエージェントを作る必要があると思われます。「管理アカウントには余計なワークロードを置かない」という原則と噛み合わないため、マルチアカウントでコスト監視を分離している方は導入場所の判断が悩みどころになるのではないかと思います。

なお、これは検証からの推測ではなく公式の設計のようです。Claude Code にドキュメントを調査してもらったところ、FAQ に「管理アカウントの管理者は組織全体のコストと使用状況データを管理するエージェントを作成でき、メンバーアカウントの所有者は自分のアカウントにスコープされたエージェントを作成できる」と明記されていました。

https://aws.amazon.com/finops-agent/faqs/

もしうまい方法をご存知の方は共有いただけると幸いです。

## おわりに

以上、簡単ではありましたが、FinOps Agent がカスタム請求ビューをスルーすることが確認できました。

~~ここまでで力尽きたので、~~管理アカウントにエージェントを作っての組織全体ウォッチ、定期レポートや異常調査の検証はまた別の記事で書きたいと思います。

プレビュー中は上限付きで無料なので、コスト管理に課題を感じている方は今のうちに触っておくのがおすすめです。

ありがとうございました。
