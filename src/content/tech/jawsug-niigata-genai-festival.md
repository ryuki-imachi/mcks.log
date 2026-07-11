---
title: "【勉強会レポート】JAWS-UG新潟 × Python機械学習勉強会in新潟 生成AI祭り に参加しました"
description: "今回は「生成AI祭り」とあって、いろいろな生成AIやAIエージェントの発表を聞くことができ、勉強になったと感じることがいくつもありました。本記事ではその振り返りをしたいと思います。"
pubDate: 2025-08-28
tags: ['AWS', 'イベントレポート', 'JAWS-UG', '生成AI']
qiitaId: d5e38851503a564c795f
importedDate: 2026-07-11
qiitaStats:
  views: 4910
  likes: 4
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに
**JAWS-UG新潟 × Python機械学習勉強会in新潟 生成AI祭り**に参加させていただきました。

https://jawsug-niigata.connpass.com/event/359010/

今回は「生成AI祭り」とあって、いろいろな生成AIやAIエージェントの発表を聞くことができ、勉強になったと感じることがいくつもありました。本記事ではその振り返りをしたいと思います。

JAWS-UG新潟については以下をご覧ください。

https://jawsug-niigata.connpass.com/

:::note warn
本記事では、発表に対する私の解釈・感想を記載しています。間違いなどありましたらご指摘ください。修正などの対応をいたします。
:::

## ゲスト講演
「AWSでAIエージェントに入門！
Bedrock AgentCoreと話題のMCPを使いこなそう」

https://speakerdeck.com/minorun365/awsnozui-xin-sabisudeaiezientogou-zhu-nile-sikuru-men-siyou

まずは、みのるんさんによるゲスト講演が行われました。

そもそもAIエージェントとは何か？AIエージェントはどうやって作る（デプロイする）ことができるのか？というAIエージェントの基本的なお話や、MCP、A2Aに関するお話をされていました。

AIエージェントに触れる第1歩になるお話はとても大切だと思うので、私もこのようなお話ができるようになりたいなと思いました。

また、発表後は質疑応答も行われ、そちらでもいろいろなお話を聞くことができました。

## Strands Agents SDKを使ったAIエージェント構築ハンズオン

https://catalog.us-east-1.prod.workshops.aws/workshops/33f099a6-45a2-47d7-9e3c-a23a6568821e/ja-JP

続いて、支部運営の笠原さん主導で、こちらのStrands Agentsハンズオンを実施しました。

限られた時間ではありましたが、いろいろ試すことができる環境を用意していただき触ってみることができるのはとても良いなと改めて感じました。また、あまり把握していなかった関数などを知る機会にもなり知識が深まったと感じました。

また、記憶が正しければ初めてSageMakerのJupyter Lab使う経験ができたのもよかったです。

## 会場スポンサーセッション
休憩をはさみ、NINNO(新潟県イノベーションスペース)さんによるスポンサーセッションが行われました。BSNアイネットの坂田さんによる取り組みなどのご説明が行われました。

いろいろな活動を通して地方を盛り上げるというのはとてもすごいと感じ、印象的でした。

詳細な内容につきましては以下リンクなどをご参照ください。

https://ninno-plaka.com/

https://newsdig.tbs.co.jp/articles/bsn/2116271

https://www.pref.niigata.lg.jp/site/sangyorodo/kyotei-aws.html

## 機械学習勉強会に参加するためにAIエージェント勉強してみた

https://speakerdeck.com/k_adachi_01/ji-jie-xue-xi-mian-qiang-hui-nican-jia-surutameniaiezientomian-qiang-sitemita

ここから参加者によるLTが行われました。

トップバッターはJapan AWS Jr. ChampionsのAdachiさんでした。

今回の勉強会に参加するにあたって、Strands Agentsを使って実際にエージェントを作り、そこでの学びや気づきを共有してくださいました。印象的だったのは「実装ハードルは低いが、実用への道のりは長い」というお話です。私も現状実感していることでいろいろ悩んでいます。が、裏を返せばチャンスな気もするのでいろいろ頭を使って考えていきたいと思います。

## Strands Agents SDKのAgent Graphへ入門してみよう！

https://speakerdeck.com/har1101/strands-agents-sdknoagent-graphheru-men-sitemiyou

続いて、同じくJapan AWS Jr. ChampionsのFukuchiさんが発表されていました。

Strands Agentsを用いたAgentic Workflowに関するお話をされていました。あまりキャッチアップできていないお話だったのでとても参考になりました。

近々、LangChain（LangGraph）を用いたLLMアプリケーションの開発研修に参加予定なので、そちらでもいろいろ吸収して知識を深めたいと思いました。

## Amazon S3 Vectors とハイブリッド検索を実現してみる

https://speakerdeck.com/ryuki0947/implemented-hybrid-search-using-amazon-s3-vectors

私も登壇させていただきました。最近話題の？S3 Vectorsで、boto3を使って無理やりハイブリッド検索を実現させたお話をさせていただきました。文書検索については学生時代に少しかじっていたこともあり、資料作成時に1人で盛り上がってしまった感があり反省しています...

とはいえ、情報整理していて楽しかったのでこのあたりの仕組みについてはどこかでお話しできたらいいなぁと思いました。

:::note
テーマにマッチしている勉強会などありましたら教えていただけると幸いです！
:::

## QuickSightによる治安分析と予測

https://www.docswell.com/s/4997286788/Z2QE4E-2025-08-23-154019

続いてニシさんよりQuickSightに関するLTが行われました。

私はQuickSightを使う機会がなかったので勉強になりました。また、実際に動いているところをデモで見せていただけたのでおもしろかったです。（内容としても綺麗にオチていておもしろかったです）

自分も簡単な分析をする際に試してみようと思います。

## Amazon Q Developer実践レポート 〜 GameDayで見えた生成AIの可能性

GameDayでAmazon Q Developerを使われた経験やその際に感じたことなどを共有いただきました。

私も1度だけ社内のGameDayに参加したことがありましたが、その時点ではまだ日本語対応しておらずまともに使わなかったので興味深く聞かせていただきました。

「やらなくていいことを明確に伝える」という話が印象的で、Amazon Q Developerに限らず、今の生成AIは（ありがた迷惑に思えるほど）いろいろやってしまう印象があります。そのあたりの手綱を上手に握ることはしばらくの間は大事なのかなと思いました。

## おわりに
今回の勉強会は生成AIテーマだったこともあり、いろいろな角度からのお話を聞くことができたのでとても楽しかったです。懇親会などでもいろいろお話させていただきモチベーションが上がりました。これからも生成AIをはじめ、いろいろなものに興味を持って取り組んでいきたいと思います。
ありがとうございました。
