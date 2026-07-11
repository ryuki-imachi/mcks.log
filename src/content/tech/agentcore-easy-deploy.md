---
title: "【AgentCore】簡単にエージェントを作成・デプロイすることができるようになったらしい"
description: "2026/4/22にAmazon Bedrock AgentCoreの新機能として、Amazon Bedrock AgentCore Managed Harnessがプレビューで発…"
pubDate: 2026-04-27
updatedDate: 2026-05-25
tags: ['AWS', 'AgentCore']
qiitaId: 7437eb2403875bbd3c49
importedDate: 2026-07-11
qiitaStats:
  views: 8653
  likes: 15
  stocks: 7
  fetchedAt: 2026-07-11
---

## はじめに

2026/4/22にAmazon Bedrock AgentCoreの新機能として、Amazon Bedrock AgentCore Managed Harnessがプレビューで発表されました。

https://aws.amazon.com/jp/about-aws/whats-new/2026/04/agentcore-new-features-to-build-agents-faster/

こちらを用いるとコードを書くことなく、対話形式で簡単にエージェントを作ることができるようです。本記事ではドキュメントなどを参考に、実際に作成してみたいと思います。

## 早速試してみる

マネージドハーネスはマネコンとAgentCore CLIを用いる方法の2種類で試すことができるようですが、今回は以下ドキュメントを参考にAgentCore CLIを使って試してみたいと思います。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness.html


### 1. AgentCore CLI をインストールする

まずは以下コマンドでインストールします。

```bash
npm install -g @aws/agentcore@preview
agentcore --version
# 1.0.0-preview.2
```

なお、CLI利用には以下の前提が必要です。

| 項目 | 内容 |
|---|---|
| AWS 認証情報 | AgentCore preview 対応リージョンで設定済みであること |
| Managed Harness 対応リージョン（プレビュー） | `us-east-1`, `us-west-2`, `eu-central-1`, `ap-southeast-2` |
| CLI 利用 | Node.js 20+ と `@aws/agentcore@preview` |

### 2. ハーネスを作成する

以下を実行すると対話的に設定を進めることができます。

```bash
agentcore create
```

:::note
なお、以下のようにオプションをつけることで非対話的に設定することもできるようです。

```bash
agentcore create --name myresearchagent --model-provider bedrock
```
:::

#### 2-1. プロジェクト名の設定

まず、プロジェクト名を設定します。`harness-demo`としようとしましたが、`Project name must start with a letter and contain only alphanumeric characters`とのことで、英字で始め、英数字のみを使用する必要があるようです。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/b0451221-1b23-40be-a49a-9b7b01bac1b5.png)

そのため、`harnessDemo`とします。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/fb79f847-80a7-496f-9975-3165c8ea49aa.png)

#### 2-2. 作成するリソースの設定

次は作成するリソースを聞かれます。Skipするとどうなるのか少し気になりましたが、今回は一旦`Harness`で進めます。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/774e8b20-fee5-4469-91bd-d13cc17ff00f.png)

#### 2-3. ハーネスの設定

続いてハーネスの設定を行います。以下画像に書かれている通り、Name → Model provider → Custom environment → Memory → Advanced settings → Confirmと進めるようです。

まずは名前を決めます。今回はデフォルトの`MyHarness`にします。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/bce893ba-0752-47f6-ab55-a065075da33a.png)

続いて、モデルプロバイダーを設定します。Amazon Bedrock, OpenAI, Google Geminiから選択することができます。今回はBedrockを利用します。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/aa58526a-e972-407c-85d2-3d5f4878a936.png)

次に環境設定をします。デフォルトの他にECRやDockerfileを指定することができるようです。今回はデフォルト環境を利用します。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/8f750a2f-bf68-41b9-918d-7d0ae25b914a.png)

その後、メモリーの設定を行います。セッションを跨いでコンテキストを保持するかどうかを設定することができます。今回は使わないことにします。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/f4c9de90-7753-41f8-a2dd-8e0cf0526370.png)

続いて、そのほかの詳細設定を行います。ここでは、ツール・認証・ネットワーク・ライフサイクル・実行制限・トランケーション・セッションストレージを有効にするか個別に設定することができます。今回はシンプルにしたかったので、toolだけ有効化します。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/f4160cae-01d5-4159-9e49-494bf3d1ded4.png)

ツールの使用を有効化したので、追加でツールの設定が求められました。今回はBrowserとCode Interpreterを設定してみます。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/e79d56b2-45cf-40cc-a1d4-d8dcc9eab5b0.png)

最後に確認画面が出るので確認します。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/007f7051-a843-4588-848e-87e06d8d846a.png)

すると、ディレクトリが生成されます。ここに設定ファイルが置かれており、これを元にデプロイを実施する形ですね。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/0d928ee9-d077-4b68-ad62-316a9d391a30.png)

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/1f898464-8330-4c4a-abc5-3ae43aaa0ad5.png)


### 3. デプロイする

作成されたファイルを使って以下コマンドでデプロイを進めていきます。

```bash
agentcore deploy
```

ちゃんとプロジェクトに移動しましょうね。（一敗）

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/dd79b4cc-07d9-4c81-9aaf-f0e8f059570d.png)

気を取り直してコマンドを実行し直すとデプロイが始まりました。

![スクリーンショット 2026-04-27 19.45.01.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/0dab385c-6869-46af-82f6-bc6caaba74d6.png)

少し待つと処理が完了しました。

![スクリーンショット 2026-04-27 19.49.03.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/c075dd7c-e8a8-407a-9261-74be6d637826.png)

マネコンを確認してみると、ちゃんと作成されていそうです。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/8464cea5-2791-45f4-93d2-fecdaae0556f.png)

ということで、対話形式でエージェントをデプロイすることができました。

### 4. 作成したエージェントを呼び出してみる

以下コマンドでエージェントを呼び出してみます。

```bash
agentcore invoke --harness MyHarness \
  --session-id "$(uuidgen)" \
  "「strawberry」という英単語の中に「r」はいくつ含まれているか、Code Interpreterを用いて数えてください。"
```

無事ちゃんと数えることができていそうです。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/b5d56493-3010-45d6-92ce-5b7cc63ec50d.png)

ついでにオブザーバビリティも確認してみます。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/38a39720-0e3a-4f21-975f-ab5473bc0fc5.png)

少し見にくい部分もありますが、トレースできていそうです。

### 5. モデルを変えて呼び出してみる

呼び出し時にモデルを指定することでオーバーライドすることができるようなのでこちらも試してみます。

```bash
agentcore invoke --harness MyHarness \
  --session-id "$(uuidgen)" \
  --model-id us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  "「strawberry」という英単語の中に「r」はいくつ含まれているか、Code Interpreterを用いて数えてください。"
```

r の分布についての説明はちょっとおかしい気もしますが、数自体はちゃんと数えられていそうです。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/1a34f1de-e14f-45b4-8588-301647892423.png)

オブザーバビリティを確認したところ、ちゃんとHaikuが使われていそうです。

![image.png](https://images.ryu-ki-learn.com/agentcore-easy-deploy/e86be495-4756-4f1c-bbc5-37dd7c2f8868.png)

以上、一通り試してみることができました。

## おわりに

以上、簡単ではありましたが、エージェントの作成・デプロイ・呼び出しを一通り試してみました。想像以上に簡単にデプロイまですることができてびっくりしています。ここまで簡単になると、アプリ側の実装に集中することができるので、アプリ側の知識が大切になってきそうだなと思っています。（私はアプリ側の知識がないのでヤバイと思っています）

いい機会なので、今度はハーネスでサクッと作ったエージェントをHonoを使って呼び出せるようにしてみたいと思っています。

ありがとうございました。
