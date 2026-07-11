---
title: "【Claude】Claude Design × Canva でデジタル名刺に表示する画像を作る"
description: "突然ですが、NFCペーパーの EZ Sign を半分衝動的に買いました。スマホをかざすだけで画像を書き換えられる代物で、デジタル名刺がわりに利用してみようと思ったためです。"
pubDate: 2026-06-14
tags: ['Canva', '電子ペーパー', 'Claude', 'ClaudeDesign']
qiitaId: 611daea62cab71359bae
importedDate: 2026-07-11
qiitaStats:
  views: 3696
  likes: 5
  stocks: 1
  fetchedAt: 2026-07-11
---


## はじめに

突然ですが、NFCペーパーの EZ Sign を半分衝動的に買いました。スマホをかざすだけで画像を書き換えられる代物で、デジタル名刺がわりに利用してみようと思ったためです。

https://santekdisplay.com/products/ez-sign-nfc-e-paper-display-4-color?variant=47499220222107

ただし、そこに表示する画像のことを何も考えておらず、私はそういうセンスが皆無です。また、EZ Sign は黒・白・赤・黄の4色しか表示できないため、普通の画像をそのまま使わない方が良さそうです。そこで、Claude Design と Canva を組み合わせてデザインを一から作ってもらいました。

ちなみに完成したものはこちらです。

![](https://images.ryu-ki-learn.com/claude-design-canva-digital-namecard/ezsign-result-photo.png)

:::note info
上記のNFCペーパーに実際に書き込む話はまた別の記事で説明したいと思います。
:::

## 前提環境

| 項目 | 内容 |
| --- | --- |
| Claude | Max プラン（Claude Design 利用） |
| Canva | 無料プラン |
| EZ Sign | 4.2インチ 4色モデル（黒・白・赤・黄） |

## Claude Design での作業

### Claude Design とは

Claude Design は Anthropic が提供するデザインツールで、チャットで指示を出しながらデザインを作れます。以前の記事でも紹介しましたが、内部的には Canva の Design Engine を使っており、後から Canva に連携できるのが大きな特徴です。

https://www.anthropic.com/news/claude-design-anthropic-labs

https://qiita.com/ryu-ki/items/bca0ee8f15a13dfd8cfa

### Claude Design に投げたプロンプト

最初に Claude Design に投げたプロンプトがこちらです。アイコン画像も一緒に添付しました。

```
EZ Sign というNFCペーパーに表示させる画像を生成したいと考えています。（4.2インチ 4色モデル）
https://santekdisplay.com/products/ez-sign-nfc-e-paper-display-4-color?variant=47499220222107

イメージは以下の私のプロフィールサイトをベースに考えたいです。（https://ryu-ki-learn.com/）
このサイトへのQRコードと、名前、アイコン、その他情報を載せいたいと考えています。アイコンは添付の画像を用いてください。
なお、４色で表示されるので、それを考慮したカラーリングにする必要があります。
```

Claude Design は製品ページを読みに行って仕様（400×300px、横向き、黒白赤黄の4色）を自動で把握してくれました。そのあと載せたい情報や雰囲気の好みをいくつか質問されたので、それに答える形でデザインの方向性が固まっていきました。

![](https://images.ryu-ki-learn.com/claude-design-canva-digital-namecard/claude-design-questions.png)

### 実機に書き込んで調整

デザインを実機に表示してみると、画面上では良く見えていたものがいくつか問題になりました。

まず文字が潰れていました。NFCペーパーは解像度が低いため、グレーの文字が読みにくくなります。文字色をすべて黒に統一し、サイズも大きくすることで対処しました。

次に QR コードのにじみです。画像化のときにアンチエイリアスがかかり、モジュール境界がぼやけていました。整数ピクセル（5×5px）でくっきり描画するよう修正しています。

最後に端の見切れです。NFCペーパーは端が見切れやすいので、上下左右に余白を追加しました。

こうした調整は Claude Design のチャット上で伝えるだけで対応してもらえます。実機に書き込んで確認してフィードバックを何度か繰り返して仕上げました。

### アイコンの変換

アカウントアイコンの4色変換は特に苦労しました。Claude Design はスクリプトでピクセル単位の塗り直しをしてくれたのですが、目が黒で潰れたり内耳の色ムラが残ったりで、何往復もやり取りが必要でした。

:::note
以下画像は、「指摘したいけどどう指摘すれば伝わりやすい？」と問いかけたところ、それぞれの部位を割り振った画像を出力されたときのものです。とても歩み寄りを感じるのですが、もっといい感じにやってくれないものかと思いながらやりとりしていました。
:::

![](https://images.ryu-ki-learn.com/claude-design-canva-digital-namecard/icon-color-struggle.png)

ここは画像生成・編集に強いモデルに「この画像を黒白赤黄の4色で表現して」と投げた方がきれいに仕上がったかもしれません。ツールの得意・不得意を見極めて使い分けるのが大事だなと感じました。

## Canva での作業

### なぜ Canva に渡すのか

Claude Design で作ったデザインは完成度が高いのですが、肩書きの微修正など日常的な編集のたびに Claude Design を開くのは手間です。Canva に渡しておけば、テキスト部分だけ GUI でサクッと編集して PNG を書き出せます。

https://www.canva.com/

### Canva に送る手順

Claude Design は内部的に Canva の Design Engine を使っているため、Canva への連携が組み込まれています。

まず Claude の設定から Canva Connector を接続します。

![](https://images.ryu-ki-learn.com/claude-design-canva-digital-namecard/canva-connector-setup.png)

接続できたら Claude Design のチャットで「Send to Canva」と伝えるだけです。Canva 上でテキストや画像が個別の要素として開くので、フラットな画像ではなく編集可能な状態で受け取れます。

![](https://images.ryu-ki-learn.com/claude-design-canva-digital-namecard/canva-import-result.png)

### 高解像度で書き出す

EZ Sign の実寸は 400×300px ですが、画像は大きく作って実機側で縮小させた方がきれいです。Claude Design に「比率そのままサイズを3倍にしたい」と伝えたところ、1200×900px に拡大してから Canva に取り込んでくれました。

![](https://images.ryu-ki-learn.com/claude-design-canva-digital-namecard/canva-imported-design.png)

Canva の「共有」→「ダウンロード」→ PNG を選択すれば、1200×900px のくっきりした画像が手に入ります。完成画像は以下の通りです。私としてはいい感じに思っています。

![](https://images.ryu-ki-learn.com/claude-design-canva-digital-namecard/ezsign-umitsu-1200x900.png)

## おわりに

以上、少しぐだぐだになった部分もありましたが、デジタル名刺用の画像を作ることができました。

普段は Claude をメインで使っていますが、もう少し上手くモデルを使い分けられるようにしないとなと気づく機会になってよかったです。

実際にデジタル名刺を書き込むところはまた記事にしたいと思います。

ありがとうございました。
