---
title: "【Claude Code】 /insights コマンドがおもしろい"
description: "Claude Code v2.1.30 から、過去の使用履歴や使い方の改善案のレポートを出してくれる /insights コマンドが追加されていたようです。"
pubDate: 2026-02-04
tags: ['ClaudeCode']
qiitaId: 7748d48a725f742428b0
importedDate: 2026-07-11
qiitaStats:
  views: 38689
  likes: 86
  stocks: 44
  fetchedAt: 2026-07-11
---

## はじめに
今朝（2/4 朝）、以下のツイートを見かけました。

https://x.com/oikon48/status/2018808464706060492?s=20

Claude Code v2.1.30 から、過去の使用履歴や使い方の改善案のレポートを出してくれる `/insights` コマンドが追加されていたようです。

私は24時間使いまわすほどのヘビーユーザーではないので、普段使っていない昼休みに試してみようと思い、試してみると意外とおもしろかったので記事にします。（記事は業務終了後に書いています）

## 早速使ってみる

実行してみると、数分ほど経ってレポートが生成されました。パッと見で英語だったので日本語への翻訳もお願いしました。こちらも待つこと数分で翻訳してくれました。

:::note warn
Proプランだと作成でレートリミットの15~20%、日本語に翻訳させるのに10%持っていかれました。途中でリミットが来るとどうなるのかよくわかっていませんが、Proプランの方は注意した方がいいかもしれません。
:::

## レポートを見てみる

生成されたレポートを見てみましょう。

### 概要

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/0e80eae2-36c0-4d93-8079-651ce12c9815.png)

概要には色々書いていますが、スキルを作りましょうとか、Hookを活用しましょうといったアドバイスなどが目につきますね。せっかくなら作ってくれたら嬉しいな（フラグ）。

### 作業内容

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/028bd7c6-4750-40d9-82da-ea86c224c277.png)

自分がセッションでどのようなことをやっていたのか多い順に5つほどピックアップしてくれています。私の場合だと、Markdown などドキュメントをたくさん触らせていたんだなということがわかります。

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/93c0aee8-f1d6-4ad8-acf0-1bf536604584.png)

こちらのように、扱った言語などもカウントしてくれてるみたいですね。（コーディングエージェントなのに1番多いのは Markdown）

### 使い方の傾向

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/39341eb3-acb6-46b4-8624-8dc76469019e.png)

セッション情報から、どんな使い方をしているのかも分析してくれています。まあ、新しくものを作るより、作ったものを改善していく時間の方がそりゃ長いだろという気持ちもありますが...。

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/4b04d216-9245-4379-9600-a4fab00c3528.png)

応答時間の分布を見れるのもおもしろいですね。私は大概画面に齧り付いて触るケースが多いのでレスポンスが速い傾向にありますね。

### 優れた取り組み

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/0c25a631-099e-463c-998a-aa63ffb65292.png)

クロコくんに褒めてもらえます。なんとなく誰でもやっていそうなことが書かれている気がしますが、気にしないことにします。

### 問題が起きるところ

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/3c32a523-6655-41fa-916e-90b923bb5243.png)

褒めてもらえたと思ったら問題になっていそうなことの指摘もありました。確かに、終盤の作業でもうOKみたいな場合に、セッションをぶつ切りにしがちなので、それで怒られている気がします。

### 試すべきClaude Code機能

ここからが本題です。

CLAUDE.md への追加提案や

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/a6ff3ce0-21b3-4180-8e23-2a29dc14b819.png)

カスタムスキル・Hooksの提案をしてくれます。

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/782e1676-aa91-4bec-aed7-55bc7369d31b.png)

私はライトユーザーなので、そこまで手の込んだ提案ではないものの、このような提案をしてくれるのはおもしろいし、便利なんじゃないかなと思います。

### Claude Codeの新しい活用法

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/f0e76b2a-b120-463c-a642-aaf8d0bb137f.png)

先ほどの問題が起きるところで出た問題を軽減するため、もしくは予防するためのClaude Codeへの指示を提案してくれています。この辺りもおもしろいですね。

### 今後の可能性

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/a96e5e13-754f-40da-b7ff-e4961dc5afeb.png)

Claude Code をより上手に使うためのアドバイスをくれます。私は正直あまり参考になっていない部分もありますが、もしかすると嬉しい方もいらっしゃるかもしれません。

### 総括

最後になんかそれっぽいことが書かれていました。

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-command/ad1179e1-bddd-4678-8349-6f95f3fcf7d2.png)

...ちょっと何言ってるかわかんないです。

## おわりに

以上簡単ではありますが、 `/insights` コマンドがおもしろいというお話でした。

多少トークンを食う機能ですが、おもしろかったのでみなさんも試してみてはいかがでしょうか。

ありがとうございました。
