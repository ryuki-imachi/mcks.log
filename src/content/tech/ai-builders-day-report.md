---
title: "【イベントレポート】AI Builders Day の熱にあてられました"
description: "12/20(土) に開催された AI Builders Day に参加しました。"
pubDate: 2025-12-21
tags: ['AWS', 'イベントレポート', 'AIエージェント']
qiitaId: 124b3b15348acd7cd2f1
importedDate: 2026-07-11
qiitaStats:
  views: 5258
  likes: 15
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

12/20(土) に開催された AI Builders Day に参加しました。

https://jawsug.connpass.com/event/371658/

どのセッションも興味深い内容でとても勉強になりました。参加したセッションの感想を共有したいと思います。

:::note
印象に残ったスライドと感想を書いています。
:::

## 【キーノート1】まだ間に合う！Agentic AI on AWSの現在地をやさしく一挙おさらい

https://speakerdeck.com/minorun365/madajian-nihe-u-agentic-ai-on-awsnoxian-zai-di-woyasasiku-ju-osarai

ChatGPT の発表や Amazon Bedrock の GA から、AgentCore までのお話を分かりやすく振り返えられていました。

![IMG_3529.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/00a2cff3-d35c-4b2a-b909-e0a7c7edbb6f.jpeg)

"構築" 元年が終わる頃にはどうなっているのでしょうか。想像がつかなくてワクワクします。


## 【キーノート2】 The Future of AI: Building Intelligent Systems That Think and Act

AWSから、Shakeel Ahmad さんがいらっしゃり貴重なお話を聞かせていただきました。

![IMG_3530.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/9e6e18e5-edde-415a-8709-26532f2c8a64.jpeg)

生成AIモデルを選択する際の考慮事項について、速さ・正確さ・コストの3つのポイントを挙げられていて、それを可視化されていました。この3項目がポイントになるのははある程度理解していたつもりですが、図で表現しているのはあまり見かけた記憶がなく、印象に残りました。

![IMG_3534.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/b8322f60-d86a-4fb7-9ec5-533f834e043b.jpeg)

AIエージェントの基盤についてちゃんと明確な意識を持てていなかったので参考になりました。やはりポイントはデータ部分かと思います。組織によっては「データはあるが活用できるような形ではない」といったケースも多いのではないでしょうか。「どのような形式」のデータが適切で、そのデータ形式で管理していくには「どのような仕組み」が必要なのか考えることが重要と感じました。

![IMG_3540.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/0f516e2d-fced-49e0-8d67-c040cb1614bd.jpeg)

最後にこのようなことをおっしゃっていました。LLM、コーディングエージェントの進歩により、構築する作業自体はどんどん簡単になってきており、手を動かしやすい環境になっています。そのような環境で作って壊してを繰り返して勘所をつかんでいけるようになれると良いのではと感じます。


## Bedrock AgentCore Memoryの新機能(Episode)を試してみた

re:Invent 2025 で新しく登場した長期記憶の方法についてお話しされていました。

エージェントに日報形式でメモリを蓄積して活用するユースケースが考えられるんですね。

![IMG_3544.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/b4f61fbe-fca5-48c8-bdcf-cf447befb675.jpeg)

issueとして保管していて読み込むのとどっちが有効なんだろうというのが気になりました。
(エージェントの方がお手軽そうではある気もします)


## AIエージェント時代のワークフロー設計：Durable Function・Step Functions・Strands(割り込み処理)の使い分けを考える

https://speakerdeck.com/yakumo/strands-agents-wotian-ete

タイトルにある3つの手法の比較についてお話しされていました。

![IMG_3547.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/540f12f8-39ac-49bd-9d3f-010c91ec60c8.jpeg)

ワークフローで何をしたいかを意識することが重要だと感じました。


## AgentCore で Bedrock KB を噛ませるなら？ Strands retrieve tool vs Bedrock KB MCP Server

Strands retrieve tool と Bedrock KB MCP Server の比較についてお話しされていました。MCPサーバーの方をほぼ使ったことがなかったので勉強になりました。

![IMG_3553.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/c0c724a2-e6ae-4b9b-ad6a-9670b92290c3.jpeg)

KB のリストの取得・最適な KB を選んで検索 の2ステップを必ず行うような実装になっていたんですね。

![IMG_3557.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/f81b1260-c946-4c4c-a042-3f89cf8fc36a.jpeg)


発表の通り、基本的には retrieve tool を使う方がよさそうです。MCPサーバーの中身をちゃんと見るようにしないとなと改めて感じました。


## Amazon Bedrock Knowledge Bases × メタデータ活用で実現する検証可能なRAG設計

https://speakerdeck.com/tomoaki25/amazon-bedrock-knowledge-bases-x-metadetahuo-yong-deshi-xian-surujian-zheng-ke-neng-na-rag-she-ji

retrieval コマンドのレスポンスにメタデータが含まれることを活用して、メタデータにURL情報を与えることで説明可能性を高めることに取り組んだお話をされていました。

![IMG_3558.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/df1c27ad-e052-4602-914e-a55ae5c7383e.jpeg)

いろいろな方が利用するチャットボットなどだと、ユーザーが回答を疑うことが難しいというのは確かにありそうですね。


![IMG_3560.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/b6234e5a-7d54-4e38-8555-52fa62155f32.jpeg)

メタデータの設定がこんなにシンプルとは知りませんでした。自分も上手く活用したい！


## 全てAWSで完結！AWS AmplifyとViteで始めるスモールスタートなAIエージェント開発のススメ

AWS Amplify 用いたAIアプリのフロントエンド部分の構成例についてお話しされていました。

![IMG_3575.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/d4e1f4f0-6765-4365-81d7-fa974856476f.jpeg)

TSから逃げているために、CDKはほぼ触ったことがなく、Hono もよく聞くが勉強したことがなかったので冬休みの宿題にしようかと思います。

また、Ask the speaker でもお話しいただきありがとうございました。自分が「AIエージェント」を作るのか、「AIアプリ」を作るのかを明確にすべきというお話は今後ちゃんと意識したいと思います。


## フレームワークを活用したAIエージェントの評価 ～AIエージェントを育てるために～

AIエージェントの評価方法とその実装方法やその結果について紹介されてました。

![IMG_3577.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/e1011643-dbf8-441a-8c0b-725a453539f0.jpeg)

エージェントの評価方法で、ツールの軌跡についてまで検討できていないので勉強になります。

![IMG_3587.jpeg](https://images.ryu-ki-learn.com/ai-builders-day-report/78639109-acb3-463c-8664-6353364e8101.jpeg)

また、MCPについての書籍を出されるそうです！


## 誰でも簡単に生成AI Agent管理入門！AWS Generative AI Solution Box で試せる Langfuse導入

ワンクリックでセルフホストできるものがあるのは知りませんでした。すごいですね。

https://aws-samples.github.io/sample-one-click-generative-ai-solutions/

活用できそうな場面があればうまく活用したいなと感じました。

## おわりに

かなり感想の粒度にバラツキがありすみません…

AIエージェント開発に興味がある・取り組んでいる方々が同じ空間に何百人もいるというのはとても熱を感じました。

これからも試行錯誤を繰り返し、AIエージェントを活用して自分の生活や業務を「イイ感じ」にしたいと思います。
ありがとうございました。
