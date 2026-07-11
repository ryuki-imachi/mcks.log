---
title: "【Graviton】AWS Gravitonってなに？"
description: "こちらでは、以下のようなメリットがあると説明されています。- コストパフォーマンス- CO2排出量- 広範なソフトウェアサポート- マネージドAWSサービスとして利用可能"
pubDate: 2025-03-15
updatedDate: 2025-03-16
tags: ['AWS', 'CPU', 'Graviton']
qiitaId: 1cdc206953cc7c192bbb
importedDate: 2026-07-11
qiitaStats:
  views: 3933
  likes: 1
  stocks: 1
  fetchedAt: 2026-07-11
---

# はじめに
先日、AWSのFrugality（倹約性）がテーマの社内勉強会に参加した際、さらっと触れられていましたが全然知らないものがあったので、そのことについて整理・アウトプットしたいと思います。
間違いなどがありましたら、ご指摘いただけると幸いです。

# Gravitonとは
一言でいうと、**AWSが独自開発したCPU**です。

https://aws.amazon.com/jp/ec2/graviton/

こちらでは、以下のようなメリットがあると説明されています。
- コストパフォーマンス
- CO2排出量
- 広範なソフトウェアサポート
- マネージドAWSサービスとして利用可能

まとめると、従来のインスタンスにくらべて、同程度の性能であれば、20%程度費用が抑えられ、EC2だけでなく、Aurora、RDS、EKSなどで利用することができる。といったところでしょうか。

# 従来のものとなにが違うのか
一言でいうと、**従来のものはx86**、**GravitonベースのものはARMベース**で作られています。
これらはアーキテクチャ思想が異なります。

### CPUのアーキテクチャ思想
#### CISC (Complex Instruction Set Computer)
複雑で多機能な命令をハードウェア側でサポートする思想です。
**1つの命令で複雑な処理を実行**できることが特徴です。
(歴史的な背景として、メモリなどが高価だったため、できるだけ少ない命令で多くの処理をすることが求められていたそうです)

通常のEC2インスタンスは、x86ベースとなっており、こちらに当てはまります。

#### RISC (Reduced Instruction Set Computer)
命令をシンプルにして、1命令あたりの実行時間を速くする思想です。
**省電力で処理を行うことができる**ので、主にスマートフォンやタブレットなどで用いられています。
例として、Apple ARM64(M1, M2チップ)などが挙げられます。

GravitonのEC2インスタンスは、ARMベースとなっており、こちらに当てはまります。

# Gravitonベースのインスタンスの例
以下サイトでは、どのようなGravitonベースのインスタンスを利用できるのかについて説明されています。
`g`が含まれているインスタンスがGravitonベースのインスタンスとなっているようです。
またGravitonの世代は2023年末発表されたGraviton4が最新です。

https://aws.amazon.com/jp/ec2/graviton/

|用途|Gravitonベースのインスタンスファミリー|
|:----|:----|
|一般用途向け|M8g(AWS Graviton4) <br> T4g(AWS Graviton2)|
|コンピューティング最適化|C8g(AWS Graviton4) <br> C7g・C7gd・C7gn(AWS Graviton3, 3E)|
|メモリ最適化|R8g・X8g(AWS Graviton4)|
|ストレージ最適化|I8g(AWS Graviton4) <br> Is4gen(AWS Graviton2)|
|高速コンピューティング|G5g(AWS Graviton2)|

# おわりに
今回はコスト削減に有効なGravitonについて調べ、その内容を整理してみました。
いつのまにかCPUのアーキテクチャ思想の話になっていましたが、なんとなくコストを抑えられる理由はわかった気がします。
いままでGravitonのことを全く知らなかったので、これからはコスト削減をしたい際に意識することができるのではないかなと思います。
ありがとうございました。


# 参考にさせていただいたサイト

https://github.com/aws/aws-graviton-getting-started

https://nakaterux.hatenablog.com/entry/2024/12/29/162112

https://itall.hatenablog.com/entry/2024/09/15/RISC%E3%81%A8CISC%E3%82%92%E5%88%86%E3%81%8B%E3%82%8A%E3%82%84%E3%81%99%E3%81%8F%E5%AD%A6%E3%81%BC%E3%81%86

https://captain-cocco.com/cpu-evolution-and-history/

https://ja.wikipedia.org/wiki/CISC

https://ja.wikipedia.org/wiki/RISC
