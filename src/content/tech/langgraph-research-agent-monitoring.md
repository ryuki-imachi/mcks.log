---
title: "【AIエージェント】簡単な情報収集エージェントを構築・監視してみた"
description: "今回はローカルLLMを用いて、エージェントを構築し、構築したエージェントを監視するところまで実施したので、自身のやったことを整理するために本記事を書きました。"
pubDate: 2025-02-15
tags: ['生成AI', 'LangChain', 'LangGraph']
qiitaId: 887c2678abc2587de68b
importedDate: 2026-07-11
qiitaStats:
  views: 2872
  likes: 4
  stocks: 3
  fetchedAt: 2026-07-11
---

# はじめに
前回記事でOllamaを使ってローカルLLMを呼び出すことまで実施しました。

https://qiita.com/ryu-ki/items/8df42e80c48a734c2738

今回はローカルLLMを用いて、エージェントを構築し、構築したエージェントを監視するところまで実施したので、自身のやったことを整理するために本記事を書きました。

# LangGraphとは
LangChainをベースにしたライブラリで、LLMのワークフローを構築するために使われます。
特に、グラフ構造を活用して、複雑な対話フローやデータフローを柔軟に設計できることが特徴です。

以下の画像のようなイメージです。
（https://blog.langchain.dev/langgraph-multi-agent-workflows/ より引用）

![langgraph_multi_agent_diagram.png](https://images.ryu-ki-learn.com/langgraph-research-agent-monitoring/9e760ce7-eb41-4fea-95ed-0c1642c9ed69.png)

https://blog.langchain.dev/langgraph/

# 構築したエージェント
下図が今回構築したものをグラフ化したものになります。
（Langfuseにより出力・Langfuseについては後述）

![rearch_agent_graph.png](https://images.ryu-ki-learn.com/langgraph-research-agent-monitoring/5600269e-8765-4da7-90be-34c1d13884fd.png)

簡単に流れを説明すると、以下の3ステップからなります。
1. __collect_basic__：基本情報の収集・要約
1. __collect_trends__：最新のトレンドの収集・分析・要約
1. __summarize__：上記2つの情報の要約

:::note
長くなってしまうので、ここではエージェントの詳細な実装については省略します。
:::

# Langfuseとは
一言でいうと、LLMアプリのためのOSS監視ツールです。

https://langfuse.com/

公式ドキュメント（Why Langfuse?）では以下のように紹介されていました。

https://langfuse.com/docs

- 最も利用されているオープンソースのLLMOpsプラットフォーム
- モデルやフレームワークにとらわれない
- 本番環境向けの構築
- 徐々に導入可能、1つの機能から始めて、時間をかけてプラットフォーム全体に拡張
- APIファースト、カスタム統合のためにAPI経由ですべての機能が利用可能
- オプションで、Langfuseは簡単にセルフホスト可能

# 監視してみる
## Langfuseの準備
いくつかの方法があるそうですが、一番簡単そうなローカルで準備したいと思います。
以下ページを参考に準備します。

https://langfuse.com/self-hosting/local

```bash:リポジトリのクローンと移動
git clone https://github.com/langfuse/langfuse.git
cd langfuse
```

```bash:Langfuseの立ち上げ
docker compose up
```

これで、`http://localhost:3000`へアクセスすると利用することができます。
また、`settings/api-keys`からAPIキーを取得することができます。

## コードの修正
以下ページを参考に、作成したコードを修正しました。

https://qiita.com/moritalous/items/76ba9f2ad200df335d07

https://langfuse.com/docs/integrations/langchain/example-python-langgraph#use-langfuse-with-langgraph-server

- コンストラクタへの追加内容（APIキーは `.env` にて管理）
```py
from langfuse.callback import CallbackHandler

self.langfuse_handler = CallbackHandler(
    secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
    public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
    host=os.environ.get("LANGFUSE_HOST"),
)
```

- ワークフロー構築の際に変更する内容
```py
# 変更前
workflow.compile()

# 変更後
workflow.compile().with_config({"callbacks": [self.langfuse_handler]})
```


## 監視できているか確認
コードの修正後、再度エージェントを使ってみると、以下のようにtracesが生成されており、構造的にそれぞれの要素の入出力や、所要時間などを確認することができました。
（また、ベータ機能として前述のようにエージェントのグラフを表示することもできていました）

![image.png](https://images.ryu-ki-learn.com/langgraph-research-agent-monitoring/61da0e50-3ec9-4d84-a5ac-ba4d997f581e.png)

![image.png](https://images.ryu-ki-learn.com/langgraph-research-agent-monitoring/2e067e03-fe53-410e-9717-d37211fe0ade.png)

![image.png](https://images.ryu-ki-learn.com/langgraph-research-agent-monitoring/e4d07511-07e4-41da-b507-045bb9618625.png)


# おわりに
思った以上に簡単にLangfuseを構築できたので驚きました。（実質`CallbackHandler`の設定と、`.with_config({"callbacks": [self.langfuse_handler]})`を追加しただけ）
これでデータの流れなどが分かりやすくなったので、プロンプトの調整や受け渡すデータの形式の見直しなどの作業がはかどるように思います。
また、評価がまだあまりできていないのでそちら方面（RAGASなど）の深堀りもしていきたいと思います。
ありがとうございました。

# 参考サイト

https://qiita.com/minorun365/items/70ad2f5a0afaac6e5cb9
