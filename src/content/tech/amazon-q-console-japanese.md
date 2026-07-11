---
title: "【Amazon Q】マネコンから\"日本語で\"リソース状況を調査してもらう"
description: "本記事では、マネコンから日本語で Amazon Q を使い、実際にAWSリソースの状況を調査した様子をご紹介します。"
pubDate: 2025-08-04
tags: ['AWS', 'AmazonQ']
qiitaId: baaeac7fe1150ba26179
importedDate: 2026-07-11
qiitaStats:
  views: 4094
  likes: 9
  stocks: 3
  fetchedAt: 2026-07-11
---

## はじめに
2025年7月31日、AWS マネジメントコンソール（以下マネコン）の Amazon Q が日本語対応しました。（従来は英語のみ対応）

https://aws.amazon.com/jp/about-aws/whats-new/2025/07/q-developer-multi-language-support/

本記事では、マネコンから**日本語で** Amazon Q を使い、実際にAWSリソースの状況を調査した様子をご紹介します。

## 調査内容

お試しとして、2025年7月のAmazon Bedrockのモデル利用状況を確認してみます。以下の画像のように、2025年7月は Claude 3.7 Sonnet に$10.39かかっていました。

![image.png](https://images.ryu-ki-learn.com/amazon-q-console-japanese/e34b8b9f-c365-44ec-8d8f-59010728ff87.png)

これをAmazon Qに調査・確認してもらおうと思います。

## 早速試してみる

以下の画像のように、「7月のAmazon Bedrockのモデル利用状況について教えて。」と指示しました。すると調査を始めてくれていることがわかります。（メッセージ送信時に、回答言語の確認とセキュリティ条件の確認を行っていることは少し印象的です）

![image.png](https://images.ryu-ki-learn.com/amazon-q-console-japanese/b1247453-222f-437a-a352-b744a162a877.png)

回答を確認すると、2024年7月の情報を参照してしまっています。そこで、明確に期間を指定して再度問い合わせてみます。

![image.png](https://images.ryu-ki-learn.com/amazon-q-console-japanese/1a893214-5ff8-4f0d-b4f5-53ef9009c685.png)

明確に期間を指定したうえで調査をしてもらうと、無事想定していた結果が返ってきました。

![image.png](https://images.ryu-ki-learn.com/amazon-q-console-japanese/73153111-34ef-4b65-814d-cfa0fa21f03e.png)

```md
# 2025年7月 Amazon Bedrock 利用状況レポート

## 概要
- **総コスト**: $10.67
- **利用期間**: 2025年7月
- **主要リージョン**: US West 2 (USW2)

## モデル別利用状況

### 1. Claude 3.7 Sonnet (Amazon Bedrock Edition)
- **コスト**: $10.39 (全体の97.4%)
- **主要な利用モデル**として最も多く使用

### 2. Claude 3.5 Sonnet v2 (Amazon Bedrock Edition)
- **コスト**: $0.19 (全体の1.8%)
- **補助的な利用**

### 3. Claude 3 Haiku (Amazon Bedrock Edition)
- **コスト**: $0.00
- **利用はあったが課金対象外の範囲内**

### 4. Amazon Nova Lite
- **入力トークン**: $0.09 (全体の0.8%)
- **出力トークン**: $0.00
- **軽量タスクでの利用**

## 利用パターン分析

**主要な特徴:**
- Claude 3.7 Sonnetが利用の大部分を占める
- 複数のClaudeモデルを使い分けている
- Nova Liteも併用し、コスト効率を意識した利用

**推奨事項:**
1. **コスト最適化**: タスクの複雑さに応じてモデルを使い分けることで、既に効率的な利用ができています
2. **利用監視**: 月額$10程度の利用であれば適切な範囲内です
3. **継続監視**: 今後の利用増加に備えて、定期的なコスト確認をお勧めします

---
*このレポートは2025年7月の実際の利用データに基づいて作成されました。*
```

### Markdown形式での出力について
レポートについてMarkdownファイルで出力をお願いすると、Markdown形式のテキストを出力してくれました。上記のレポートはこちらをコピー&ペーストしたものになります。

![image.png](https://images.ryu-ki-learn.com/amazon-q-console-japanese/ca50a7fd-5800-472a-ad88-b9e560162273.png)


## おわりに
簡単ではありますが、実際にマネコンから Amazon Q を使ってリソース状況を調査してもらうことができました。

また、AIエージェントを利用する場面ではしばしばいわれることですが、曖昧な指示は避けるべきであることも再確認できました。（今回だと調査期間を2025年7月と指示すべき）

今まで以上に簡単に調査することができるようになっているので、上手に活用していければと思います。
ありがとうございました。
