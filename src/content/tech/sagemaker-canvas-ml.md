---
title: "【SageMaker】Amazon SageMaker Canvas でスマートに機械学習してみる"
description: "↑のページなどを見ると、ざっと以下のような特徴があるそうです。- コード不要：ドラッグ&ドロップのインターフェースで直感的に操作可能- 幅広いユースケース：分類、回帰、時系列予測、…"
pubDate: 2025-03-08
tags: ['AWS', '機械学習', 'SageMaker']
qiitaId: 8f5c09ac03d276be58df
importedDate: 2026-07-11
qiitaStats:
  views: 1902
  likes: 1
  stocks: 1
  fetchedAt: 2026-07-11
---

# はじめに
先日、AWS Certified AI Practitionerの試験に合格したのですが、そこで問われていたAmazon SageMakerについて結局よくわからないままでした。そこで色々調べてみると、どうやらお手軽に試せるサービスがあるそうだということでAmazon SageMaker Canvasを触ってみた内容をアウトプットします。

# Amazon SageMaker Canvasとは
ノーコードで機械学習モデルを構築・使用できるビジュアルインターフェースを提供するAWSのサービスです。

https://aws.amazon.com/jp/sagemaker-ai/canvas/

↑のページなどを見ると、ざっと以下のような特徴があるそうです。
- コード不要：ドラッグ&ドロップのインターフェースで直感的に操作可能
- 幅広いユースケース：分類、回帰、時系列予測、画像分類などに対応
- 簡単なデータ接続：S3、Redshift、Snowflakeなど様々なデータソースに接続可能
- 自動ML：モデル構築を自動化し、最適なアルゴリズムとハイパーパラメータを選択
- 柔軟なビルドオプション：Quick BuildとStandard Buildで用途に応じた構築が可能
- バッチ予測とリアルタイム予測：大量データの一括処理と個別予測の両方に対応
- データサイエンティストとの連携：専門家向けのSageMaker Studioとの統合が可能

ということで、マウスをポチポチすれば機械学習ができるようなので早速試していきたいと思います。

# 実際に触ってみる
### 0. SageMaker ドメインの設定
ドメインの作成画面に移ると下図のような画面が表示されます。
今回はサクッとお試しのつもりなので、クイックセットアップを選択します。
![スクリーンショット 2025-03-07 191627.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/e564cc59-bd28-468b-8582-2f73b1d85d38.png)

5分程度待っていると、ドメインを作成できました。
![スクリーンショット 2025-03-07 183845.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/32b310f9-0c8e-4b64-a05e-8617aa7259ac.png)

ちなみに、ドメインとはSageMakerを利用するうえで必要なリソース群のことのようです。

ドメインの詳細はこちらのドキュメントをご覧ください。

https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/gs-studio-onboard.html

起動すると別タブで画像ような画面が表示されます。（なんだかシュッとしている...）
![スクリーンショット 2025-03-07 192325.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/ddf5954f-4c17-4dbd-876c-89985a9889d8.png)

### 1. データセットのインポート
では、データセットをインポートします。
今回使うデータセットは機械学習を学ぶ上で最も有名といっても過言ではない（？）iris（アヤメ）データセットを利用します。このデータセットには、3種類のアヤメの花の測定値（花弁の長さなど）が含まれています。
詳しくはこちらのドキュメントをご覧ください。

https://scikit-learn.org/stable/auto_examples/decomposition/plot_pca_iris.html

以下の簡単なスクリプトでcsvファイルとして手元に置いておきます。（詳細な説明は割愛します）
```py:get_iris_dataset.py
import pandas as pd
from sklearn.datasets import load_iris

# irisデータセットを読み込む
iris = load_iris()

# データフレームに変換
# 特徴量の名前を列名として使用
iris_df = pd.DataFrame(data=iris.data, columns=iris.feature_names)

# ターゲット（アヤメの種類）も追加
iris_df['target'] = iris.target

# CSVファイルとして保存
iris_df.to_csv('iris_dataset.csv', index=False)
```

この取得した`iris_dataset.csv`を`import data`からインポートします。
ちなみに、カラム名に記号があるとダメみたいなのでリネームしました。（Canvas上でいじれるの地味に便利ですね）
![スクリーンショット 2025-03-07 184211.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/ee1cb1d2-bc9d-4ebb-9e2c-0583279b5e51.png)

カラム名を変更して無事インポートできました。
下図からもわかるように、実はCanvas側でサンプルデータも用意されています。特にこだわりがなければこちらを利用するのもありかもしれませんね。
![スクリーンショット 2025-03-07 184348.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/6159e8fa-55b7-4088-a305-ebc44a9203de.png)


### 2. 取り込んだデータの確認
左側メニューの`My Models`から`New model`を選択し、先ほどインポートしたデータを選ぶと下図のような画面になり、予測したいカラムを選択します。
すると、黄色で線を引いた部分で、自動的にモデルの種類を選択してくれており、今回は「3つ以上のカテゴリーに分類する」モデルを提案してくれています。
![image.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/50ee0ccb-a07b-4a08-bd63-3f904f830225.png)

下図のように各カラムのヒストグラムなども確認することができます。
また、`Preview model`を選択すると、右側にモデルプレビュー結果が表示されます。
これにより、推定精度や各カラムの予測に対する影響もある程度事前に把握することができます。
今回の例では、`petal length`が大きく影響し、`sepal`に関する2つのカラムはあまり影響がないことが予想できます。
![スクリーンショット 2025-03-07 185348.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/fc59b46a-2c3b-407d-9442-7f7a50e74e61.png)

モデルプレビューについての詳細はこちらをご覧ください。

https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/canvas-preview-model.html

さらに、今回あまり使いこなせてる感はありませんが、`Data visualizer`を選択すると、下図のようにデータを散布図や棒グラフ、箱ひげ図で可視化することもできます。左側のColumnsのカラム名を、右側のグラフの縦軸横軸にドラック&ドロップすることでグラフを作ってくれます。（縦軸横軸をプルダウンすることでも選択できます。）
![スクリーンショット 2025-03-07 184755.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/af04d936-6265-48ac-85d6-21fdf1e4a926.png)


### 3. モデルの学習
モデルの学習には以下の2種類の方法があります。
- Quick Build：短時間でモデルを構築できる高速な学習方法（数分程度）
- Standard Build：データセット全体を使用した完全な学習方法（数時間～程度）

https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/canvas-build-model.html

今回はお試しなのでQuick Buildを選択します。

では、モデルの学習を行っていきましょう。
Quick Buildを選択すると、250行以上のデータがないと精度が上がらないよと言われますが、今回はあくまでもお試しなので無視して続行します。
![スクリーンショット 2025-03-07 185720.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/9452d25e-7b1f-4a56-8854-76d841724269.png)

モデルの学習が完了すると以下のような情報を見ることができます。
（モデルの学習には5～10分程度かかりました）
Overviewをみると、今回の例では精度は96.667%となっており、`petal length`の影響が大きいことが分かります。
![image.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/dc2025e0-1322-4143-895e-d5f88cd7d4d0.png)

Scoringでは、30件のデータをピックアップして、モデルの予測結果と実際の相違が示されています。この図からもほぼ正しく予測することができていることがわかります。
![スクリーンショット 2025-03-07 190307.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/6270b448-94b4-49f2-bc92-aebc8939aa4d.png)

ちなみに、この図はSankey Diagram（サンキーダイアグラム）といいます。
工程間での流量を可視化する際に用いられます。

詳細はこちらをご覧ください。

https://developers.google.com/chart/interactive/docs/gallery/sankey?hl=ja

Advanced metricsのMetrics tableでは分類タスクにおける各指標を確認することができます。
![スクリーンショット 2025-03-07 190323.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/0b6eb94f-aa86-4605-b004-8d197c3dad65.png)

Confusion matrixでは混同行列を確認することができます。
![スクリーンショット 2025-03-07 190436.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/cd8f99d5-6ada-4b51-b5f4-70b51585771e.png)

ここで確認できる指標については以前記事を書いたのでこちらをご覧ください。

https://qiita.com/ryu-ki/items/552adfd8092e4b0a3a82

### 4. 学習済みデータを使って予測
実際にモデルで予測を行ってみます。
予測方法には以下の2種類があります。
- バッチ予測（Batch Prediction）：大量のデータを一度に予測する方法

https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/canvas-make-predictions-batch.html

- シングル予測（Single Prediction）：個々のデータポイントに対してリアルタイムで予測を行う方法

https://docs.aws.amazon.com/ja_jp/sagemaker/latest/dg/canvas-make-predictions-single.html

今回はお試しなのでシングル予測をしていきます。
Single Predictionを選択すると、既に0と予測されるデータが初期値として入力されています。
![スクリーンショット 2025-03-07 190906.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/dbe0e90b-9693-4c50-891f-20303883ef0c.png)

`petal length`が予測に与える影響が大きいとのことなので、まずはこの値を動かしてみると10cm程度変わると予測結果が変わることがわかります。
![スクリーンショット 2025-03-07 190949.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/02a22c4f-fcef-4aaf-a2d1-a6e86d24af5b.png)

一方で、予測結果にほとんど寄与しない`sepal width`の値を動かしてみましょう。下図のようにこれだけ値を変えても予測結果に影響を与えないことがわかります。
![スクリーンショット 2025-03-07 190703.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/43113702-6db4-46ca-9312-d82240afd3ae.png)

作成したモデルをデプロイすることもできるそうですが、今回は実施しないので以上でAmazon SageMaker Canvasでできることは一通り触れました。

### 5. Canvasの終了（ログアウト）
作業が終わったら忘れずログアウトするようにしましょう。
![image.png](https://images.ryu-ki-learn.com/sagemaker-canvas-ml/fb8907e4-e392-48a9-a67a-78f56b19ceb5.png)

SageMakerの意図しない課金が発生するケースの原因が「Canvasからログアウトしていないこと」だったという記事をいくつか見かけました。

https://qiita.com/jp7eph/items/5d4b10fcdd56371b0e0f

https://50sak.com/sagemaker-cost/


# おわりに
今回は、試験勉強で見かけたけど実は知らないサービスを実際に触ってみようというところで、Amazon SageMaker Canvasを触ってみました。触ってみた感覚として以下のようなことを感じました。

- メリット
    - とにかく楽である
        - 事前にデータを用意しておくだけ
    - 特に、データの可視化を簡単にかつ分かりやすくしてくれるのがとてもよかった
- デメリット
    - 機械学習のことをわかっていないと数字の意味がわかるのかという懸念がある
        - ある程度知っていることで真価を発揮しそうな雰囲気を感じる

個人的には簡単に一通りのことができるので結構感動しました。
学生時代は機械学習をちょこちょこしていましたが、社会人になってからは出来上がっているモデルをうまく使うことに重きを置くことが増えてきたので、使う場面があるかはちょっとわかりませんが、こういうサービスがあるんだということを知れたので良かったです。
またモチベーションがあれば、今度はstudioの方も使ってみたいと思います。
ありがとうございました。

# 参考サイト

https://www.lac.co.jp/lacwatch/people/20241011_004159.html

https://www.ctc-g.co.jp/solutions/cloud/column/article/29.html
