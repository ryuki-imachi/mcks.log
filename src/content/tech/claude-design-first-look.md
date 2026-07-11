---
title: "【Claude Design】見せてもらおうか Claude Designの性能とやらを"
description: "2026/4/17 に Anthropic から Claude Design がリリースされました。"
pubDate: 2026-04-20
updatedDate: 2026-04-22
tags: ['Claude']
qiitaId: bca0ee8f15a13dfd8cfa
importedDate: 2026-07-11
qiitaStats:
  views: 66840
  likes: 48
  stocks: 27
  fetchedAt: 2026-07-11
---

## はじめに

2026/4/17 に Anthropic から Claude Design がリリースされました。

https://www.anthropic.com/news/claude-design-anthropic-labs

Claude と会話しながらデザインやプロトタイプ、スライド、1枚ものの資料などを作れるサービスだそうです。現在は Claude Opus 4.7 を基盤にした research preview として、Claude Pro / Max / Team / Enterprise 向けに提供されています。

とりあえず触ってみたので備忘的に整理しておきたいと思います。

## とりあえずドキュメントを眺める

上記のページと以下の記事を読んで、一旦分かったことを整理しておきます。

https://support.claude.com/ja/articles/14604416-claude-design%E3%82%92%E5%A7%8B%E3%82%81%E3%82%8B

### 何ができるのか

公式の例を見ると、主に次のような用途を想定しているようです。

* インタラクティブなプロトタイプ作成
* 画面ワイヤーフレームやモックアップ作成
* デザイン案の比較検討
* プレゼン資料やピッチデッキ作成
* ランディングページやマーケ素材作成
* 音声・動画・3D・AI を含むコード駆動プロトタイプ作成

Figma 的な「見た目を作るツール」に、生成 AI ベースの対話操作とコードやブランド情報の理解が乗ったもの、というイメージですかね。

### どうやって使うのか

ヘルプ記事にある基本フローはかなりシンプルです。

1. 新しいプロジェクトを作る
2. スクリーンショットや画像、コードベースなどのコンテキストを追加する
3. 作りたいものを文章で説明する
4. Claude がキャンバスに生成したものを確認する
5. チャットやインラインコメントで修正する
6. 仕上がったら共有・エクスポートする

ここで重要なのは、最初の1発で完成を狙う道具ではなく、反復前提の道具だという点です。ヘルプ記事でも「最初の生成は出発点で、本当の価値は反復にある」と説明されています。

要するに、「一発で完璧なものを作ろうとするな」ということですね。

### Claude Code との関係

ここが個人的に一番おもしろいポイントだと思っています。Claude Design は「見た目を作って終わり」ではなく、Claude Code への橋渡しまで考えられています。

デザインができたら、設計情報一式をまとめたパッケージ（handoff bundle）として Claude Code に渡せるという仕組みで、エクスポート先としてローカルのコーディングエージェントや Claude Code Web への引き継ぎが示されています。

つまり、

* Claude Design：デザイン・プロトタイプを作る
* Claude Code：実装する

という分担で、デザインから実装まで一貫した流れで進められるイメージですね。

## 実際に触ってみる

ページを開くと以下のような画面が表示されます。今回は Claude Design について解説するスライド作成を試してみたいと思います。

![スクリーンショット 2026-04-19 17.11.49.png](https://images.ryu-ki-learn.com/claude-design-first-look/32ae2085-6e92-46f2-8707-1d8e70490574.png)

プロンプトを渡すと、スライド作成のための質問がいくつか提示されます。この辺りはもっと事前に準備をしておくとスキップされたり、聞かれる内容が変わったりすると思われます。今回は雑にお願いしたので、発表時間やスライド枚数などを聞かれました。

![スクリーンショット 2026-04-19 17.12.31.png](https://images.ryu-ki-learn.com/claude-design-first-look/a6c42621-54fd-4f02-86ba-450ed935360d.png)

今回はとりあえず以下のように回答しました。

![スクリーンショット 2026-04-19 17.16.18.png](https://images.ryu-ki-learn.com/claude-design-first-look/28b36d01-a315-4a38-bfe5-e31afb105fd3.png)

しばらく待つとスライドが生成されました。事前にスライドテンプレートの参考をSpeakerDeck のリンクで渡していたのですが、うまく受け取ってくれていないようです。

![スクリーンショット 2026-04-19 17.34.27.png](https://images.ryu-ki-learn.com/claude-design-first-look/6ac13a8a-d28e-496f-a7b0-678f529d8941.png)

スライド画像を渡してあげるとそれなりのテンプレートで作成し直してくれました。

![image.png](https://images.ryu-ki-learn.com/claude-design-first-look/39e6b786-738b-48f6-8c38-d90c1b616bd2.png)

右上のEditを選択すると、スライドの調整を行うことができます。ただ、ドラッグ操作などはできなさそうでした。

![image.png](https://images.ryu-ki-learn.com/claude-design-first-look/96972a23-25f6-440b-9357-06afb0ec558f.png)

ちなみに、Design Filesというタブを選択すると今回作成したプロジェクトで生成されたファイルを確認することができます。この感じだとスライドはhtmlで作られていそうですね。

![image.png](https://images.ryu-ki-learn.com/claude-design-first-look/a1c238f6-d06e-4a11-b529-6072551ecc9e.png)

また、前述の通りいくつかの形式でエクスポートすることができます。今回はpptx形式で出力してみました。やはり多少崩れている部分がありますね。（今回だと右下のページ数のデザインがうまくできていない）

![image.png](https://images.ryu-ki-learn.com/claude-design-first-look/ba75e26e-7268-4811-a3f2-903368745238.png)

Claude Design は週次で利用量が定められており、今回の作業だけで1週間分を使い切ってしまったので、検証はここで泣く泣くおわりです。

![image.png](https://images.ryu-ki-learn.com/claude-design-first-look/20166c2a-59a2-47f0-be77-13fc934a17df.png)

## おわりに

以上、簡単ではありますが Claude Design を触ってみました。今回はスライド作成で試してみましたが、UIを作ってもらってそのまま Claude Code で実装するという流れを試した方が感動が大きかったかもしれません。

また制限が解除されたら色々試してみたいと思います。

ありがとうございました。
