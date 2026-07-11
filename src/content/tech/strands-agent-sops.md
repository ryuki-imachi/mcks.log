---
title: "【Strands Agents】 Agent SOPs を試してみる"
description: "先日、Agent SOPs なるものが発表されました。今回はこちらについて実際に試してみたいと思います。"
pubDate: 2025-12-10
tags: ['AWS', 'SOP', 'StrandsAgents']
qiitaId: a07cf2ffccf8576ee3b6
importedDate: 2026-07-11
qiitaStats:
  views: 2277
  likes: 7
  stocks: 2
  fetchedAt: 2026-07-11
---

## はじめに

先日、Agent SOPs なるものが発表されました。今回はこちらについて実際に試してみたいと思います。

https://aws.amazon.com/jp/blogs/opensource/introducing-strands-agent-sops-natural-language-workflows-for-ai-agents/

https://github.com/strands-agents/agent-sop

## SOPs とは？

あまり聞きなじみのない SOPs についてですが、これは、Standard Operating Procedures の略で、作業手順書のことです。

https://ja.wikipedia.org/wiki/Standard_Operating_Procedure

Agent SOPs は、AIエージェントのために書く Markdown の「作業手順書」といったところになるようです。

## 何が嬉しい？

AIエージェント開発における課題として、制御のトレードオフがあります。動作を LLM に任せると実装は柔軟で楽なものになりますが、実行結果が安定せず、逆に、コードで制御しようとすると再現性が高くなる代わりに、柔軟性が低く管理コストが高まります。

この制御のトレードオフに対して、（LLM に丸投げするでもなく、コードでガチガチに管理するでもない）ちょうどいい感じに扱えるのが Agent SOPs ということのようです。

## どう書くのか？

SOP は Markdown で記述し、さらに RFC 2119（MUST / SHOULD / MAY）に従って制約を明確化します。

RFC 2119 についての詳細は以下リンクをご参照ください。

https://www.rfc-editor.org/rfc/rfc2119

以下の SOP を例に確認してみましょう。

https://github.com/strands-agents/agent-sop/blob/main/agent-sops/code-assist.sop.md

```md
**Constraints:**
...
- You MUST read CODEASSIST.md if found and apply its constraints throughout (see Important Notes)
- You MUST notify the user when the structure has been created
- You MUST handle directory creation errors gracefully and report specific issues to the user
```

見てもらえばわかると思いますが、`MUST` を使って記載することで、すべきことなどを明確化できているようです。（ということは日本語で書くのはあまり意味がない...かも？）

一応以下の通り日本語で書くことはできそうです。どのくらい効果があるのかは時間があるときに試してみたいと思います。

https://www.nic.ad.jp/ja/tech/ipa/RFC2119JA.html

## 実際に試してみる

上記のリポジトリで公開されている、コーディングを行う SOPs（`code-assist.sop.md`）を使ってエージェントを実行してみます。

SOPs を Claude に要約させたところ、以下の手順が書かれていることがわかります。

>### Code Assist SOP 要約
>
>**目的**: TDD（テスト駆動開発）でコードを実装するためのガイド
>
>#### 4ステップのフロー
>
>| ステップ | 内容 |
>|---------|------|
>| **Explore** | 要件を理解し、既存コードのパターンを調査 |
>| **Plan** | テストケースと実装計画を作成 |
>| **Code** | テスト→実装→リファクタリング（TDDサイクル） |
>| **Commit** | 全テスト通過後にコミット |
>
>#### 2つのモード
>- **Interactive**: 都度ユーザーに確認
>- **Auto**: 自動で進め、決定事項を記録
>
>#### 核心ルール
>- **テストを先に書く**（RED→GREEN→REFACTOR）
>- ドキュメントは`.sop/planning/`、コードはリポジトリ本体に分離
>- 既存コードのスタイルに合わせる
>- シンプルに保つ（YAGNI・KISS）

README に記載の通り、システムプロンプトにこの SOP を指定して実行してみます。今回は足し算を行うシンプルなスクリプトを作ってもらいました。

![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/7a182186-dbed-4065-8e81-816b6f4d4a5c.png)

![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/309856e1-eecd-4c4e-86af-ac3c2b14f64a.png)

ログが長いので抜粋していますが、最初に与えた SOP の通りの手順を踏んで作業を行っていることがわかります。

![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/d0b02699-221c-4637-a42d-2341cc56c260.png)


![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/a8fc6342-a9e8-4ef6-8ca7-8f68958b0471.png)


![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/8ae1b28a-e74e-4ade-95ff-53b5a2b468a3.png)


![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/2c527e72-8987-41d0-8d24-4a85c64883ea.png)

![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/1ebfec0d-66b2-49be-a5be-b3fa95272481.png)

また、各種ドキュメントが以下のように生成されていました。

![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/bd92aad2-98f5-4366-8689-798fd1723999.png)

中身はそれぞれこんな感じです。

- `context.md`
![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/0e27e712-038b-4755-b83b-c603263c4a5b.png)

- `plan.md`
![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/0fae77bd-a52d-4ade-b7d4-29c22b50b5b9.png)

- `progress.md`
![image.png](https://images.ryu-ki-learn.com/strands-agent-sops/dd9279af-b66c-4403-8bb7-f24b95429757.png)

以上のように、指示通りの手順でタスクを実行していることがわかりました。

## おわりに

以上、簡単ではありましたが、Agent SOPs を試してみました。これくらいしっかり作り込まれていればうまく制御できそうですね。

今回は事前作成された SOP を利用させていただいた形ですが、カスタムしたものを使う際には、最初から完ぺきなものを作るのではなく、育てていく意識が重要そうです。

これからも触っていくことで理解を深めていきたいと思います。
ありがとうございました。
