---
title: "【Claude Code】パワーアップした Claude Code for VS Code を確認してみる"
description: "2025/9/30 未明にClaude関連の情報がいろいろ発表されました。その中でも今回はClaude Code for VS Code（VS Code 拡張機能）がパワーアップし…"
pubDate: 2025-10-01
updatedDate: 2025-10-02
tags: ['生成AI', 'AIエージェント', 'ClaudeCode']
qiitaId: 49023459c67f0348e3ee
importedDate: 2026-07-11
qiitaStats:
  views: 80855
  likes: 57
  stocks: 34
  fetchedAt: 2026-07-11
---

## はじめに

2025/9/30 未明にClaude関連の情報がいろいろ発表されました。その中でも今回はClaude Code for VS Code（VS Code 拡張機能）がパワーアップしたとのことで確認してみようと思います。

https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code

https://www.anthropic.com/news/enabling-claude-code-to-work-more-autonomously

2025/9/30 未明に発表された内容の全貌はこちらのぬこぬこさんの記事をご覧いただければ網羅的に確認できるかと思います。

https://zenn.dev/schroneko/articles/claude-sonnet-4-5

:::note warn
本記事は感想をツイートするには長いと感じたため記事化しております。そのため、感想ベースの内容になりますのでご注意ください。
:::

:::note warn
しばらくバージョンアップしていなかったので、既存の仕様に驚いている可能性があります。ご了承ください。
:::


## 早速触ってみる

拡張機能を更新して早速開いてみます。かわいらしい（？）キャラがいますね。Claw'dという名前だそうです。また、左上の Past Conversations を選択すると過去のやり取りを確認することができるようです。

![image.png](https://images.ryu-ki-learn.com/claude-code-vscode-extension/64999b38-4179-4669-8de1-59421fbf641e.png)

簡単なタスクとしてClaude Codeのバージョンを確認してもらいました。結構いい感じの見た目になっているのではと思います。（語彙）

![image.png](https://images.ryu-ki-learn.com/claude-code-vscode-extension/d32a8f52-dde0-4e92-abdc-1d1552694623.png)

OUT（右側タブ）をクリックすると、標準出力（左側タブ）が確認できるようになっていますね。

![image.png](https://images.ryu-ki-learn.com/claude-code-vscode-extension/97b8c602-fdb4-4f95-85c3-a14e26f6eaf8.png)

また、日本語入力時の変換決定時のEnterでプロンプトが送信されてしまう仕様になっているとのことでしたが、私の環境（PS, WSLともに）では問題なく変換決定ができました。もしかするともう改善されているのかもしれません。あと、Shift+Enterで改行されているのは何気に感動かもしれません。（Windows環境ではできていなかった認識）

@を入力することで参照ファイルを選択できますが、このファイル一覧もなかなかいいなと思います。また、デフォルトで現在エディタで開いているファイルを参照してくれるのも助かりますね。（以前はカレントディレクトリを見ていた認識）

![image.png](https://images.ryu-ki-learn.com/claude-code-vscode-extension/8da0e3b7-6614-4f71-b92e-1214031242bb.png)

ついでに、4.5 Sonnetのお試しとして、この記事の添削を頼んでみました。


![image.png](https://images.ryu-ki-learn.com/claude-code-vscode-extension/62cdb4de-eb74-45fc-a77c-cb30606fadff.png)

なんか手厳しくて泣いちゃった。

## おわりに

割といつものことですが、Claudeに関するいろいろな更新が突然来て嬉しい反面、なかなか全部を確認しきることはできていません。ですが、少しずつキャッチアップしていければと思います。Claude Agent SDKが何やら面白そうなので、次はそちらを確認していければと思います。
ありがとうございました。
