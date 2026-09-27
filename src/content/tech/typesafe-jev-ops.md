---
title: "【Jev】文章を返さない判断モデル Jev とは？〜システム運用での活用方法についても想像してみる〜"
description: "TypeSafe AI という会社が Jev というモデルを発表しました。文章を生成しない、質問に対して判断と確率だけを返す、というモデルです。"
pubDate: 2026-09-18
tags: ['TypeSafeAI', 'Jev', 'LLM', 'システム運用', 'AIエージェント']
qiitaId: e3fe99b5f6704d08a19b
importedDate: 2026-09-27
qiitaStats:
  views: 5038
  likes: 12
  stocks: 2
  fetchedAt: 2026-09-27
---

## はじめに

TypeSafe AI という会社が Jev というモデルを発表しました。文章を生成しない、質問に対して判断と確率だけを返す、というモデルです。

https://typesafe.ai/

早期アクセスの段階で私は触れていません。が、面白そうな代物なので、前半でドキュメントに書いてあることを、後半で向いている使いどころと、それをシステム運用に当てはめて考えたことを紹介します。

## 前提

| 項目 | 内容 |
|------|------|
| 情報の時点 | 2026年9月18日 |
| 提供状況 | 早期アクセス（ウェイトリスト） |
| 提供形態 | API のみ（VPC / オンプレミスの記載なし） |
| 参照 | 公式ドキュメント / ブログ / cookbook |
| 手元での動作確認 | なし |

## ドキュメントからわかること

:::note warn
本節は、公式ドキュメントと cookbook に書かれていることだけをまとめます。数字もすべてドキュメントの記載で、私が測ったものはありません。
:::

### Jev の入出力

Jev はテキストを渡すと型付きの答えと確率を返すモデルです。テキストは生成しないと明記されています。TypeSafe AI はこれを System One モデルと呼んでいます。

問い合わせの文章を `state` として渡し、聞きたいことを `questions` に型付きで書きます。リクエストは次の形です。

```json
{
  "state": "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this",
      "criteria": {
        "billing": "Payment or subscription issues",
        "technical": "Bugs or integration problems",
        "sales": "Pricing or account questions"
      }
    },
    "frustration": {
      "type": "score",
      "instructions": "How frustrated the customer appears",
      "criteria": [
        "Calm, just stating facts",
        "Frustrated but civil",
        "Very angry, strong language"
      ]
    },
    "is_urgent": {
      "type": "noul",
      "instructions": "The message conveys urgency or time-sensitivity"
    }
  }
}
```

レスポンスでは、Choice は選んだ値と確率分布 `probabilities`、Score は点数を返し、どちらにもそれとは別に0〜1の確信度 `confidence` が付きます。Noul は0〜1の値だけが返ります。

```json
{
  "model": "jev-latest",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "billing",
      "probabilities": {
        "billing": 0.84,
        "technical": 0.159,
        "sales": 0.001
      },
      "confidence": 0.596
    },
    "frustration": {
      "type": "score",
      "score": 1.035,
      "legend": {
        "0": "Calm, just stating facts",
        "1": "Frustrated but civil",
        "2": "Very angry, strong language"
      },
      "confidence": 0.842
    },
    "is_urgent": {
      "type": "noul",
      "noul": 0.999
    }
  }
}
```

https://docs.typesafe.ai/introduction/quickstart

質問の型は3種類です。

| 型 | 返るもの | 用途 |
|----|---------|------|
| Choice | 選択肢の1つと確率分布 | 分類、振り分け |
| Score | 採点基準（ルーブリック）に沿った点数 | 採点、優先度付け |
| Noul | 真である確率（0〜1） | yes / no の確からしさ |

### 公式の数字

| 項目 | 値 |
|------|-----|
| レイテンシ | 70〜500ms |
| 入力料金 | 100万トークンあたり0.042ドル |
| 出力料金 | 無料 |
| レート制限（トークン） | 25万/秒（動的に変動） |
| レート制限（リクエスト） | 1,200/分（動的に変動） |

https://docs.typesafe.ai/models

https://typesafe.ai/blog/introducing-system-one-models-and-jev

トップページには LLM と比べて193.6倍速く444.6倍安いという数字が出ていますが、TypeSafe AI 自身がブログで、実際に得られる効果としては高めの値になる見込みだと説明しています。

### 公式のユースケースとパターン

公式のユースケース一覧には、例えば次のような使い方が載っています。

- 金融犯罪検知のアラートにリスクや関連度の点数を付けて、対応する順番を決める
- 保険請求から不備や不正の兆候を検知して、危ない案件だけ人に回す
- LLM の出力にツール呼び出しの誤りがないかを検知する

この3つの例に共通する、確信度をしきい値と比べて自動処理と人への引き渡しを分ける設計は、confidence-routing というパターンとして別のページで紹介されています。

例では確信度が0.6未満なら人にエスカレーション、リスクの高い操作（送金の承認）は0.85を超えたときだけ自動で実行、という設計です。

https://docs.typesafe.ai/concepts/use-case-map

https://docs.typesafe.ai/patterns/confidence-routing

### cookbook の実験結果

公式の cookbook には、実験の結果とあわせて使い方を説明したページがあります。

- 同じ入力を繰り返し投げても答えのぶれは小さく、確率がしきい値未満のものを人に回すと正解との一致率が90.8%から99.2%に上がった
- 複数の質問を1リクエストにまとめても互いに影響せず、まとめた方が安く速い
- 安いモデルの結果を Jev が検証し、怪しい項目だけ推論モデルに回す cascade という構成がある

https://docs.typesafe.ai/cookbooks/consistency_choice_cookbook

https://docs.typesafe.ai/cookbooks/parallel_questions

https://docs.typesafe.ai/cookbooks/sde_cascade

## 使いどころ

:::note warn
ここから先は、前半の内容をもとに私が考えたことです。Jev を触った上での話ではありません。
:::

前半の内容から、Jev が向く場面と向かない場面を整理すると次のようになるかと思います。

| 観点    | 向く        | 向かない        |
| ----- | --------- | ----------- |
| 判断の量  | 同じ形の判断が大量 | 一回きりの判断     |
| 質問の形  | 固定        | 毎回変わる形      |
| 説明の形 | 入力と確信度の記録 | 判断ごとの文章 |

気になるのは、返ってくる確信度が「基準が意図どおりに伝わっているか」までは教えてくれないことです。基準の書き方が悪ければ、高い確信度で間違った答えが返ってきますし、それは高い確信度で正しい答えが返ってきたときと見た目が同じです。

そのため、質問ごとに正解付きの評価データを用意して、そのデータで基準の良し悪しとしきい値を確かめる、という整備が必要そうだと考えています。（というかそこをサボるとあんまり旨味がないような気がしています）

また、公式の cookbook はどれも、Jev 単体の精度を上げる話ではなく、しきい値や他のモデルと組み合わせる前提で書かれています。自動で処理した分の正解率を上げたいときも、そのまま同じ質問を繰り返して答えを揃えるより、観点を分けた質問を増やして人に回す条件を作る方向がよさそうです。

1リクエストに観点ごとの質問を並べてしきい値未満だけ人に回す、あるいは前半の cascade のように、Jev の確信度が低いものだけ LLM に調べさせる、という組み合わせになると思っています。

### 根拠が出ないことへの向き合い方

引っかかったのは、Jev が判断の理由を出せない点です。判断を自動化すると、なぜそう判断したのかを後から問われる場面があるので、すべての判断に根拠が要るのではないか、と最初は思いました。

ただ、LLM が書く理由は本当の理由とは限りません。推論モデルが出力する思考の過程は、実際に答えに影響した要因を必ずしも反映していない、という研究が Anthropic から2025年に出ています。

https://www.anthropic.com/research/reasoning-models-dont-say-think

そこで必要となる根拠は、「この入力に、この基準で、この確信度が出て、人が決めたこのしきい値を超えたので実行した」という記録になると思います。そのため、責任の所在はしきい値と基準を決めた人間側になるのかなと思います。

## システム運用への当てはめ

運用の仕事で、同じ形の判断が大量に流れてくるものを考えると、次のような判断が候補になります。

- 障害の一次切り分け
	- アラートの内容から、ネットワーク / アプリ / DB / 外部サービスのどの層の問題かを選び、呼ぶ担当を決める（Choice）
- 誤検知の判定
	- 過去に対応不要で閉じたアラートと同じパターンである確率が高ければ自動で閉じる（Noul）
- ランブックの選択
	- アラートの本文からどの手順書を当てるかを選び、自動修復を起動する条件にする（Choice）
- ベンダー通知の影響判定
	- AWS Health やメンテナンスの通知が、自社の使うサービスやリージョンに関係するかを判定する（Noul）
- 変更申請のリスク評価
	- 申請内容から本番への影響の大きさや戻し手順の有無を点数にして、承認ルートを選ぶ（Score）
- 権限申請の一次審査
	- 申請理由が最小権限の原則に沿っているかを点数にして、低い申請は差し戻す（Score）

どれも、確信度（Noul では真である確率）がしきい値を超えたものは自動で進め、超えなかったものだけ人が見る、という前半の confidence-routing の形で組めそうです。質問の形が固定で、過去の対応記録から正解付きの評価データを作れそうな点も、前の節の条件に合っています。

## おわりに

Jev のドキュメントを運用の目線で読んでみて、判断の理由を出せないことは思ったほど致命的ではなく、代わりに記録としきい値の設計に責任が移る、という整理になりました。

後半は触っていない段階での考えなので、早期アクセスが回ってきたら、色々触ってみたいと思います。

同じような需要のある方の参考になれば幸いです。

ありがとうございました。
