---
title: "【Ollama】新しくリリースされた v0.10.0 でGUIを触ってみる"
description: "今までローカルLLMを触る際にはOllamaを使っていたこともあり、本記事では触ってみた様子をご紹介したいと思います。"
pubDate: 2025-08-12
tags: ['Ollama', 'ローカルLLM']
qiitaId: df70af772a9680721669
importedDate: 2026-07-11
qiitaStats:
  views: 1830
  likes: 3
  stocks: 2
  fetchedAt: 2026-07-11
---

## はじめに
2025年7月31日に、Ollama v0.10.0 から対話用GUIが追加されたという情報を見かけました。 

https://x.com/ollama/status/1950670503376761133

https://github.com/ollama/ollama/releases/tag/v0.10.0

今までローカルLLMを触る際にはOllamaを使っていたこともあり、本記事では触ってみた様子をご紹介したいと思います。

なお、Ollamaについては以前に以下記事でも説明しているので、ぜひそちらもご覧ください。

https://qiita.com/ryu-ki/items/8df42e80c48a734c2738

## 早速試してみる
とてもお手軽に始めることができます。以下リンクからインストーラーをダウンロードして実行するだけです。

https://ollama.com/download

アプリを起動すると以下のようなシンプルなチャット画面が表示されました。本記事では、Qwen3とGemma3をそれぞれ試してみたいと思います。

![image.png](https://images.ryu-ki-learn.com/ollama-gui-v0-10/39009b58-7db3-46e0-be0d-0f60d7d991ec.png)

なお、ダウンロードしていないモデルを利用時は、初回実行時にダウンロードが行われます。利用できるモデルは以下リンクを参考にしてください。

https://ollama.com/library

### Qwen3
Qwen3は、AlibabaのLLMです。特徴として、思考モードと非思考モードの2つのモードを使い分けることができます。詳細は以下記事をご覧ください。

https://note.com/npaka/n/n43abd5843fe7

いくつかやり取りをしてみました。数秒の思考を経て回答してくれていることがわかります。

![image.png](https://images.ryu-ki-learn.com/ollama-gui-v0-10/fd5ce5c5-82ef-4825-a762-0f2f44281e31.png)

### Gemma3
Ollamaの記事によると、画像も取り扱えるとのことなので、マルチモーダルに対応しているGoogleのGemma3も使ってみたいと思います。モデルの詳細は以下リンクをご覧ください。

https://ai.google.dev/gemma/docs/core?hl=ja

試しにJAWS-UGのロゴを渡してみました。ロゴの情報については正しい情報を回答することはできていないものの、ロゴの読み込みはできていそうな回答が返ってきていることがわかります。

![image.png](https://images.ryu-ki-learn.com/ollama-gui-v0-10/2e657513-4dea-4a36-8eb8-d390689c7795.png)

:::note
JAWS-UGロゴは以下より利用しております。
https://github.com/jaws-ug/logo
:::

## おわりに
簡単ではありますが、OllamaのGUI操作を試してみました。サクッと使えるので、今まで以上にローカルLLMをお試ししやすくなったのではないかと思いました。興味がある方はぜひ触ってみてはいかかでしょうか。
ありがとうございました。
