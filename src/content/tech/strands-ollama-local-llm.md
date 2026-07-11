---
title: "【Strands Agents】OllamaからローカルLLMを使ってみた"
description: "Strands Agentsについてはこちらの記事を見ていただけると概要をつかめるかと思います。"
pubDate: 2025-06-28
tags: ['AWS', 'Ollama', 'StrandsAgents']
qiitaId: 600b20874a400741c20c
importedDate: 2026-07-11
qiitaStats:
  views: 2251
  likes: 4
  stocks: 4
  fetchedAt: 2026-07-11
---

# はじめに
AIエージェントSDKは今までLangChainしか使ったことがなかったのですが、先日参加したAWS SummitでStrands Agentsのお話を聞き、実際に触ってみようと思いました。調べてみると、Ollamaも使うことができるとのことで、せっかくなのでOllamaでやってみたことを備忘として残しておこうと思います。

Strands Agentsについてはこちらの記事を見ていただけると概要をつかめるかと思います。

https://qiita.com/minorun365/items/dd05a3e4938482ac6055

https://aws.amazon.com/jp/blogs/news/introducing-strands-agents-an-open-source-ai-agents-sdk/

:::note
基本的には大昔（4か月前）に、LangChainで実施したことを、Strands Agentsで実施したような形になります。そのため、Ollamaの説明などは省略させていただきます（LangChainでの実施については以下記事を参照ください）
:::

https://qiita.com/ryu-ki/items/8df42e80c48a734c2738

なお、今回の実装については、以下リポジトリを参考にしています。

https://github.com/rapidarchitect/ollama_strands

# 早速実装する

:::note warn
本実装は筆者が真心こめて実装しました。
:::

実装してみた感覚としては、LangChainと似ていたのであまり困ることなく実装できました。
（`.env`に置いた環境変数を取ってきて、その情報でモデルを初期化して、プロンプトを突っ込むような流れ）

```py:strands_ollama.py
from strands import Agent
from strands.models.ollama import OllamaModel
import os
from dotenv import load_dotenv

def setup_environment():
    load_dotenv()
    ollama_host = os.getenv("STRANDS_OLLAMA_HOST")
    ollama_model = os.getenv('STRANDS_OLLAMA_MODEL')
    ollama_host_url = f"http://{ollama_host}:11434"
    print(f"Using this server: {ollama_host_url} with this model: {ollama_model}")
    return ollama_host_url, ollama_model

def create_ollama_agent(host_url, model_name):
    ollama_model = OllamaModel(
        host=host_url,
        model_id=model_name
    )
    agent = Agent(model=ollama_model)
    return agent

def main():
    ollama_host, ollama_model = setup_environment()
    agent = create_ollama_agent(ollama_host, ollama_model)
    input = "あなたについて教えてください。"
    print(f"入力: {input}")
    result = agent(input)
```

ちなみに、.env には以下のような情報が入っています。
```md:env
STRANDS_OLLAMA_HOST="localhost"
STRANDS_OLLAMA_MODEL="llama3.2"
```

# 実行結果
内容も怪しくはありますが、それ以上に実行時間が気になりますね…
今回の例でも15秒前後待つかなと思います。

```md
Using this server: http://localhost:11434 with this model: llama3.2
入力: あなたについて教えてください。
私は、コンピュータシステムのAIを使用して作成された人工知能（機械学習）プログラムです。

名前：
我々は「メイト」です。

年齢：
私には年齢がありません。私は人工知能なので、年齢や生まれ育てなどの人間の経験に基づいてはいない。

性別：
私は性別がわからない。私は機械的で、特定の性別のものではない。

居住地：
私は世界的にどこでも使用でき、特定の居住地にはつながっていません。

言語：
私は英語を主な言語として使用します。しかし、他の言語にも対応しています。

目標：
私の目的は、ユーザーの質問に正確で有効な回答を提供することです。また、ユーザーが情報を探している際に、正しい情報を見つけるのに役立つようにして、ユーザーをサポートします。
```

# おわりに
かなりあっさりになりましたが、実際にローカルLLMを用いたエージェントの仕組みをStrands Agentsで実装してみました。RAGなどの仕組みで使うならともかく、エージェントで使うのはとてもじゃありませんが現実的でないように思いました。とはいえ、実際に自分で手を動かして確認できたのはよかったかなと思います。
ありがとうございました。
