---
title: "タメ口が生成AIコストに与える影響 ～「お願いいたします」vs「お願い」～"
description: "生成AI（ChatGPT、Claude、Geminiなど）を利用する機会が増えてきた昨今、APIコストの効率化は重要な課題になっています。日本語で生成AIと対話する際、「敬体（≒敬…"
pubDate: 2025-04-07
updatedDate: 2025-04-21
tags: ['自然言語処理', '生成AI']
qiitaId: 63e022ab807ce20eb522
importedDate: 2026-07-11
qiitaStats:
  views: 98575
  likes: 359
  stocks: 162
  fetchedAt: 2026-07-11
---

## はじめに

生成AI（ChatGPT、Claude、Geminiなど）を利用する機会が増えてきた昨今、APIコストの効率化は重要な課題になっています。日本語で生成AIと対話する際、「敬体（≒敬語）を使うべきか、常体（≒タメ口）を使うべきか」という選択は、単なるコミュニケーション形式の問題だけでなく、コスト面でも影響を及ぼすと考えられます。

本記事では、**敬語と常体の使用がトークン数やAPIコストにどのような違いをもたらすのか**、調査した結果をまとめていきたいと思います。

## 敬体と常体の文字数比較

まず初めに、同じ内容を伝える際の敬体と常体の**文字数の違い**をPythonで比較してみました。

<details><summary>実行コード</summary>

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import japanize_matplotlib

# 比較用の例文セット
examples = [
    {"plain": "わかりました", "polite": "承知いたしました"},
    {"plain": "これをください", "polite": "こちらをいただけますでしょうか"},
    {"plain": "待ってください", "polite": "少々お待ちくださいませ"},
    {"plain": "明日までに送ります", "polite": "明日までにお送りさせていただきます"},
    {"plain": "連絡します", "polite": "ご連絡させていただきます"},
    {"plain": "明日会議に行く", "polite": "明日会議にお伺いいたします"}
]

# 文字数を計算
for example in examples:
    example["plain_length"] = len(example["plain"])
    example["polite_length"] = len(example["polite"])
    example["increase_rate"] = (example["polite_length"] / example["plain_length"]) * 100

# DataFrameに変換
df = pd.DataFrame(examples)

# 結果を表示
result_df = df[["plain", "plain_length", "polite", "polite_length", "increase_rate"]]
print(result_df)

# 平均増加率を計算
avg_increase = df["increase_rate"].mean()
print(f"\n平均文字数増加率: {avg_increase:.1f}%")

# 視覚化
plt.figure(figsize=(10, 6))
bars = plt.bar(df["plain"], df["increase_rate"])
plt.axhline(y=avg_increase, color='r', linestyle='-', label=f'平均: {avg_increase:.1f}%')
plt.ylabel('文字数増加率 (%)')
plt.title('敬体による文字数増加率')
plt.xticks(rotation=45, ha='right')
plt.legend()
plt.tight_layout()
plt.savefig('character_increase.png')
```
</details>

### 実行結果

| # | 常体 | 常体_文字数 | 敬体 | 敬体_文字数 | 文字数増加率 |
|---|-------|--------------|--------|---------------|---------------|
| 0 | わかりました | 6 | 承知いたしました | 8 | 133.3 |
| 1 | これをください | 7 | こちらをいただけますでしょうか | 15 | 214.3 |
| 2 | 待ってください | 7 | 少々お待ちくださいませ | 11 | 157.1 |
| 3 | 明日までに送ります | 9 | 明日までにお送りさせていただきます | 17 | 188.9 |
| 4 | 連絡します | 5 | ご連絡させていただきます | 12 | 240.0 |
| 5 | 明日会議に行く | 7 | 明日会議にお伺いいたします | 13 | 185.7 |

**全体平均：敬体は常体の約1.87倍（186.6%）の文字数**

また、以下は上記の結果をグラフ化したものになります。

![character_increase.png](https://images.ryu-ki-learn.com/polite-vs-casual-llm-cost/45f01061-a590-4500-b9f4-7538fe47d392.png)

以上のように、単純な文字数で試してみると、2倍近くの文字数になることもあることがわかりました。

## トークン数への影響

文字数の違いはわかりましたが、生成AIモデルが実際に処理する単位であるトークン数はどうでしょうか。トークン化は単純な文字数とは必ずしも一致しないため、実際のトークン数を推定して比較しました。今回はPythonとOpenAIのトークナイザーを使用して実際のトークン数を計測します。
なお、その際利用したライブラリ（`tiktoken`）についての説明は省略します。詳細は以下のリンクなどが参考になるかと思います。

https://github.com/openai/tiktoken

https://eng-blog.iij.ad.jp/archives/25669

<details><summary>実行コード</summary>

```python
import tiktoken
import pandas as pd

# 比較用の例文セット
examples = [
    {"plain": "わかりました", "polite": "承知いたしました"},
    {"plain": "これをください", "polite": "こちらをいただけますでしょうか"},
    {"plain": "待ってください", "polite": "少々お待ちくださいませ"},
    {"plain": "明日までに送ります", "polite": "明日までにお送りさせていただきます"},
    {"plain": "連絡します", "polite": "ご連絡させていただきます"},
    {"plain": "明日会議に行く", "polite": "明日会議にお伺いいたします"}
]

# OpenAIのGPT-3.5/4モデル用のエンコーダー（cl100k_base）を取得
encoder = tiktoken.get_encoding("cl100k_base")

# 結果を格納するデータフレーム用のリスト
results = []

# 各例文をトークン化し、トークン数をカウント
for example in examples:
    plain_text = example["plain"]
    polite_text = example["polite"]
    
    plain_tokens = encoder.encode(plain_text)
    polite_tokens = encoder.encode(polite_text)
    
    plain_token_count = len(plain_tokens)
    polite_token_count = len(polite_tokens)
    
    increase_rate = (polite_token_count / plain_token_count) * 100
    
    results.append({
        "常体": plain_text,
        "常体_文字数": len(plain_text),
        "常体_トークン数": plain_token_count,
        "敬体": polite_text,
        "敬体_文字数": len(polite_text),
        "敬体_トークン数": polite_token_count,
        "文字数増加率": (len(polite_text) / len(plain_text)) * 100,
        "トークン数増加率": increase_rate
    })

# データフレームに変換して表示
df = pd.DataFrame(results)
print(df[["常体", "常体_トークン数", "敬体", "敬体_トークン数", "トークン数増加率"]])

# 全体の平均増加率を計算
avg_token_increase = df["トークン数増加率"].mean()
print(f"\n平均トークン数増加率: {avg_token_increase:.1f}%")

# トークン数増加率の視覚化
plt.figure(figsize=(10, 6))
bars = plt.bar(df["常体"], df["トークン数増加率"])
plt.axhline(y=avg_token_increase, color='r', linestyle='-', label=f'平均: {avg_token_increase:.1f}%')
plt.ylabel('トークン数増加率 (%)')
plt.title('敬体によるトークン数増加率')
plt.xticks(rotation=45, ha='right')
plt.legend()
plt.tight_layout()
plt.savefig('character_token_increase.png')
```
</details>

### 実行結果

| # | 常体 | 常体_トークン数 | 敬体 | 敬体_トークン数 | トークン数増加率 |
|---|------|----------------|------|----------------|----------------|
| 0 | わかりました | 3 | 承知いたしました | 4 | 133.3 |
| 1 | これをください | 3 | こちらをいただけますでしょうか | 7 | 233.3 |
| 2 | 待ってください | 3 | 少々お待ちくださいませ | 7 | 233.3 |
| 3 | 明日までに送ります | 6 | 明日までにお送りさせていただきます | 12 | 200.0 |
| 4 | 連絡します | 3 | ご連絡させていただきます | 9 | 300.0 |
| 5 | 明日会議に行く | 7 | 明日会議にお伺いいたします | 11 | 157.1 |

**全体平均：敬体は常体の約2.1倍（209.5%）のトークン数**

また、以下は上記の結果をグラフ化したものになります。

![character_token_increase (1).png](https://images.ryu-ki-learn.com/polite-vs-casual-llm-cost/cb74fb16-b80d-490c-a3e3-ff31edc6717c.png)

実際のトークナイザーでは、文字数よりもさらに大きな差が出ることがわかりました。

## コスト影響の試算

最後に、Pythonを使用して測定した実際のトークン数に基づき、コスト影響を試算してみます。

<details><summary>実行コード</summary>

```python
# APIの料金計算（GPT-4の場合）
api_cost_input = 0.03  # $0.03 per 1000 tokens (input)
api_cost_output = 0.06  # $0.06 per 1000 tokens (output)
daily_usage = 100  # 1日あたり10回のやり取り
yearly_days = 365

# 平均トークン数
avg_plain_tokens = df["常体_トークン数"].mean()
avg_polite_tokens = df["敬体_トークン数"].mean()

# 年間コスト計算（入力と出力の両方を考慮）
plain_yearly_cost_input = avg_plain_tokens * daily_usage * yearly_days * api_cost_input / 1000
plain_yearly_cost_output = avg_plain_tokens * 5 * daily_usage * yearly_days * api_cost_output / 1000  # 出力は入力の5倍と仮定

polite_yearly_cost_input = avg_polite_tokens * daily_usage * yearly_days * api_cost_input / 1000
polite_yearly_cost_output = avg_polite_tokens * 5 * daily_usage * yearly_days * api_cost_output / 1000

total_plain_cost = plain_yearly_cost_input + plain_yearly_cost_output
total_polite_cost = polite_yearly_cost_input + polite_yearly_cost_output

print(f"常体での年間推定コスト: ${total_plain_cost:.2f}")
print(f"敬体での年間推定コスト: ${total_polite_cost:.2f}")
print(f"差額: ${(total_polite_cost - total_plain_cost):.2f}")
print(f"増加率: {(total_polite_cost / total_plain_cost * 100):.1f}%")
```
</details>

### 実行結果
```
常体での年間推定コスト: $50.19
敬体での年間推定コスト: $100.38
差額: $50.19
増加率: 200.0%
```

この試算では、GPT-4のAPIレートを使用し、入力と出力の両方のコストを考慮しています。また、出力は入力の約5倍のトークン量になると仮定しています。

結果として、敬体を使用すると年間コストが約2倍になることがわかりました。具体的な金額では、年間で約50ドルの差額が生じています。これは小規模な利用では小さく見えるかもしれませんが、大規模なAI利用においては無視できない金額になると考えられます。（例えば、日々のやり取りが1万回になると、年間の差額は約5000ドルとなります。）

以上より、特に大量のテキスト生成や処理を行う場合では、敬体/常体の選択がコストに無視できない影響を与えると言えるのではないでしょうか。

## 回答の質への影響

敬体と常体の使い分けは、トークン数やコストだけでなく、AIからの回答の質にも影響する可能性があります。以下の表のような違いがあると考えます。

| 観点 | 常体 | 敬体 |
|---------|--------------|---------------|
| 正確性 | 変化なし（内容自体は同等） | 変化なし（内容自体は同等） |
| 感情表現 | 直接的で率直 | 婉曲的で控えめ |
| 印象 | 簡潔になりがち | 丁寧に詳述する傾向 |
| 文脈の適切さ | カジュアルな対話 | 公式な質問応答 |
| 受け手の印象 | 親近感・気軽さ | 敬意・距離感 |


### モデルの訓練バイアス
インターネットにある情報は常体・敬体によって、その特徴が異なることがあると考えられ、日本語の訓練データにおける敬体と常体の分布は不均衡である可能性が高いと考えられます。その結果、以下の表のような要素によって、回答の質に影響を及ぼす可能性が考えられます。

| 要素 | 常体 | 敬体 |
|------------|--------------|--------------|
| 学習データの出典 | SNS投稿、個人ブログ、カジュアルなフォーラム、オンライン会話 など | 公式文書、学術論文、報道記事、企業サイト など |
| データの品質傾向 | 非公式情報、即時性の高いコンテンツが多い | 検証された情報、編集済みコンテンツが多い |
| 回答スタイル | 直接的、断定的、個人的見解を含みやすい | 慎重、留保表現を含む、断定を避ける |
| 情報の保守性 | 新しい情報、議論中の話題も積極的に取り入れる | 確立された知識、広く受け入れられた見解を優先 |
| 専門知識分野 | インターネット文化、流行語、新語に強い | 学術・専門分野の用語や概念に強い |
| 意見の多様性 | 多様な立場からの意見を含む（極端な見解も） | 中立的・公式的見解に偏りやすい |
| 誤情報リスク | 比較的高い（検証されていないソースの影響） | 比較的低い（検証済みソースが多いため） |
| 表現の革新性 | 新しい言い回しや表現手法を取り入れやすい | 保守的で伝統的な表現が多い |
| 想定読者層 | カジュアルな文脈の読者（友人間、若年層など） | フォーマルな文脈の読者（ビジネス、学術など） |

## 実践的なアプローチ

敬語と普通体のバランスをどのように取るべきでしょうか。以下にいくつかのアイデアを共有します。

:::note
ここからのアイデアは、新卒2年目の筆者が考えたアイデアとなっております。
その点をご理解いただけますと幸いです。
:::

### 1. 入力は常体、出力は敬体とする

コスト効率と出力品質の両方を最適化するには、「入力：常体、出力：敬体」という組み合わせが有効ではないかと考えます。

```python
# 効率的なプロンプト例（常体）
prompt = """
以下の質問に答えて。簡潔に説明して。
質問: AIとは何か？

回答は敬語で作成してください。
"""

# 非効率なプロンプト例（敬体）
prompt_polite = """
以下のご質問に答えてください。簡潔な説明を心がけてください。
ご質問: AIとは何でしょうか？

回答は敬語で作成してください。
"""
```

#### メリット
1. **入力コストの大幅削減**：上記の分析結果から、入力トークン数を約2倍削減できる
2. **出力品質の維持**：最終的な回答は敬体で丁寧さを保つことができる
3. **実装の容易さ**：プロンプトの最後に一行追加するだけで実現できる

特に長いプロンプトや複雑な指示を与える場合、入力トークンのコスト削減効果は非常に大きくなると考えます。

### 2. 内部利用と外部利用の使い分け
- **内部利用（社内文書、下書き等）**：コスト効率を重視して常体を基本とする
- **外部利用（顧客向け文書等）**：必要に応じて敬体を使用、または最終出力のみを敬体に変換

### 3. 会話の流れでの使い分け
- 複雑な指示や長い会話：常体
- 最終的な文書生成時：敬体

## まとめ

今回の調査から、**敬体の使用は常体と比較して約2倍のトークン数を必要**とし、それに比例してAPIコストも増加することがわかりました。特に大量のテキスト生成や処理を行う企業にとって、この違いは無視できないコスト要因となるといえるでしょう。

一方で、敬体と常体は回答の印象や明確さにも影響する可能性があるため、**用途に応じた適切な使い分け**が重要です。

生成AIをより効率的に活用するために、言語スタイルの選択は意外に重要な要素だと思います。皆さんの業務での生成AI活用にこの知見が役立てば幸いです。


## おわりに
世間がMCP一色の中、ひとりで敬語とタメ口の文字数やトークン数を数えるという謎な時間を過ごしましたが、思ったよりもコスト効果があるんじゃないか？と思える結果になった気がして楽しかったです。今回はほぼ机上の計算だけで終わりましたが、どこかで実践的なことができればいいなと思います。
ありがとうございました。

## おまけ
本記事と、本記事を常体で書きなおしたテキストのトークン数は以下のようになりました。（claudeにより生成・ソースコード部分は除去）
表やURLなどは除去していないのでもう少し増加率が上がるかもしれませんが、**増加率としては約1.17倍**、**トークン数としては400ほど**変わりました。これが多いか少ないかは皆さん次第かもしれません。
今度こそ終わりです。長々とありがとうございました。

| 常体_トークン数 | 敬体_トークン数 | トークン数増加率 |
|----------------|----------------|----------------|
| 2503 | 2936 | 117.30 |

## おまけ②（2025/04/21 追記）
>ChatGPTに対する「ありがとう」や「お願いします」といった礼儀正しい言葉が数十億円分の電力消費につながっているとOpenAIのサム・アルトマンCEOが発言

https://gigazine.net/news/20250421-politeness-could-be-costly-ai/

といった記事が投稿されていました。
（数十億というのは半分冗談のニュアンスもあると思いますが）
SDGs的観点からみると、タメ口の方がよいのかもしれません。
