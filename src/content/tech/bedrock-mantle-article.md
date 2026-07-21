---
title: "【Bedrock】Amazon Bedrock Mantleとは？"
description: "2025 年 12 月、Amazon Bedrock に Mantle という新しい推論エンジンが追加されました。re:Invent 2025 のキーノート（Infrastruct…"
pubDate: 2026-07-20
tags: ['AWS', 'OpenAI', 'Bedrock', '生成AI']
qiitaId: 17fa3462d4c619e4fea5
importedDate: 2026-07-22
qiitaStats:
  views: 5291
  likes: 9
  stocks: 2
  fetchedAt: 2026-07-22
---


## はじめに

2025 年 12 月、Amazon Bedrock に Mantle という新しい推論エンジンが追加されました。re:Invent 2025 のキーノート（Infrastructure Innovations with Peter DeSantis and Dave Brown）で発表されたものです。

https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html

色々モデルが使えるようになっていたりするものの、私はこれが何者なのかあまりわかっていません。

この記事では、Bedrock Mantle がそもそも何者なのかを、既存の bedrock-runtime との違いを軸に整理します。なお、本記事の内容は 2026 年 7 月時点のものです。特にモデルの対応状況は今後変わる可能性があります。

## Bedrock Mantleとは何か

Bedrock Mantle は、大規模なモデルサービングのために新しく設計された分散推論エンジンです。`bedrock-mantle.{region}.api.aws` という専用エンドポイントを持ち、次の 3 つの API をネイティブに提供します。

- OpenAI Responses API
- OpenAI Chat Completions API
- Anthropic Messages API

注目なのは、OpenAI 互換という部分です。OpenAI の API 形式は現在、OpenAI 以外にも広く浸透しています。Google Gemini や xAI の Grok は OpenAI SDK から呼べる互換エンドポイントを公式に提供していますし、vLLM や Ollama といった推論ツールも OpenAI 互換 API を実装しています。多くのアプリケーションやライブラリが、この形式を前提に書かれているのが現状です。

Mantle はこの形式をそのまま受け付けるため、OpenAI 向けに書かれた既存のコードは、接続先の URL と API キーを差し替えるだけで Bedrock 上のモデルに向き先を変えられます。

もうひとつの特徴が、分散推論エンジンという部分です。bedrock-runtime はアカウントごとに固定のクォータ（1 分あたりのリクエスト数やトークン数）を割り当てる方式ですが、Mantle はスケジューリングとキューイングでリクエストを捌く方式になっています。クォータもトークンベースのみで、リクエスト数ベースのクォータは存在しません。

https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-mantle.html

## bedrock-runtimeとの違い

主な違いを表にまとめます。

| 項目 | bedrock-runtime | bedrock-mantle |
|------|-----------------|----------------|
| エンドポイント | bedrock-runtime.{region}.amazonaws.com | bedrock-mantle.{region}.api.aws |
| 主な API | InvokeModel / Converse | Responses / Chat Completions / Messages |
| クォータ | RPM / TPM の固定割り当て | TPM ベース（スケジューリング方式） |
| 使用量の分離 | IAM・リクエストメタデータタグ | Projects / Workspaces |
| 料金 | モデルごとのトークン単価 | 同一モデルなら runtime と同単価 |

料金について、公式ドキュメントは、エンドポイントは API や機能の要件で選ぶものでありコストで選ぶものではない、と明言しています。同じモデルならどちらから呼んでもトークン単価は同じです。

> Per-token pricing for the same model is identical on `bedrock-runtime` and `bedrock-mantle`. Choose an endpoint based on the APIs and capabilities you need, not cost.

https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html

IAM 管理ポリシーも Mantle 専用のもの（AmazonBedrockMantleFullAccess など 3 種類）が用意されており、権限の面でも bedrock-runtime とは別物として扱われています。

## 対応モデル

面白いのは、bedrock-runtime と Mantle でモデルカタログが一致していないことです。公式のモデル別対応表を見ると、ざっくり 3 グループに分かれます。

https://docs.aws.amazon.com/bedrock/latest/userguide/models-endpoint-availability.html

### Mantle でしか呼べないモデル

- GPT-5.4 / GPT-5.5（OpenAI）
- Grok 4.3（xAI）
- Claude Mythos 5（Anthropic）

### 両方で呼べるモデル

- gpt-oss 系（OpenAI のオープンウェイトモデル）
- DeepSeek V3.1 / V3.2、Qwen3 系、Mistral 系、Gemma3 系、Kimi K2 系 など
- Claude の新しめの世代（Sonnet 5、Fable 5、Haiku 4.5、Opus 4.7 / 4.8）

### bedrock-runtime でしか呼べないモデル

- Amazon Nova 全系
- Llama 全系
- Claude の旧世代（Claude 3 系から Opus 4.6 / Sonnet 4.6 まで）
- Titan、Stability AI、Cohere など

Claude が Mantle で使えるのは新世代のみ、という点は注意が必要です。たとえば Sonnet 4.6 は Mantle 非対応なので、従来どおり bedrock-runtime から呼ぶことになります。

## OpenAI SDKで軽く叩いてみる

OpenAI SDK を使う場合、必要な変更は環境変数 2 つだけです。API キーには OpenAI のものではなく、Bedrock の API キーを設定します。Bedrock の API キーはコンソールから発行できるほか、aws-bedrock-token-generator ライブラリを使うと手元の AWS 認証情報から短期キー（12 時間有効）を生成できます。

```bash
export OPENAI_API_KEY=<BedrockのAPIキー>
export OPENAI_BASE_URL=https://bedrock-mantle.us-east-1.api.aws/v1
```

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="openai.gpt-oss-120b",
    input=[{"role": "user", "content": "こんにちは！あなたはどこで動いていますか？"}],
)
print(response.output_text)
```

実際に実行すると、以下のような応答が返ってきました。

```text
こんにちは！私はOpenAIのクラウド上で動作している、インターネットを通じてアクセスできるAIです。
```

コードは OpenAI をそのまま使うときと同じで、モデル名に Bedrock 側のモデル ID を指定する点だけが違います。ちなみにモデル本人は OpenAI のクラウドで動いているつもりのようですが、実際に動いているのは AWS の上です。

モデル一覧も OpenAI 互換の `GET /v1/models` でそのまま取得できます。SDK ならこう書けます。

```python
models = client.models.list()
for m in models.data:
    print(m.id)
```

手元で実行したところ 51 モデルが返ってきて、ID は anthropic.claude-haiku-4-5 のような短い形式でした。bedrock-runtime の us.anthropic.claude-haiku-4-5-20251001-v1:0 のような ID とは別体系になっています。

返ってきたモデル ID の抜粋がこちらです。Anthropic、OpenAI、xAI、DeepSeek、Qwen と、いろいろなプロバイダーのモデルが同じ形式で並んでいるのが分かります。

```text
anthropic.claude-opus-4-8
anthropic.claude-fable-5
anthropic.claude-haiku-4-5
openai.gpt-5.5
openai.gpt-oss-120b
xai.grok-4.3
deepseek.v3.2
qwen.qwen3-coder-480b-a35b-instruct
moonshotai.kimi-k2.5
google.gemma-4-31b
...（全 51 モデル）
```

:::note warn
一覧に出てくるモデルがすべて呼べるとは限りません。モデルアクセスは bedrock-runtime とは別に管理されていて、アカウントによっては未開放（403 エラー）のことがあります。実際、私のアカウントでは Claude は Mantle 側が未開放でした。
:::

## 独自機能ざっくり

Mantle には bedrock-runtime にはない機能がいくつかあります。

Zero Operator Access は、推論基盤に SSH のような対話的なアクセス手段を一切持たせない設計です。AWS のオペレーターであってもプロンプトの内容にアクセスできないことを、Nitro TPM による計測証跡でハードウェアレベルで保証しています。

https://aws.amazon.com/blogs/machine-learning/exploring-the-zero-operator-access-design-of-mantle/

Journal は、re:Invent 2025 のキーノートで紹介された、推論リクエストの状態を耐久性のあるトランザクションログとして記録し続ける仕組みです。従来は推論が途中で失敗すると最初からやり直すしかありませんでしたが、Journal に状態が残っているため途中から再開できます。長時間かかる計算集約的なジョブを一時停止して、あとから再開するという使い方も語られていて、Mantle の非同期・長時間実行ワークロードを支える土台になっている機能のようです。

ただし執筆時点では、Journal について書かれた公式ドキュメントは見当たりません（本記事の執筆にあたり再確認しましたが、公式の一次情報はキーノートのみでした）。以下のキーノート動画と、文章で追いたい方は非公式の解説記事を参考にしてください。

https://www.youtube.com/watch?v=JeUpUK0nhC0

https://medium.com/@mattgillard/getting-started-with-amazon-bedrock-mantle-openai-compatible-apis-on-aws-17cb8a9f2b9d

Projects API は、OpenAI 互換のプロジェクト管理機能です。アプリや環境ごとにプロジェクトを作り、IAM でのアクセス制御とコストの分離ができます。Responses API のステートフルな会話も、プロジェクト単位で分離されます。

https://docs.aws.amazon.com/bedrock/latest/userguide/projects.html

## （おまけ）これからはMantleが主役？

ここからは私の妄想です。

調べていて印象的だったのは、GPT-5.5 や Grok 4.3、Claude Mythos 5 といった最新モデルが Mantle 専用で登場していることです。新しいモデルはまず Mantle に載る、という流れができつつあるように見えます。登場後も PrivateLink 対応、Projects API、CloudWatch メトリクス対応と機能追加が続いており、2026 年 6 月には Bedrock のコンソール自体が OpenAI / Anthropic 互換 API 向けに最適化されていっているように感じます。

https://aws.amazon.com/about-aws/whats-new/2026/03/amazon-bedrock-projects-api-mantle-inference-engine/

一方で、公式は bedrock-runtime の置き換えではなく併用が前提だと明言しています（先ほどのエンドポイント比較ページに Both endpoints can be used together とあります）。Nova や Llama は runtime 側にしかありませんし、Claude の structured outputs が Mantle 側では使えない（bedrock-runtime では使える）といった機能差も残っています。

当面は二本立てで、新しいことは Mantle 側から始まることが多そう？といった温度感で捉えておくのがよさそうです。

## おわりに

以上、簡単ではありましたが、Bedrock Mantle がそもそも何者なのかという観点から整理してみました。色々調べた感じだと、OpenAI の API 形式という共通言語を受け入れた、Bedrock の新しい推論基盤と言えるかと思います。手元に OpenAI SDK で書いたコードがある方は、向き先を変えるところから試してみると実感が湧きやすいと思います。

今後も情報をウォッチしていければと思います。

ありがとうございました。
