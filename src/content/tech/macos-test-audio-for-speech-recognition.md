---
title: "【macOS】音声認識アプリのためのテスト音声を用意する"
description: "最近ちょっとした Web アプリを作っており、その動作確認のために、5分前後の日本語音声ファイルを用意した際の作業について備忘録的な記事を書きました。"
pubDate: 2026-03-16
tags: ['macOS', '音声合成']
qiitaId: 23933f5dae6059e0032a
importedDate: 2026-07-11
qiitaStats:
  views: 666
  likes: 1
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

最近ちょっとした Web アプリを作っており、その動作確認のために、5分前後の日本語音声ファイルを用意した際の作業について備忘録的な記事を書きました。

## 動作環境

- macOS Sequoia 15.x（`say` コマンドが標準搭載）
- ffmpeg 7.x（`brew install ffmpeg` などでインストール）
- ターミナル（zsh）

## 今回やりたいこと

ひとまず、開発中のアプリの音声認識パイプライン（入力 → 前処理 → 音声認識）が壊れず動くかを確認したいと考えていました。そのため、日本語で、ある程度つながりのある5分程度の音声を1本だけ用意できれば十分です。

## 簡単な事前調査

最初は公開データセットの利用を検討しました。条件としては、日本語で、5分前後のある程度つながりがある音声で、まずは疎通確認なので準備コストが低いことを重視していました。

候補として見たのは次のあたりです。

### JVS / JSUT

JVS は日本語の音声合成研究でよく使われるマルチ話者コーパスで、同一文を複数話者が読む「平行発話」があるため話者差を比較しやすい構成です。JSUT は日本語の音声合成（TTS：テキストを音声にする技術）向けによく参照される単一話者コーパスで、読み上げ文が整理されており、素直な読み上げ音声を扱いやすい印象です。

日本語で扱いやすい定番コーパスですが、1発話が短めです。そのため、5分の連続音声を作るには、連結作業が必要になります。また、利用条件は事前に確認しておく必要があります。

https://sites.google.com/site/shinnosuketakamichi/research-topics/jvs_corpus

https://sites.google.com/site/shinnosuketakamichi/publication/jsut

### CSJ

CSJ は日本語の自発音声（講演・学会発表など）を中心にしたコーパスで、読み上げより自然な話し方が含まれるため、実運用に近い音声で試しやすいデータです。

講演系の自然発話が多く、要件にはかなり合います。一方で、「ラフにすぐ使う」観点では導入の手軽さはやや低めです。こちらも利用申請や利用条件の確認が必要です。

https://clrd.ninjal.ac.jp/csj/

### ReazonSpeech

ReazonSpeech は日本語の音声認識（ASR：音声を文字にする技術）向けの大規模コーパスで、`tiny / small` など段階的なサイズが用意されているので、まず小さく試してから拡張しやすい構成になっています。

https://github.com/reazon-research/ReazonSpeech

### Common Voice（日本語）

Common Voice は Mozilla 主導の多言語・コミュニティ収録コーパスで、日本語分も公開されています。1クリップごとの短い音声が中心なので、検証用に少量だけ試す用途に向いています。

手軽に試しやすいですが、短い発話が中心のため、5分連続は結合前提です。

https://commonvoice.mozilla.org/ja/datasets

結局、今回は最短で1本作ることを優先し、macOS の `say` と `ffmpeg` で自作音声を作る方針にしました。

## 使用ツール

### say

macOS に標準搭載されているテキスト読み上げコマンドです。テキストファイルを入力として音声ファイル（AIFF）を生成できます。

https://manp.gs/mac/1/say

### ffmpeg

音声や動画の変換・加工ができる CLI ツールです。今回は以下の処理で使います。

- AIFF から WAV への形式変換
- 44.1kHz から 16kHz へのサンプリング周波数変換
- stereo からモノラルへのチャンネル変換
- PCM 16bit への統一
- `ffprobe` によるメタ情報確認

https://ffmpeg.org/

## 手順

### 1. テキストファイルを作る（heredoc）

heredoc（ヒアドキュメント）は、シェルで複数行のテキストをまとめて扱う記法です。

```bash
cat > script.txt <<'EOF'
ここに読み上げたい日本語原稿を貼る
EOF
```

`EOF` は単独行で書き、前後に文字や空白を置かないようにします。`<<'EOF'` のようにシングルクォート付きで開始すると変数展開を防げます。`heredoc>` が表示されたら、終端の `EOF` を入力して閉じます。

### 2. ファイルの内容を確認する

```bash
ls -lh script.txt        # ファイルサイズを確認
wc -l script.txt         # 行数を確認
head -n 3 script.txt     # 先頭3行を確認
tail -n 3 script.txt     # 末尾3行を確認
```

ここではファイルサイズと行数を確認し、先頭と末尾に意図した文が入っているかを見ます。

### 3. say コマンドで音声を生成する

環境によって使える音声が異なるので、先に一覧を確認しておくと安全です。

```bash
say -v '?'

# 日本語の音声だけを確認する場合
say -v '?' | grep ja_JP
```

`?` はシェルで特殊文字として解釈される可能性があるため、シングルクォートで囲んでいます。

```bash
say -v Kyoko -f script.txt -o raw.aiff
```

### 4. WAV 形式に変換する

先ほど生成された音声ファイルを WAV に変換します。

```bash
ffmpeg -y -i raw.aiff -ar 16000 -ac 1 -c:a pcm_s16le test_5min.wav
```

`-i raw.aiff` は入力ファイルです。`-ar 16000` はサンプリング周波数を 16kHz に変換します。`-ac 1` はモノラル（1ch）に変換します。`-c:a pcm_s16le` は16bit PCM の WAV 形式で保存します。

https://ffmpeg.org/ffmpeg.html#Main-options  

https://ffmpeg.org/ffmpeg.html#Audio-Options

### 5. 生成結果を確認する

生成された WAV ファイルを `ffprobe` で確認します。

```bash
ffprobe -v error \
  -show_entries stream=sample_rate,channels \
  -show_entries format=duration \
  -of default=nw=1 test_5min.wav
```

`sample_rate=16000` と `channels=1` になっていれば、今回の前処理条件は満たせています。

実際のファイルも確認してみます。

![image.png](https://images.ryu-ki-learn.com/macos-test-audio-for-speech-recognition/76a4cfc8-8d63-4d88-9192-ba3e9deea3f4.png)

ちゃんと音声ファイルが作成できていました。一方で確認したところ全然5分ではありませんでした。原因はテキスト量の不足で、`say` の読み上げ速度に対して原稿が短すぎたためです。5分の音声を作りたい場合はもう少し長いテキストを用意するとよさそうです。今回は動作確認に困らないかと思うのでよしとしています。

## まとめ

疎通確認の目的であれば、まずは自作の読み上げ音声を1本用意するだけでもよさそうかなと感じました。

本当はフィラーなどもあるとよいのですが、理想的なデータではないものの、比較的手軽にできたのでよかったかなと思います。

同じような需要のある方の参考になれば幸いです。

ありがとうございました。
