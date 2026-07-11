---
title: "フォーマットが生成AIコストに与える影響 ～ JSON vs Markdown vs CSV ～"
description: "表データを LLM に渡すとき、私はずっと、構造化された JSON が一番 LLM に優しいだろうと思い込んでいました。ところがある日、Claude Code に、「Markdow…"
pubDate: 2026-06-08
tags: ['トークン', 'LLM', 'プロンプトエンジニアリング', 'Claude', 'ClaudeCode']
qiitaId: a3b869ccf04a192e30d3
importedDate: 2026-07-11
qiitaStats:
  views: 690
  likes: 1
  stocks: 0
  fetchedAt: 2026-07-11
---


## はじめに

表データを LLM に渡すとき、私はずっと、構造化された JSON が一番 LLM に優しいだろうと思い込んでいました。ところがある日、Claude Code に、「**Markdown でも JSON でも性能はそんなに変わらないし、トークンコストを考えると Markdown の方がいい**」と言われました。が、直感に反しており納得できませんでした。

なので本記事で実際に計測してみようと思います。

今回、フォーマットによって表のデータを正確に読み取れるかを知りたかったので、表から値を読み取る難易度を2段階に分けて測ってみました。

## 検証方法

### 前提環境

- Claude Code 2.1.162
- Python 3.9（データ生成・採点スクリプト）

### タスク

前述した通り、ある社員テーブルについて、読み取りの難易度が違う2種類の質問を用意しました。どちらも表のどこかに書いてある値を読み取るだけです。

- lookup（単一セル参照）：「emp_id が E027 の社員の years は？」のように、1 行を特定して 1 つの値を読むだけの質問です。
- retrieval（複数セル読み取り）：「years が 13 以上 18 以下の社員の name を全員、漏れなく挙げてください」のように、条件に当てはまる行を全部見つけて name を列挙する質問です。

1 つだけ取得するのと、複数の値を取りこぼさず取得するのでは難易度が違い、フォーマットごとの影響も変わるのではないかと考えて分けました。

### 条件

総当たりで 18 条件になりました。

| 要因 | 水準 |
|---|---|
| モデル | Claude Haiku 4.5 / Sonnet 4.6 / Opus 4.8 |
| データ量 | 30 行 / 150 行（列は 6 列で固定） |
| フォーマット | CSV / Markdown / JSON (pretty) |
| 試行 | 各条件 10 回 |

3 モデル × 2 サイズ × 3 形式で 18 条件、各 10 試行、それぞれ 20 問なので、合計で 3,600 問を解かせました。

被験者は Claude Code のサブエージェントとして定義しました。サブエージェントは `.claude/agents/` にマークダウンファイルを置くだけで使えます。

https://docs.anthropic.com/en/docs/claude-code/sub-agents

素の読解力を見たかったので使えるツールを `Read` だけに制限して、bash やコード実行を禁止します。また、1 試行ごとに独立したサブエージェント（＝独立したコンテキスト）を立ち上げて、カンニングをできないようにしました。エージェントの定義は以下の通りです。

```markdown
---
name: table-qa-solver
description: 表データ読解ベンチマークの被験者
tools: Read
model: haiku
---
あなたは「表データ読解ベンチマーク」の被験者です。
- 使えるツールは Read のみ（コード実行・計算ツールは持っていない）。表を自分の目で読む。
- 複数該当する質問では、当てはまる name を読点で区切って答える。最後に JSON 配列で回答する。
```

データの生成と採点はすべてスクリプトにしました。

## 実装の概要

ベンチマークの実行には Claude Code が必要です。全体の流れは以下のとおりです。

```text
1. データ生成（Python スクリプト）
   └─ 社員表・質問・正解を seed=42 固定で生成

2. ベンチマーク実行（Claude Code ワークフロー）
   └─ 18条件 × 10試行 = 180回、被験者サブエージェントを起動して回答を記録

3. 採点・可視化（Python スクリプト）
   └─ 回答と正解を突き合わせて集計、グラフ生成
```

データ生成（`gen_dataset.py`）では、seed 固定で社員表をランダム生成しています。

```python
# gen_dataset.py（抜粋）
SEED = 42
COLS = ["emp_id", "name", "department", "age", "salary", "years"]

def build_rows(size, rng):
    full_names = [s + g for s in SURNAMES for g in GIVEN]  # 300通り
    names = rng.sample(full_names, size)
    rows = []
    for i in range(size):
        rows.append({
            "emp_id": f"E{i + 1:03d}",
            "name": names[i],
            "department": rng.choice(DEPARTMENTS),
            "age": rng.randint(22, 60),
            "salary": salaries[i],
            "years": rng.randint(1, 30),
        })
    return rows
```

採点（`score.py`）では、回答の名前集合と正解の名前集合を突き合わせています。

```python
# score.py（抜粋）
def prf(expected, actual):
    """precision / recall / F1"""
    tp = len(expected & actual)
    p = tp / len(actual)   # 挙げた名前のうち正しかった割合
    r = tp / len(expected)  # 正解のうち拾えた割合（= recall）
    f1 = 2 * p * r / (p + r) if (p + r) else 0.0
    return p, r, f1
```


## 結果

### 単一セル参照（lookup）

lookup は全条件で 100% でした。

フォーマットも、データ量（30行・150行）も、モデルの大小も関係なく、特定の1つの値を取り出すだけなら正確に読めるようです。

### 複数セル読み取り（retrieval）

差が出たのは、条件に当てはまる人を全員列挙する retrieval のほうです。

![複数セル読み取りの recall: 形式×モデル×サイズ](https://images.ryu-ki-learn.com/llm-table-format-csv-md-json/fig_retrieval.png)

採点は、正解をどれだけ漏れなく拾えたか（recall）で見ました。挙げた名前が間違っていたケースはほぼなく、ミスのほとんどは該当する人の見落としです。

**30 行**

| モデル | CSV | Markdown | JSON |
|---|---|---|---|
| Haiku | 93% | 93% | 95% |
| Sonnet | 96% | 94% | 96% |
| Opus | 99% | 100% | 98% |

**150 行**

| モデル | CSV | Markdown | JSON |
|---|---|---|---|
| Haiku | 70% | 81% | 73% |
| Sonnet | 93% | 95% | 92% |
| Opus | 93% | 94% | 94% |

30 行ではどのモデルも 93〜100% で、フォーマットの差はほとんどありません。差がはっきり出たのは 150 行で、特に Haiku では CSV が 70% まで落ち込み、Markdown が 81% でいちばん高くなりました。

### コスト（実消費トークン）

![実消費トークン(モデル×サイズ×形式)](https://images.ryu-ki-learn.com/llm-table-format-csv-md-json/fig_cost_measured.png)

被験者が実際に消費したトークン（プロンプト＋思考＋出力の合計）で比べました。JSON と CSV の比は 30 行で約 1.28 倍、150 行で 1.7〜1.9 倍です。Markdown は CSV の約 1.1〜1.3 倍で、コスト増は軽めでした。

## 考察

lookup は全条件 100% だったので、値を 1 つ読むだけならフォーマットは何でもよさそうです。

差が出たのは複数セル読み取り × 150 行の組み合わせで、モデルが弱いほど差が広がりました。Haiku は CSV 70% に対し Markdown 81% と 11 ポイントの開きがありましたが、Sonnet では 92〜95%、Opus では 93〜94% とほぼ横並びです。賢いモデルほどフォーマットの差を吸収できるようですが、弱いモデルで大きい表を読ませるなら Markdown が安定していました。

コスト面では JSON がいちばん高い順序は変わらず、読み取り精度で JSON が大きく勝つ場面も今回はなかったので、わざわざ JSON を選ぶ理由は薄いと思います。

## 結論

Claude Code に言われた、「Markdown でも JSON でも性能はそんなに変わらないし、コストを考えると Markdown の方がいい」は、だいたい正しかったです。

- lookup や小さい表では、フォーマットによる差はほとんどなかった
- 大きい表を弱いモデルで読ませると差が出て、Markdown が CSV・JSON を上回った
- コスト面でも Markdown は CSV に近く、JSON より軽い

JSON が最良という思い込みは間違っていそうです。

### 実務的な選び方

今回調べた結果を踏まえると以下のことが言えそうです。

- 値を1つ参照するだけなら、CSV でよい（いちばん安い）
- 大きい表を扱う場合
  - Haiku のような軽量モデルで読ませるなら、CSV は避けて Markdown にするのがよさそう
  - Opus のような賢いモデルなら、どの形式でも取りこぼしが少ないので CSV で十分そう
- 迷ったら Markdown にしておけば、コスト増が軽いわりに読み取りが安定する


## おわりに

以上、簡単ではありましたが、表データを CSV / Markdown / JSON で出し分けて、どれが正確に読めるかを Claude の 3 モデルで測ってみました。勝手に JSON 最強！と思い込んでいましたが実測してみると面白い結果が見れたかなと思います。実際に調べてみるのは大事ですね。~~（Max プランにしてから多少持て余していたので使えてよかったです）~~

トークン効率よくタスクを実施していくことはしばらくの間は課題になるかなと思うので、今後も色々調べながら効率よくLLMを利用していきたいと思います。

ありがとうございました。
