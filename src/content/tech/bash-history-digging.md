---
title: "【Bash】古に叩いたコマンドを掘り返す"
description: "ちょっと前に実行したコマンドを再度実行するときにもたもたしていたら、先輩に便利な機能を教えていただきました。"
pubDate: 2025-11-06
updatedDate: 2025-11-10
tags: ['Bash']
qiitaId: 8afa1bf19fedaf092031
importedDate: 2026-07-11
qiitaStats:
  views: 1284
  likes: 3
  stocks: 2
  fetchedAt: 2026-07-11
---

## はじめに

ちょっと前に実行したコマンドを再度実行するときにもたもたしていたら、先輩に便利な機能を教えていただきました。

恥ずかしながら今まで知らず感動したので、本記事では改めて使い方などを整理したいと思います。

## Ctrl + R (reverse-i-search)

### 基本的な使い方

`Ctrl + R` で以下のような表示になり使用可能になります。

```bash
(reverse-i-search)`': 
```

この状態で検索キーワードを入力すると、過去のコマンド履歴から一致するものが表示されます。

```bash
# 例: "docker" と入力
(reverse-i-search)`docker': docker ps -a
```

### 操作方法一覧

| キー                 | 動作                       |
| ------------------ | ------------------------ |
| `Ctrl + R`         | さらに古い履歴を検索（繰り返し押すと過去に遡る） |
| `Ctrl + S`         | 新しい履歴に移動（forward-i-search） |
| `Enter`            | コマンドを実行                  |
| `Esc`              | 検索をキャンセル                 |

### 実践例

```bash
# "git commit" を含むコマンドを探す
$ # Ctrl + R を押す
(reverse-i-search)`git': git commit -m "hoge"

# さらに古い git コマンドを探す場合は、再度 Ctrl + R
(reverse-i-search)`git': git push origin feature/new-feature
```

### Ctrl + S が効かない場合

`Ctrl + S` が効かない場合が多いかと思います。これは、通常、`Ctrl + S` は端末ロック（stop）に割り当てられていることが原因です。

以下コマンドで現在の割り当て設定を確認することができます。

```bash
$ stty -a
speed 38400 baud; rows 31; columns 219; line = 0;
intr = ^C; quit = ^\; erase = ^?; kill = ^U; eof = ^D; eol = <undef>; eol2 = <undef>; swtch = <undef>; start = ^Q; stop = ^S; susp = ^Z; rprnt = ^R; werase = ^W; lnext = ^V; discard = ^O; min = 1; time = 0;
-parenb -parodd -cmspar cs8 -hupcl -cstopb cread -clocal -crtscts
-ignbrk -brkint -ignpar -parmrk -inpck -istrip -inlcr -igncr icrnl ixon -ixoff -iuclc -ixany -imaxbel -iutf8
opost -olcuc -ocrnl onlcr -onocr -onlret -ofill -ofdel nl0 cr0 tab0 bs0 vt0 ff0
isig icanon iexten echo echoe echok -echonl -noflsh -xcase -tostop -echoprt echoctl echoke -flusho -extproc
```

こちらの `stop = ^S;` の部分ですね。

`~/.bashrc` に以下を追加することで割り当てを変えることができます。

```bash
stty stop undef
```

こちらを追加後再度割り当て設定を確認してみると、割り当ての設定が変更されていることが確認できました。( `stop = <undef>;` の部分ですね)

```bash
$ stty -a
speed 38400 baud; rows 31; columns 219; line = 0;
intr = ^C; quit = ^\; erase = ^?; kill = ^U; eof = ^D; eol = <undef>; eol2 = <undef>; swtch = <undef>; start = ^Q; stop = <undef>; susp = ^Z; rprnt = ^R; werase = ^W; lnext = ^V; discard = ^O; min = 1; time = 0;
-parenb -parodd -cmspar cs8 -hupcl -cstopb cread -clocal -crtscts
-ignbrk -brkint -ignpar -parmrk -inpck -istrip -inlcr -igncr icrnl ixon -ixoff -iuclc -ixany -imaxbel -iutf8
opost -olcuc -ocrnl onlcr -onocr -onlret -ofill -ofdel nl0 cr0 tab0 bs0 vt0 ff0
isig icanon iexten echo echoe echok -echonl -noflsh -xcase -tostop -echoprt echoctl echoke -flusho -extproc
```

これで、`Ctrl + S` も問題なく利用することができているかと思います。

### 検索範囲について

`Ctrl + R` で検索される履歴は、以下の2つから構成されます。

- 現在のセッションの履歴：今実行しているシェルで実行したコマンド
- `~/.bash_history` に保存された履歴：過去のセッションで実行され、ファイルに保存されたコマンド

別のターミナルを閉じたときに保存されたコマンドや、以前ログインしていたときのコマンドも検索対象となります。

なお、履歴のサイズは環境変数で設定されており、以下のコマンドで確認できます。

```bash
# メモリ上に保持される履歴の行数
$ echo $HISTSIZE
1000

# ファイルに保存される履歴の行数
$ echo $HISTFILESIZE
2000
```

これらの値を超えると、古い履歴から削除されていきます。

## おわりに

以上、簡単ではありましたが整理しました。とても便利なのでこれからも活用していきたいと思います。また、今回の機能以外にもまだ見ぬ機能がたくさんあると思うので、いろいろ使いこなせるようになれればと思います。
ありがとうございました。


## 参考サイト

https://www.gnu.org/savannah-checkouts/gnu/bash/manual/bash.html

https://tech.softel.co.jp/blog/archives/5616

https://www.gnu.org/software/bash/manual/html_node/Bash-History-Facilities.html
