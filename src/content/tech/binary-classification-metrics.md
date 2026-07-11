---
title: "【機械学習】2値分類タスクで用いられる評価指標の整理"
description: "それぞれについて簡単に説明します。TP(True Positive)：モデルが陽性(Positive)と予測して、実際に陽性であった(True)数FP(False Positive…"
pubDate: 2025-01-30
updatedDate: 2025-01-31
tags: ['機械学習', '生成AI']
qiitaId: 552adfd8092e4b0a3a82
importedDate: 2026-07-11
qiitaStats:
  views: 2667
  likes: 0
  stocks: 1
  fetchedAt: 2026-07-11
---

# はじめに
最近RAGに触れる機会がしばしばあり、RAGの評価について色々調べているうちに、「そういえばそもそもの機械学習の評価について一度整理したいな」と思ったのでこの記事を書きました。今回は**2値分類タスク**で用いられる評価指標を整理したいと思います。

# 混同行列(Confusion Matrix)
各指標の説明に入る前に、まず混合行列について説明します。
混同行列とは2値分類タスクにおいて、モデルの予測と実際のクラスをマトリックス(行列)にしたものです。

![image.png](https://images.ryu-ki-learn.com/binary-classification-metrics/b38bda72-16e0-b1cf-1f57-017efe5b3eca.png)

それぞれについて簡単に説明します。
**TP**(**T**rue **P**ositive)：モデルが陽性(Positive)と予測して、実際に陽性であった(True)数
**FP**(**F**alse **P**ositive)：モデルが陽性(Positive)と予測して、実際は陰性であった(False)数
**TN**(**T**rue **N**egative)：モデルが陰性(Negative)と予測して、実際に陰性であった(True)数
**FN**(**F**alse **N**egative)：モデルが陰性(Negative)と予測して、実際は陽性であった(False)数

では、ここで示した値を用いて、評価指標について説明していきます。

# 正解率(Accuracy)
**どの程度正しく分類できたか**を示す指標です。
```math
Accuracy=\frac{TP+TN}{TP+FP+FN+TN}\quad\bigg(=\frac{正解した数}{全体の数}\bigg)
```
もっとも単純でわかりやすいですが、データに偏りがある場合機能しない場合があることに注意が必要です。

例えば、全体の2%が陰性である際に、モデルが(何も判断せずに)全て陽性と予測すると、正解率は98%となります。数字だけ見ると優れているように見えますが、実際はそうとは言えません。
そのため、モデルの評価をする際は以下で説明するような指標を併せて用いることが多いです。

# 適合率(Precision)
**Positiveと予測したものがどの程度実際にPositiveであるか**を示す指標です。
言い換えると、予測がどの程度の**打率**であるかを示しています。
```math
Precision=\frac{TP}{TP+FP}\quad\bigg(=\frac{Positiveの予測が正しかった数}{モデルがPositiveと予測した数}\bigg)
```

# 再現率(Recall)
**実際にPositiveであるものをどの程度Positiveと予測できているかどうか**を示す指標です。
言い換えると、どの程度**取りこぼし**がないかを示しています。
```math
Recall=\frac{TP}{TP+FN}\quad\bigg(=\frac{Positiveの予測が正しかった数}{実際のPositiveの数}\bigg)
```

# 適合率と再現率の関係
ここまで適合率と再現率について説明しましたが、これらは**トレードオフの関係**(両立できない関係)にあります。
どちらを重視するかは状況によって変わります。

例えば、受信したメールがスパムメールであるかを判定する場合、以下のように考えることができます。
- 適合率が低い → スパムではないメールがスパムメールフォルダに仕分けられる
- 再現率が低い → スパムメールがスパムメールフォルダに仕分けられない

この例では、「**スパムではないメールが読まれないこと**」と「**着信メールにスパムメールが含まれること**」を天秤にかけ重視する指標を判断します。(一般的には、前者の方が好ましくないとされる場合が多いので、適合率を重視する場合が多いと思います)
このように、**指標の意味を理解しモデルの評価を行うことが重要**です。

# F値(F1スコア)
**適合率と再現率を組み合わせた指標**です。
前述のように、適合率と再現率はトレードオフの関係にあるため、モデルの性能を判断する際に両方の値を見る必要があります。その際に、F値を用いると1つの評価指標で判断することができるので便利です。
F値は以下のように、**適合率と再現率の調和平均**となっています。
```math
F_1Score=\frac{2 \cdot Precision \cdot Recall}{Precision+Recall}\quad\bigg(=\frac{2TP}{2TP+FP+FN}\bigg)
```

ここで用いられている調和平均について以下で簡単に説明します。

## 調和平均(Harmonic Mean)
一言でいうと、**逆数の平均の逆数**です。
割合の平均を求める際に用いられる平均です。
この調和平均が用いられる例としてよく挙げられるのが以下のような往復移動に関する話題です。

>1kmの道を行きは時速2km,帰りは時速5kmで往復したときの平均の速さは？

即答しなさいと言われるとついつい$\frac{2+5}{2}=3.5$km/hとしてしまいそうになりますが、落ち着いて考えると、行きにかかった時間が$\frac{1}{2}=0.5$時間、帰りにかかった時間が$\frac{1}{5}=0.2$時間なので、往復の平均速度は、$\frac{2}{\frac{1}{2} + \frac{1}{5}}=2.86$km/hとなります。この値が調和平均です。

これ以上の詳細につきましては以下の記事などを参考にしていただければと思います。

https://datascience.nri.com/entry/2022/10/28/165630

https://www.cresco.co.jp/blog/entry/10325.html

https://note.com/cograph_data/n/n023efbf896d5

https://ja.wikipedia.org/wiki/%E8%AA%BF%E5%92%8C%E5%B9%B3%E5%9D%87

## (おまけ)pythonで算出してみた
scikit-learnを用いて、実際のクラスとその予測結果を与えると、このように簡単に求めることができます。
(supportは`y_true`における各クラスの個数を表しています)

```python
from sklearn.metrics import accuracy_score
from sklearn.metrics import precision_score
from sklearn.metrics import recall_score
from sklearn.metrics import f1_score

from sklearn.metrics import confusion_matrix
from sklearn.metrics import classification_report

# 実際のクラス
y_true = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1]
# モデルの予測
y_pred = [0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1]

# 混同行列の生成
cm = confusion_matrix(y_true, y_pred)
print("Confusion matrix")
print(cm)
print("============================================================")

cr = classification_report(y_true, y_pred)
print("Summary")
print(cr)
```

```:result
Confusion matrix
[[7 3]
 [4 6]]
============================================================
Summary
              precision    recall  f1-score   support

           0       0.64      0.70      0.67        10
           1       0.67      0.60      0.63        10

    accuracy                           0.65        20
```

参考

https://note.nkmk.me/python-sklearn-confusion-matrix-score/

## (おまけ)ROC曲線・AUC
ここからは今までの考え方とは少し異なるのでおまけとします。
前述の説明が本記事で行いたかったことなのでこのセクションは読み飛ばしてもらっても構いません。

まず、ROC曲線の説明をする前にモデルがどのように2値分類を行っているのかを簡単に説明します。データをモデルに入力した際、モデルはそのデータが**Positiveである確率**(可能性といった方が正確かもしれません)を出力しています。その出力が、あらかじめ決めていた閾値よりも大きい場合はPositive、小さい場合はNegativeと予測します。

以下の図のようなイメージで、閾値を変えていくとモデルの予測結果が変わります。

![image.png](https://images.ryu-ki-learn.com/binary-classification-metrics/f57db1be-4f33-a04d-c79e-622c7afc1bcd.png)

### ROC曲線
さて、ROC(Receiver Operating Characteristic)曲線とは、前述した、モデルの閾値を変えていきその結果をプロットしたものです。グラフを描画する際には、各軸には以下のような値を取ります。
- 縦軸 → 真陽性率(**TPR**：True Positive Rate)
- 横軸 → 偽陽性率(**FPR**：False Positive Rate)

これらの値について説明します。

### TPRとFPR
TPRとは、**実際にPositiveであるもののうち、Positiveと予測できた割合**のことです。以下のような式で表すことができます。
```math
TPR=\frac{TP}{TP+FN}
```

FPRとは、**実際にNegativeであるもののうち、Negativeと予測できた割合**のことです。以下のような式で表すことができます。
```math
FPR=\frac{FP}{FP+TN}
```

### AUC
AUC(Area Under Curve)とは、ROC曲線下の領域の面積です。
以下の画像のようなイメージです。

![image.png](https://images.ryu-ki-learn.com/binary-classification-metrics/c0cffcba-a424-8e26-8248-c4c98f78142e.png)

(ほぼありえませんが)最もすぐれているモデルでは面積が1になり、最悪なモデル(ランダムに予測していることと同義)では0.5(ROC曲線が原点から(1,1)への直線)となります。

## (おまけ)pythonで描画してみた
先ほどと同様に、scikit-learnを用いて、実際のクラスとモデルが予測した可能性を与えると、このように簡単にグラフを書くことができ、AUCを計算することができました。

```python: roc_auc.py
from sklearn.metrics import roc_curve
import matplotlib.pyplot as plt
from sklearn.metrics import roc_auc_score
import numpy as np

# 実際のクラス
y_true = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
# モデルが予測した"1"である可能性
y_score = [0.2, 0.3, 0.3, 0.2, 0.5, 0.4, 0.4, 0.3, 0.6, 0.4, 0.8, 0.4, 0.5, 0.7, 0.9, 0.8, 0.6, 0.5, 0.7, 0.6]

# ROC曲線を作成するために必要な値
# FPR・TPR・閾値
fpr, tpr, thresholds = roc_curve(y_true, y_score, drop_intermediate=False)

# 得た値をプロット・pngで保存
plt.plot(fpr, tpr, marker='o')
plt.xlabel('FPR: False positive rate')
plt.ylabel('TPR: True positive rate')
plt.grid()
plt.savefig('data/img/sklearn_roc_curve.png')

# AUCを計算
print("AUC: " + str(roc_auc_score(y_true, y_score)))
```

```bash: result
AUC: 0.9249999999999999
```

![sklearn_roc_curve.png](https://images.ryu-ki-learn.com/binary-classification-metrics/c069bf10-f4a5-9e76-5125-e008c5ed2073.png)

参考

https://note.nkmk.me/python-sklearn-roc-curve-auc-score/

# おわりに
今回は2値分類タスクにおける機械学習モデルの評価指標について整理しました。次は、文章生成タスクにおける機械学習モデルの評価指標について整理したいと思います。ありがとうございました。

# 参考にさせていただいたサイト

https://qiita.com/FukuharaYohei/items/be89a99c53586fa4e2e4

https://qiita.com/TsutomuNakamura/items/ef963381e5d2768791d4
