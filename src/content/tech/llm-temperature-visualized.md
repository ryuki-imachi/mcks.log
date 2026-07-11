---
title: "【LLM】Temperature ってなに？実際に値を動かして挙動を確認してみた"
description: "Amazon Bedrock で LLM を呼び出すとき、temperature パラメータについて意識したことはありますか？意識している方はこのパラメータの意味をどの程度把握して…"
pubDate: 2026-05-25
tags: ['Temperature', 'Bedrock', 'LLM', 'Qwen3']
qiitaId: 565e5c07db4d962d2d29
importedDate: 2026-07-11
qiitaStats:
  views: 901
  likes: 3
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

Amazon Bedrock で LLM を呼び出すとき、`temperature` パラメータについて意識したことはありますか？意識している方はこのパラメータの意味をどの程度把握して設定していますか？

正直私は値が大きいと良くも悪くも出力がブレる、小さいとブレにくい程度の感覚で触っています。今回は実際の LLM の確率分布を覗きながら、Temperature の仕組みを整理してみます。ついでに `Top-k`, `Top-p` についても説明できればと思います。

なお、Bedrock の Claude や Nova ではトークンごとの確率（logprobs）が取れないようなので、可視化にはローカルで動かした Qwen3-0.6B を使いました。HuggingFace で公開されているオープンソースモデルなら、`transformers` ライブラリ経由で各トークンのスコアが取り出せます。

https://huggingface.co/docs/transformers/main_classes/output

## Temperature とはなにか

Temperature は、LLM の出力にどれくらいランダムさを加えるかを調整するパラメータです。LLM は次に出てくる単語を確率的に選びながら文を作っていきますが、Temperature を低くするほど一番もっともらしい単語ばかり選ぶようになり、毎回ほぼ同じ無難な答えに収束します。逆に高くすると本来は確率の低い単語も選ばれやすくなり、多様で予想外の答えが返ってくるようになります。

なお、Bedrock 経由の Claude では `0.0` から `1.0` の範囲、デフォルトは `1.0` です。

https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InferenceConfiguration.html

:::note warn
OpenAI 系は `0.0` から `2.0` まで指定できる点が違うので、利用する際は各プロバイダーのドキュメントなどを確認するようにしてください。

https://platform.openai.com/docs/api-reference/chat/create
:::

## 仕組み

Temperature の効果はシンプルで、トークン候補ごとに計算されたスコアを Temperature の値で割っているだけです。Temperature が小さいほどスコアの差が広がって特定のトークンに確率が集中し、Temperature が大きいほど差が縮まって複数のトークンが拮抗します。

文章で説明してもわかりにくいので実際に見てみましょう。

## 実際の LLM で確率分布を見てみる

Qwen3-0.6B に以下のプロンプトを与えて、次に来るトークンの確率分布を取り出しました。

```text
Top 5 popular programming languages: Python, JavaScript, Java, 
```

:::note
日本語だとトークンで1文字だけのケースがあり、トークンのイメージがつきにくいので英語でやりとりしています。
:::

Temperature を `0.1` / `0.3` / `0.7` / `1.0` の 4 段階で変えた結果が以下です。

![](https://images.ryu-ki-learn.com/llm-temperature-visualized/llm-temperature-effect.png)

`0.1` ではほぼ「C」一択(確率 `1.00`)で、`1.0` まで上げると「C」`0.27`、「Python」`0.11` を筆頭に、「3」「and」「SQL」など複数のトークンが拮抗してきます。（やはりCやPythonはポピュラーですね）

## Top-k との違い

Temperature と並んでよく使われるパラメータに Top-k があります。確率の高い上位 k 個のトークンだけを候補にする仕組みで、Temperature が分布の形を変えるのに対し、Top-k はサンプリング対象のトークン数を直接絞り込みます。

同じプロンプトで Temperature を `1.0` に固定したまま、Top-k の値だけを変えてみました。

![](https://images.ryu-ki-learn.com/llm-temperature-visualized/llm-topk-effect.png)

赤い破線より右側のトークンはサンプリング対象から外れます。Top-k を小さくすれば安全寄り、大きくすれば多様性のある出力が得られやすくなります。

## Top-p というもう 1 つの絞り方

Top-p（または nucleus sampling と呼ばれる手法）も有効なパラメータです。（が、私はあまり使ったことはありません...）確率の累積値が p に達するまでのトークンを候補にする仕組みで、Top-k が個数を指定するのに対して累積確率で絞ります。分布の形に応じて候補数が動的に変わるのが特徴です。

以下の図は Temperature を `0.5` に固定して Top-p の値を動かした結果です。

:::note
`1.0` のままだと 見にくかったので `0.5` にしています
:::

![](https://images.ryu-ki-learn.com/llm-temperature-visualized/llm-topp-effect.png)

`p = 0.5` だと「C」1 個だけで累積 `0.72` を超えるので候補は 1 つ、`p = 0.8` だと 2 つ、`p = 0.9` だと 4 つです。個数を明示せず、分布の形に応じて候補数が自然に決まる点がポイントです。

:::note warn
なお Anthropic の公式ドキュメントでは、Temperature と Top-p は「どちらか片方だけを調整する」ことが推奨されています。両方同時に動かすと効果が読みづらくなるためです。

https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
:::

## Bedrock で設定するには

Bedrock の Converse API では、Temperature と Top-p は `inferenceConfig` の基本パラメータとして渡せます。一方、Top-k は基本パラメータの枠外なので `additionalModelRequestFields` に渡す形になります。（Top-p は基本パラメータなのですね、今回調べるまで知りませんでした...）

https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html

:::note
Python（boto3）から渡すときのキー名は `topP`（camelCase）と `top_k`（snake_case）で表記が違う点に注意してください。本記事の本文ではハイフン区切りの一般表記（`Top-p` / `Top-k`）で揃えています。
:::

```python
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")

response = client.converse(
    modelId="us.anthropic.claude-sonnet-4-6",
    messages=[
        {
            "role": "user",
            "content": [{"text": "Pythonでフィボナッチ数列を計算する関数を書いてください"}],
        }
    ],
    inferenceConfig={
        "temperature": 0.2,
        "topP": 0.9,
        "maxTokens": 1024,
    },
    additionalModelRequestFields={
        "top_k": 50,
    },
)

print(response["output"]["message"]["content"][0]["text"])
```

:::note
前述のとおり、Temperature と Top-p は片方を固定したままもう片方を調整するのが基本ですので注意してください。
:::

## ユースケース別の目安

実用上の目安をまとめます。

| ユースケース          | 推奨 Temperature | 理由                         |
| --------------- | -------------- | -------------------------- |
| データ抽出・分類        | 0.0 〜 0.3      | 正確さを最優先したい                 |
| Q&A・カスタマーサポート   | 0.4 〜 0.7      | 事実に忠実に、ただし定型文すぎない自然さも欲しい   |
| 創作文章・ブレインストーミング | 0.8 〜 1.0      | 独創性や予想外の発想を引き出したい（1.0 が上限） |

迷ったらまず `0.7` で動かしてみて、出力を見ながら上下に調整するのがやりやすそうです。

## 注意点

最後にいくつか注意点を挙げます。

- `Temperature = 0` でも完全に**同じ出力になる保証はありません**。処理の中でスコアが近いトークン同士で順位が入れ替わることがあります。
- Temperature はモデルの賢さを変えるものではなく、確率分布からどう選ぶかを調整しているだけです。
- 高すぎる Temperature は低確率のトークンが選ばれやすくなるので、ハルシネーションが増える方向に働きます。
- 2026 年 5 月時点で、Claude Opus 4.7 では Temperature・Top-p・Top-k のすべてが非推奨となり、非デフォルト値を指定すると `400` エラーが返ります。

https://platform.claude.com/docs/en/about-claude/models/migration-guide

## おわりに

以上、簡単ではありましたが、実際に値を動かしながら結果の推移を眺めることで大まかにどう言う部分に効いてくるのかのイメージが掴みやすくなったと思います。

細かい仕組みについては今回説明を省略していますので、完全に理解したとは言えませんが、単に暗記するのではなく大まかな仕組みがつかめていると良いのではと個人的には思います。

自分自身も再整理することで勉強になりました。今後もちょこちょここういった記事を書いていければと思います。

ありがとうございました。
