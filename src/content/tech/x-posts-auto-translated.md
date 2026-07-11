---
title: "【X】急にポストが英訳されるようになってしまった"
description: "今日ブラウザから X を利用していると、以下画像のように突然ポストが英語で表示されるようになりました。"
pubDate: 2025-11-22
tags: ['Twitter']
qiitaId: 0936d6126dcd342385c2
importedDate: 2026-07-11
qiitaStats:
  views: 10183
  likes: 2
  stocks: 2
  fetchedAt: 2026-07-11
---

## はじめに

今日ブラウザから X を利用していると、以下画像のように突然ポストが英語で表示されるようになりました。

![image.png](https://images.ryu-ki-learn.com/x-posts-auto-translated/146dd329-39f8-43c4-a2c3-f5fbb3dcd48b.png)

この問題について設定を確認することで解消したので、備忘録として確認したことを残しておきたいと思います。

## 少し調べてみる

少し調べてみると以下の記事にたどりつきました。

https://sbapp.net/appnews/sns/twi/grok-auto-translation-173501

記事によると、2025年7月22日時点で、ポストがGrokによって自動翻訳されるケースはあったようです。


## 自身の設定を確認してみる

勝手に英訳されていたポストをよく見ると、設定画面を見れそうな歯車があったので確認してみました。

![image.png](https://images.ryu-ki-learn.com/x-posts-auto-translated/f0db72b0-ab12-4f72-8349-da66a13d1975.png)

このような設定画面が表示されました。日本語を自動翻訳する設定になっていますね。どうしてこうなっているのでしょう。

language settings も確認してみます。

![image.png](https://images.ryu-ki-learn.com/x-posts-auto-translated/dec0234a-1ae9-409d-840d-c3b2e0ad951a.png)

English と設定されていました。

ということで、なぜかポストを「日本語 → 英語」に自動翻訳する設定になっていたことがわかりました。日本語に変更しておきます。

![image.png](https://images.ryu-ki-learn.com/x-posts-auto-translated/2ff0d38a-48b8-4ee8-b532-d32e595b9a93.png)

![image.png](https://images.ryu-ki-learn.com/x-posts-auto-translated/a8b656e9-abf8-4a41-b124-ed546b3034b4.png)

設定更新後、再度上記のポストを確認してみるとちゃんと日本語で表示されていました。

![image.png](https://images.ryu-ki-learn.com/x-posts-auto-translated/2d564123-bcab-4917-b9fa-6371a515a685.png)


## おわりに

なぜ、言語設定が英語になっていたのか、今のタイミングで自動翻訳されるようになってしまったのか、わからないことはいくつかありますが、ひとまず問題は解決しました。
同じ現象でお困りの方も、言語設定を確認することで解決するかもしれません。

今回の記事はちょっとした内容ですが、参考になれば幸いです。
ありがとうございました。
