---
title: "【AgentCore】Runtime の命名で混乱したのでルールを整理する"
description: "Amazon Bedrock AgentCore で Runtime を作ろうとしたとき、命名まわりで何度かエラーに引っかかりました。調べてみると、ツールによって制約が微妙に違うう…"
pubDate: 2026-08-25
tags: ['AWS', 'AgentCore', 'Bedrock', 'CDK']
qiitaId: d345d6ce05f0e5d9436a
importedDate: 2026-08-29
qiitaStats:
  views: 2902
  likes: 4
  stocks: 1
  fetchedAt: 2026-08-29
---

:::note
この記事は「2026 Japan AWS Jr. Champions 真夏のQiitaリレー」の25日目の記事となります。
過去の投稿（リンク集）は以下リンクからご覧ください。
:::

https://qiita.com/ys-yoshida/private/6f7c7f85155a993e2c86

## はじめに

Amazon Bedrock AgentCore で Runtime を作ろうとしたとき、命名まわりで何度かエラーに引っかかりました。調べてみると、ツールによって制約が微妙に違ううえ、ドキュメント間で記述が揺れている箇所もあったので、実際に手元で検証した結果も交えて本記事で整理したいと思います。

:::note
なお、本記事は AgentCore CLI v0.26.0、aws-cdk-lib v2.263.0 で検証した内容です（2026年8月時点）。更新が速いので、手元での最新の挙動は公式ドキュメントや、`--help` で確認してください。
:::

## 登場する名前たち

AgentCore Runtime に関わる名前は、使うツールによって呼び方が変わります。まずはこれを整理しておきます。

| 名前                 | 使われどころ                                                                  | 説明                             |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------ |
| `agentRuntimeName` | AWS API（CreateAgentRuntime）                                             | Runtime リソースの識別名 / AWS 上の正式な名前 |
| `runtimeName`      | CDK L2 Construct のプロパティ                                                 | `agentRuntimeName` に直接マップされる   |
| エージェント名            | AgentCore CLI（`agentcore create --name` / `agentcore add agent --name`） | デプロイ時に Runtime の名前になる          |
| プロジェクト名            | AgentCore CLI（`agentcore create --project-name`）                        | ローカルのプロジェクトディレクトリ名             |

ここでややこしいと思ったのが、`agentcore create` の `--name` はプロジェクト名ではなくエージェント名（リソース名）だということです。プロジェクト名を指定するには別フラグの `--project-name` を使います。

結局のところ、最終的に AWS リソースとして登録されるのは `agentRuntimeName` です。CDK の `runtimeName` も CLI のエージェント名も、ここに行き着きます。

:::note info
ちなみに、旧 Python 製スターターツールキット（`bedrock-agentcore-starter-toolkit`）の CLI はサポート終了になっており、README でも新規プロジェクトには AgentCore CLI（npm の `@aws/agentcore`）を使うよう案内されています。
:::

https://github.com/aws/agentcore-cli

## agentRuntimeName の制約

API レベルでの制約は CreateAgentRuntime の API リファレンスに記載されています。

https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateAgentRuntime.html

```
[a-zA-Z][a-zA-Z0-9_]{0,47}
```

| 項目 | ルール |
|------|--------|
| 先頭文字 | 英字（a-z, A-Z）のみ |
| 2文字目以降 | 英字・数字・アンダースコア（`_`） |
| ハイフン（`-`） | 使えない |
| 最大長 | 48文字 |
| 最小長 | 1文字 |

ハイフンが使えないのは注意したいところです。（使うと以下のようなエラーが出るのですぐ気づけるとは思いますが...）

```
Value 'my-cool-agent' at 'agentRuntimeName' failed to satisfy constraint
```

上記の例の場合、`my_cool_agent` か `myCoolAgent` にしましょう。

## AgentCore CLI での注意点

AgentCore CLI では「プロジェクト名」と「エージェント名」の2つの名前が登場し、それぞれ制約が違います。コマンドの一覧やフラグの詳細は CLI のドキュメントにまとまっています。

https://github.com/aws/agentcore-cli/blob/main/docs/commands.md

v0.26.0 で確認した結果、以下の通りでした。

| 対象 | フラグ | 最大文字数 | 使える文字 |
|------|--------|-----------|-----------|
| プロジェクト名 | `agentcore create --project-name` | 23文字 | 英数字のみ / 英字始まり |
| エージェント名（ハーネスプロジェクト） | `agentcore create --name` | 40文字 | 英数字＋アンダースコア / 英字始まり |
| エージェント名（`--framework` 指定時） | `agentcore create --name` | 48文字 | 英数字＋アンダースコア / 英字始まり |
| エージェント名（既存プロジェクトへの追加） | `agentcore add agent --name` | 48文字 | 英数字＋アンダースコア / 英字始まり |

プロジェクト名はエージェント名の半分以下しか使えず、アンダースコアも使えません。長めの名前を付けようとしてプロジェクト作成時に弾かれるケースがあるので注意してください。

```
Project name must be 23 characters or less
```

エージェント名の上限がプロジェクトの種類によって40文字と48文字で異なるのもややこしいポイントかと思います。API の上限は48文字なので、デフォルトのハーネスプロジェクトだけ少し厳しくなっています。41文字のエージェント名をハーネスプロジェクトに渡すと、こう弾かれます。

```
Too big: expected string to have <=40 characters
```

ちなみに、エージェント名にハイフンを入れた場合は、文字種と上限をまとめて教えてくれます。（末尾の文字数はプロジェクトの種類によって変わります）

```
Must begin with a letter and contain only alphanumeric characters and underscores (max 40 chars)
```

また、`--project-name` を省略すると `--name` の値がプロジェクトディレクトリ名としても使われるため、プロジェクト名のルールで検証されます。つまりエージェント名としては正しいはずの `my_cool_agent` でも、`--project-name` なしだと以下のように弾かれます。

```
Project name must start with a letter and contain only alphanumeric characters
```

アンダースコア入りのエージェント名を使いたいときは、英数字だけの `--project-name` を併せて指定するのが安全かと思います。

### 公式ドキュメントを見てみる

ここで気になるのが公式ドキュメントの記述です。AWS の Get Started ガイドを見てみます。

https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli.html

`agentcore create` のフラグ説明は、今もこう書かれています。

> `--name` – The project name (alphanumeric, starts with a letter, max 36 characters).

訳すと、「`--name` はプロジェクト名（英数字のみ・英字始まり・最大36文字）」とのことです。

`--name` を「プロジェクト名」と呼んでいるうえ、36文字という数字も先ほど確認した内容と合いません。

実際にはプロジェクト名なら23文字、エージェント名なら40文字（ハーネスプロジェクトの場合）で、36文字という上限はどちらにも当てはまりませんでした。CLI のヘルプの方は `--project-name` と `--name` を明確に分けて説明しているので、迷ったら `--help` を信じるのがよさそうです。

## CDK で Runtime を作る場合

CDK の L2 Construct では `runtimeName` プロパティで名前を指定します。

L2 は aws-cdk-lib v2.255.0（2026年5月18日リリース）で alpha パッケージ（`@aws-cdk/aws-bedrock-agentcore-alpha`）から `aws-cdk-lib` 本体へ昇格したので、新規で書くなら `aws-cdk-lib/aws-bedrockagentcore` を import します。

alpha パッケージ自体は今も更新が続いていますが、README を読むと alpha に残っているのは Policy サブモジュールだけで、Runtime を含むそれ以外は stable 側へ移ったと明記されています。

```typescript
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";

const runtime = new agentcore.Runtime(this, "MyRuntime", {
  runtimeName: "my_agent",
  agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromEcrRepository(
    repository,
    "v1.0.0",
  ),
});
```

Runtime Construct のプロパティ一覧は CDK の API リファレンスにまとまっています。

https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_bedrockagentcore-readme.html

ここで指定した値がそのまま `agentRuntimeName` になります。制約も API と同じ（英字始まり・英数字とアンダースコア・最大48文字）です。

CDK が便利なのは、この検証が `cdk synth` の時点で走ることです。ハイフン入りの名前を書くと、デプロイする前に手元でエラーになります。

```
Runtime name must start with a letter and contain only letters, numbers, and underscores
```

48文字を超えた場合は以下のように指摘が入ります。

```
The field Runtime name is 49 characters long but must be less than or equal to 48 characters
```

`runtimeName` を省略した場合は、CDK がスタック名と construct のパスをもとに一意な名前（最大48文字）を自動生成します。スタック名が `TestStack`、construct ID が `MyRuntime` のときは `TestStackMyRuntime5DA800E0` になりました。スタック名と construct ID を連結して、末尾にハッシュを付けた形です。

注意点として、CDK の construct ID（第2引数の `"MyRuntime"`）と `runtimeName` は別物です。construct ID は CloudFormation のリソース論理名に使われるもので、`runtimeName` を明示していれば AWS 側の名前には影響しません。（省略した場合の自動生成名には construct ID の情報が間接的に混ざります）

もうひとつ、CloudFormation 上で `AgentRuntimeName` の変更は Replacement 扱いです。つまり後から名前を変えてデプロイすると Runtime が作り直されるので、名前は最初に決め切ってしまう方が良いかと思います。

https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-bedrockagentcore-runtime.html

## Runtime ID との違い

作成後に AWS が割り振る Runtime ID というものもあります。これは Runtime Name とは別の識別子です。

```
Runtime Name: myAgent
Runtime ID:   myAgent-EzA5oXBJQC
```

Runtime Name に対してハイフン＋英数字10文字のランダムなサフィックスが付加された形式で、ARN の末尾にはこちらが使われます。自分で指定するものではないので、「こういうものがある」と知っておけば十分かと思います。

## 他のリソースの命名

ついでに気になったので、Runtime 以外のリソースの制約も見てみました。

| リソース | 正規表現 | ハイフン | アンダースコア |
|---|---|---|---|
| Runtime | `[a-zA-Z][a-zA-Z0-9_]{0,47}` | 使えない | 使える |
| Memory | `[a-zA-Z][a-zA-Z0-9_]{0,47}` | 使えない | 使える |
| Gateway | `([0-9a-zA-Z][-]?){1,48}` | 使える | 使えない |

Memory は Runtime とまったく同じですが、Gateway だけがハイフンとアンダースコアの可否が逆転しています。同じ AgentCore の中でもリソースによって違うので、Gateway を作るときに `my_gateway` と書いて弾かれる、という逆のパターンもありそうです。

https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateMemory.html

https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateGateway.html

## 命名ルール早見表

最後にここまでの内容を一覧にしておきます。

| ルール                 | 内容                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------ |
| ハイフン禁止              | `my-agent` は NG → `my_agent` か `myAgent`                                                   |
| 最大48文字              | `agentRuntimeName` の上限                                                                     |
| CLI の `--name` の指す先 | エージェント名（プロジェクト名は `--project-name`） |
| CLI のプロジェクト名の上限 | 23文字・英数字のみ |
| エージェント名の上限 | ハーネスは40文字 / それ以外は48文字 |
| CDK の `runtimeName` | API の `agentRuntimeName` と同じ / 変更すると再作成 |
| リソースごとの違い | Gateway だけハイフン可・アンダースコア不可 |

## おわりに

以上、AgentCore Runtime の命名まわりについて、API・CLI・CDK の3か所から整理してみました。命名規則自体はシンプルなのですが、ツールごとに呼び方や制約が微妙に違うのが混乱の元だったなと思います。

今回のように公式ドキュメントと実際の挙動が食い違う場面もあったので、迷ったら `--help` と手元での挙動を信じるのが早いのかなと思いました。Gateway や Memory を本格的に使うときにもまた引っかかりそうなので、ややこしいところがあれば改めて整理してみたいと思います。

ありがとうございました。
