---
title: "【FinOps Agent】身に覚えのない請求の調査を任せてみる"
description: "8月に入ってすぐ、AWS Budgetsから予測アラートのメールが届きました。月5ドルの予算に対して、8月の予測コストが6.20ドルになっているという内容です。"
pubDate: 2026-08-13
tags: ['AWS', 'FinOps']
qiitaId: 94c478b2642ac525c6c4
importedDate: 2026-08-17
qiitaStats:
  views: 7746
  likes: 10
  stocks: 3
  fetchedAt: 2026-08-17
---

:::note
この記事は「2026 Japan AWS Jr. Champions 真夏のQiitaリレー」の10日目の記事となります。
過去の投稿（リンク集）・昨日の投稿は以下リンクからご覧ください。
:::

https://qiita.com/ys-yoshida/private/6f7c7f85155a993e2c86

https://qiita.com/Omizu-25/items/5157a01639c31d60ad7a

## はじめに

8月に入ってすぐ、AWS Budgetsから予測アラートのメールが届きました。月5ドルの予算に対して、8月の予測コストが6.20ドルになっているという内容です。

![budget-alert-email.png](https://images.ryu-ki-learn.com/finops-agent-cost-investigation/budget-alert-email.png)

ちょうどFinOps Agentを使った記事のネタを考えていたところだったので、そのまま調査をしてもらおうと思います。

ちなみに、FinOps Agentは以前にも触っていて、そのときは監視アカウントから組織全体のコストが見えないことを確認して終わっていました。

https://qiita.com/ryu-ki/items/19227641b6a0886c068c

今回は用意した検証シナリオではなく、実際に困っている調査を初見で任せてみます。

## 動作環境

| 項目 | バージョン |
|------|-----------|
| AWS FinOps Agent | パブリックプレビュー（2026年8月2日時点） |
| AWS CLI | 2.35.14 |
| リージョン | us-east-1 |

:::note
FinOps Agentは執筆時点でus-east-1のみ対応です。プレビュー中は月間使用量の上限付きで無料ですが、エージェントが内部で呼び出すAWS API（Cost Explorer APIなど）には通常料金が適用されます。
:::

https://docs.aws.amazon.com/finops-agent/latest/userguide/what-is.html

## エージェントの作成

エージェントは、請求が発生しているアカウント自体に作ります。前回の記事で確認したとおり、メンバーアカウントのエージェントからは自分のアカウントのコストしか見えません。逆に言えば、調査したい請求があるアカウントに作れば今回は十分です。

Billing and Cost ManagementコンソールのFinOps Agentメニューから「Get started」を押すと、5ステップのウィザードが始まります。

![finops-get-started.png](https://images.ryu-ki-learn.com/finops-agent-cost-investigation/finops-get-started.png)

ステップは、エージェント名 → Agent用IAMロールの自動作成 → Webアプリ用Operatorロールの自動作成 → Slack/Jira連携（任意） → 確認、という流れです。今回は名前を「cost-investigator」にして、外部連携はスキップしました。

![create-agent-review.png](https://images.ryu-ki-learn.com/finops-agent-cost-investigation/create-agent-review.png)

以上の通り、サクッと作成できました。

![agent-created.png](https://images.ryu-ki-learn.com/finops-agent-cost-investigation/agent-created.png)

## 調査の依頼

作成したエージェントを開くと、専用のWebアプリ（チャット画面）が別タブで開きます。TasksやAutomationsのメニューもこの画面にあります。

![webapp-home.png](https://images.ryu-ki-learn.com/finops-agent-cost-investigation/webapp-home.png)

チャット欄に今回の調査依頼を投げます。公式の対応言語が英語のみなので、英語で書きました。

```text
My AWS Budgets alert says the forecasted cost of this account for August 2026
is $6.20, exceeding my $5.00 monthly budget. This is unexpected and I don't
know what is driving it. Investigate which services and resources are driving
the August cost, compare with previous months, and identify the root cause of
the increase. Point to specific resources if possible.
```

訳すと、こんな依頼です。

```text
AWS Budgetsのアラートで、このアカウントの2026年8月の予測コストが6.20ドルになり、
月5ドルの予算を超えると通知が来ました。心当たりがなく、何が原因なのかわかりません。
8月のコストを押し上げているサービスとリソースを調査し、過去の月と比較して、
増加の根本原因を特定してください。可能であれば具体的なリソースまで指摘してください。
```

送信すると、エージェントがCost Explorerのツールを並列で呼び出しながら調査を始めます。どのツールにどんなリクエストを投げたかを展開して確認することもできます。

![investigating-tool-calls.png](https://images.ryu-ki-learn.com/finops-agent-cost-investigation/investigating-tool-calls.png)

## 調査結果

1分ちょっとで回答が返ってきました。

![investigation-result.png](https://images.ryu-ki-learn.com/finops-agent-cost-investigation/investigation-result.png)

### 回答の要約

予測6.20ドルは、7月の実績のペースを8月にそのまま引き伸ばして見積もった数字でした。8月の実支出はこの時点でまだ0ドルです。その7月は、Bedrockのモデル課金が約17.33ドルと、6月（約0.72ドル）の24倍に跳ねていました。ほぼすべてClaude Sonnet 4.6によるものです。

さらに、課金があったのは7/11（11.70ドル）、7/20（5.01ドル）、7/25（0.41ドル）の3日だけで、入力トークンが6月の約4.2万から7月の596万へ141倍に増えていることも指摘されました。エージェントはここから「暴走したエージェントループか、非常に大きなコンテキストを送るプロセスがあったのでは」と推測し、再発に備えてInputTokenCountのCloudWatchアラーム設定を勧めてきました。8月の予算は今のところリスクなし、とのことです。

つまり通知の正体は、7月の使いすぎでした。Budgetsの予測は過去の実績から先を推計するので、7月に大きく使うと、まだほとんど使っていない8月の予測も引き上げられます。言われてみればそのとおりなのですが、アラートを受け取った時点ではそこに思い至っていませんでした。

## 裏取り

エージェントの出力は確率的なので、数字を鵜呑みにせず、Cost Explorer APIを直接叩いて突き合わせました。

https://docs.aws.amazon.com/cli/latest/reference/ce/get-cost-and-usage.html

まず7月のサービス別コストです。

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-07-01,End=2026-08-01 \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

```text
# 実行結果（$0.01以上のみ抜粋）
Claude Sonnet 4.6 (Amazon Bedrock Edition)  15.728
Tax                                          1.74
Claude Haiku 4.5 (Amazon Bedrock Edition)    1.57
Claude Sonnet 4.5 (Amazon Bedrock Edition)   0.028
```

日別でも確認します。

```text
# 2026-07-08〜07-26の日別（$0.005以上のみ抜粋）
2026-07-11  Claude Sonnet 4.6  11.70
2026-07-20  Claude Haiku 4.5    1.57
2026-07-20  Claude Sonnet 4.6   3.44
2026-07-25  Claude Sonnet 4.6   0.41
```

エージェントが提示した数字と、月次・日別とも完全に一致しました。

ここから先の「この3日に何を動かしたのか」は、人間側の仕事です。手元の作業記録と突き合わせたところ、3日ともはっきり心当たりがありました。

| 日付 | コスト | 正体 |
|---|---|---|
| 7/11 | 11.70ドル | ブラウザ操作エージェントの検証 |
| 7/20 | 5.01ドル | Bedrockのコスト計測の検証（記事の検証作業） |
| 7/25 | 0.41ドル | 勉強会でのエージェントのライブデモ |

この中でもコストが最大の7/11は、ブラウザ操作エージェントの検証をしていた日でした。このエージェントはページ構造のスナップショットを毎回モデルに送るため、入力トークンがとにかく大きくなります。実際、この日の11.70ドルの内訳は入力11.42ドル・出力0.28ドルと、極端に入力へ偏っていました。エージェントの「非常に大きなコンテキストを送るプロセス」という推測は当たっていたことになります。

なお、このときの検証の中身は、登壇資料として公開しています。

https://speakerdeck.com/ryuki0947/agentcore-harness-x-agentcore-browser-x-live-view

そしてオチですが、7/20の5.01ドルは「Bedrockのコストを計測する検証」のために意図的にBedrockを回した分です。コスト検証のためのコストが、翌月の通知の原因になっていました。犯人は私です。

https://qiita.com/ryu-ki/items/4c4222d994b6e8f87002

## 注意点

先ほど書いたとおり出力は確率的で、公式にも人によるレビューが推奨されています。今回は数字が完全に一致しましたが、裏取りする前提で使うのがいいと思います。

また、原因の仮説は外すことがあります。今回の「暴走エージェントループでは」という指摘は、実際には意図的な検証作業でした。一方で、金額・日付・トークンの偏りといったデータの読みは正確だったので、事実と推測を分けて受け取ることが大事だと感じました。

もう1つ、どのワークロードが使ったかの特定まではエージェントにはできません（CloudTrailとの相関調査を提案してはくれます）。課金の粒度もモデル別（サービス名が「Claude Sonnet 4.6 (Amazon Bedrock Edition)」のように分かれる）で、アプリケーション別ではありません。今回は、（Claude Codeが）課金のあった日付を手元のgitログと突き合わせるのが手っ取り早かったです。

## 料金と後片付け

FinOps Agent自体はプレビュー中無料ですが、内部で呼び出すCost Explorer APIは1リクエスト0.01ドルかかります。裏取りで私が直接叩いた分も同様です。今回の検証全体では数十セント程度かなと思います。

https://aws.amazon.com/aws-cost-management/aws-cost-explorer/pricing/

後片付けは、コンソールのAgents一覧からエージェントを削除します。Slack/Jira連携を設定した場合は、先に連携の削除が必要です。

なお、ウィザードが自動作成したIAMロール2つは、「FinOpsAgentRole-」「FinOpsAgentOperatorRole-」で始まる名前で作られていました。エージェント削除時にこれらが自動で削除されるかはドキュメントに記載を見つけられなかったので、削除後にIAMコンソールで検索して確認するのが確実だと思います。

ちなみに私は、プレビュー中は残しておいても課金されないため、エージェントはそのまま置いておくことにしました。

## おわりに

前回は「組織全体が見えなかった」で終わったFinOps Agentですが、実際に困っている調査を任せてみると、データの正確さと調査の速さはかなり便利に感じました。数字の特定と仮説出しまではエージェント、ワークロードの特定と最終判断は人間、という分担がしっくりきます。（至る所でされている話ですが）

また、Automationsを使えば、コスト異常検知をトリガーにした自動調査もできるようです。このあたりも今後仕組み化できるといいなと思いました。

最後に、皆さんも検証のしすぎにはお気をつけください。

ありがとうございました。
