---
title: "コサイン類似度について改めて整理する"
description: "生成AI（LLM）を用いたアプリケーション開発において、RAG（Retrieval-Augmented Generation）は今や欠かせない技術となっています。ChatGPTやC…"
pubDate: 2025-09-13
updatedDate: 2025-09-17
tags: ['Python', 'コサイン類似度', 'RAG']
qiitaId: d83545d022e1a273ae5d
importedDate: 2026-07-11
qiitaStats:
  views: 54445
  likes: 65
  stocks: 30
  fetchedAt: 2026-07-11
---

## はじめに

生成AI（LLM）を用いたアプリケーション開発において、RAG（Retrieval-Augmented Generation）は今や欠かせない技術となっています。ChatGPTやClaudeなどのLLMに独自のデータを組み込む際、多くの開発者がRAGを選択肢として検討するのではないでしょうか。

そんなRAGを支える中核技術の1つがベクトル類似度検索です。しかし、「コサイン類似度とは何か」といった部分が曖昧で、わかっている気はするけどちゃんと人に説明できないなと思うことがしばしばあります。  

本記事では、テキストをベクトル化して比較する仕組みと、代表的な指標であるコサイン類似度について改めて整理してみたいと思います。
## RAGの簡単なおさらい

### 解決したい課題

生成AIを利用するうえで、組織特有の情報や知識を反映できず正しく回答を得ることができないという課題に遭遇することがあります。このような課題に対して、外部データベースから関連情報を検索し、LLMのプロンプトに含めることで解決しようとするのがRAGです。

### ベクトル検索の必要性

RAGにおいて、「いかに質問に関連する情報を的確に取得できるか」ということが重要になります。従来のキーワード検索では、意味的な関連を理解することができないことが課題でした。その課題を解決するために、テキストの意味をベクトルとして表現し、その類似度を計算するアプローチが採用されています。

## コサイン類似度とは

コサイン類似度は、2つのベクトルの「角度の近さ」を測る方法です。

-1から1の値をとり、以下のように言えます。
- 1（2つのベクトルのなす角が0度）に近い：ベクトルが同じ向き（似ている）
- 0（2つのベクトルのなす角が90度）に近い：ベクトルが直交（無関係）
- -1（2つのベクトルのなす角が180度）に近い：ベクトルが逆向き（正反対）

### 数学的な定義
2つのベクトル $\boldsymbol a$ と $\boldsymbol b$ のコサイン類似度は、以下の式で計算されます。

$$\cos(\boldsymbol a,\boldsymbol b) = \frac{\boldsymbol{a} \cdot \boldsymbol{b}}{|\boldsymbol{a}| |\boldsymbol{b}|} = \frac{\sum_{i=1}^{n} a_i b_i}{\sqrt{\sum_{i=1}^{n} a_i^2} \sqrt{\sum_{i=1}^{n} b_i^2}}$$

- $\boldsymbol a \cdot \boldsymbol b$：ベクトルの内積
- $|\boldsymbol a|, |\boldsymbol b|$：ベクトルの大きさ（ノルム）


### 直感的な理解
以下の3つのベクトルの類似度を確認してみます。

![cosine_similarity_plot.png](https://images.ryu-ki-learn.com/cosine-similarity-explained/b167f002-30ae-42ee-976b-88c1f86b8312.png)

以下が計算するために書いたコードです。

:::note warn
手計算していますが、sklearnを利用すれば`cosine_similarity()`という関数がすでに用意されています。
:::

```python
import numpy as np
import matplotlib.pyplot as plt

# 2次元での可視化
def visualize_cosine_similarity():
    # サンプルベクトル
    vec1 = np.array([3, 4])
    vec2 = np.array([4, 3])
    vec3 = np.array([-3, 4])
    
    vectors = {'vec1': vec1, 'vec2': vec2, 'vec3': vec3}
    
    # コサイン類似度の計算
    def cosine_sim(a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    # # sklearnを使った実装例（コメントアウト）
    # from sklearn.metrics.pairwise import cosine_similarity
    # def cosine_sim_sklearn(a, b):
    #     return cosine_similarity([a], [b])[0][0]
    
    # プロット
    fig, ax = plt.subplots(figsize=(8, 8))
    colors = ['red', 'blue', 'green']
    
    for (name, vec), color in zip(vectors.items(), colors):
        ax.arrow(0, 0, vec[0], vec[1], head_width=0.2, 
                head_length=0.2, fc=color, ec=color, label=name)
        # 座標を表示
        ax.text(vec[0] + 0.2, vec[1] + 0.2, f'{name}({vec[0]}, {vec[1]})', 
                color=color, fontsize=10, fontweight='bold')
    
    # vec1との類似度を表示
    for name, vec in vectors.items():
        if name != 'vec1':
            sim = cosine_sim(vec1, vec)
            # sim_sklearn = cosine_sim_sklearn(vec1, vec)  # sklearn版
            angle = np.arccos(np.clip(sim, -1, 1)) * 180 / np.pi
            print(f"vec1と{name}の類似度: {sim:.3f} (角度: {angle:.1f}°)")
            # print(f"vec1と{name}の類似度 (sklearn): {sim_sklearn:.3f}")  # sklearn版の結果
    
    ax.set_xlim([-5, 5])
    ax.set_ylim([0, 5])
    ax.set_xticks(range(-5, 6))
    ax.set_yticks(range(0, 6))
    ax.grid(True, alpha=0.3)
    ax.legend()
    ax.set_aspect('equal')
    plt.title('Cosine Similarity Between Vectors')
    plt.savefig('cosine_similarity_plot.png', dpi=300, bbox_inches='tight')
    print("グラフをcosine_similarity_plot.pngに保存しました")

visualize_cosine_similarity()
```

```
# 実行結果
vec1とvec2の類似度: 0.960 (角度: 16.3°)
vec1とvec3の類似度: 0.280 (角度: 73.7°)
```


## 注意点（次元の呪い）
次元が大きくなってくると、コサイン類似度が0付近に集中してしまう傾向になる「次元の呪い」という問題に直面する場合があります。高次元空間ではベクトルが取れる方向が膨大に存在するため、互いに似た方向を向く確率が極めて低くなり、ほとんどのベクトルが「直交に近い関係」になることが原因です。
そのため、PCAやt-SNEなどの手法で次元を削減したり、特徴選択によって不要な情報を除外したりするなどの対策が必要となります。

## おまけ

今回お話ししたようなことを活用して、Amazon S3 Vectorsを利用してハイブリッド検索（ベクトルベースの手法とキーワードベースの手法を組み合わせた方法）を実現してみましたので、興味があればぜひご覧ください。

https://speakerdeck.com/ryuki0947/implemented-hybrid-search-using-amazon-s3-vectors

## おわりに

簡単ではありましたが、ベクトル化したテキストを比較するために用いるコサイン類似度について整理してみました。他にも理解があいまいなことがあれば随時整理していきたいと思います。
ありがとうございました。
