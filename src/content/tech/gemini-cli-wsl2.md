---
title: "【Gemini CLI】WSL2でGemini CLIを試す（ひと手間あり）"
description: "最近、vibe coding にお熱な私は早速使ってみようと思いました。Windowsでそのまま使うこともできるそうなのですが、私は今回のような遊びの開発はWSLでやっているので、…"
pubDate: 2025-06-26
tags: ['Gemini', 'WSL2', 'AIエージェント']
qiitaId: bb1a0619e05431c05447
importedDate: 2026-07-11
qiitaStats:
  views: 6607
  likes: 5
  stocks: 4
  fetchedAt: 2026-07-11
---

# はじめに
昨晩、Gemini CLIが発表されました。多くの方が説明してくださっていると思うので詳細が省きますが、**Claude CodeのGemini版**と言う理解でよいでしょう。以下に公式リンクを添付します。

https://cloud.google.com/blog/ja/topics/developers-practitioners/introducing-gemini-cli

https://github.com/google-gemini/gemini-cli

最近、vibe coding にお熱な私は早速使ってみようと思いました。Windowsでそのまま使うこともできるそうなのですが、私は今回のような遊びの開発はWSLでやっているので、WSLで使えるようにしたいと思います。

その際、少し引っかかった部分があるのでそのことについても簡単ではありますが備忘として残しておきたいと思います。

# 導入してみる

前述のGitHubリポジトリに記載の通り進めていけば簡単にできると思います。

```
~$ npm install -g @google/gemini-cli
```
```
~$ gemini --version
0.1.4
```

:::note warn
この手のものはすぐバージョンが変わるので注意しましょう。
:::


以下コマンドで起動することができます。
```
gemini
```

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/d78ec074-febf-4dc2-a7b6-bea18c256418.png)

後は、テーマを設定し、認証することで使えるようになります。

# すんなりいかなかったポイント
### 問題
Gemini CLIの認証時、ブラウザがlocalhostにアクセスしようとし、「このサイトにアクセスできません」エラーが発生しました。

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/98509676-1ffa-45a8-8525-27715e737145.png)

### 原因
WSL2は独立した仮想マシンとして動作し、WindowsとWSL2で「localhost」が異なる場所を指すことが原因です。

```
Windows側のlocalhost → 127.0.0.1 (Windows)
WSL2側のlocalhost   → 127.0.0.1 (WSL2内部)
```
※認証サーバーはWSL2側で動いているが、ブラウザはWindows側のlocalhostを見に行ってしまう

### 対処法
ブラウザのアドレスバーのlocalhostを、WSL2のIPアドレスに書き換えます。

#### 1. WSL2のIPアドレスを確認
```
# WSL2内で実行
$ hostname -I
```

:::note
最初に出力される 172.x.x.x がWSL2のIPアドレスです。
:::

#### 2. URLの手動修正
localhost を先ほど取得した値に置き換えます。

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/cff0a53b-c9bd-43e9-9997-697df018fb59.png)

無事認証が完了しました。

:::note warn
本対処法はその場しのぎな対応です。その点ご理解ください。
:::

# 使ってみる

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/05485695-0ab1-4fe2-aedf-92fd59861958.png)

問題なくやり取りできていそうです。

せっかくなので簡単に物を作ってもらいましょう。以下のようなプロンプトを投げてみます。（`\`は改行時に入力したものです。Claude Codeだと見えなくなってくれるのですがこっちでは見えたままですね）

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/08fa34ca-c848-4295-8752-04f1b8064da4.png)

なにやらinfoが出ていますが、とりあえずできたようです。
（infoの内容：応答時間の遅延しているので、このセッションの残りの部分では、より高速な応答のために gemini-2.5-pro から gemini-2.5-flash に自動的に切り替えます とのこと）

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/3a341a0d-21dd-449a-a399-a551e41080cb.png)

実行してみたところ、エラーになりました。GUI環境でないことが問題のようです。

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/2bb749b4-4d97-4259-8572-3ebfadfb7d28.png)

ということでwebアプリにしてもらいました。

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/597e4a46-9050-4932-9fb0-2f4c1f1845be.png)

とりあえず、動くものはできていそうです。（空欄の上から *, -, + が一応入っています）

![image.png](https://images.ryu-ki-learn.com/gemini-cli-wsl2/66dd6c5e-dba9-492f-b52d-128a062013f5.png)

空欄に関しては少しやり取りしたのですが、うまくいかなさそうだったのでいったん切り上げます。

とりあえず、WSLで遊べる状態になったのでOKとします。

# おわりに
ということで、Gemini CLIをWSLで使えるようにしました。簡単に導入でき、かつ無料でかなり使えるので、vibe codingしたことない方はこれを機にぜひ触ってみては？と思います。
ありがとうございました。
