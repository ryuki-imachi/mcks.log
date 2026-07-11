---
title: "【ローカルLLM】Ollamaを使ってローカルでLLMを触ってみる"
description: "これをもちいることで、クラウドに依存せず、ローカルで直接LLMを利用できるようになります。"
pubDate: 2025-02-09
tags: ['生成AI', 'Ollama']
qiitaId: 8df42e80c48a734c2738
importedDate: 2026-07-11
qiitaStats:
  views: 4321
  likes: 2
  stocks: 5
  fetchedAt: 2026-07-11
---

# はじめに
最近LangChainを使ってAmazon BedrockなどからLLMを呼び出して活用することに興味関心があるのですが、なんとなく料金のことが気になってしまうことがあり、OSSなLLMを使ってみたいと思っていました。
調べてみると、OllamaというOSSがあり、どうやらそれを用いると簡単にローカルでLLMを扱うことができそうなので実際に試してみました。備忘もかねてやったことをアウトプットしたいと思います。

# Ollamaとは
Ollamaは、LLMを簡単にローカル環境で実行できるようにしてくれるOSSです。

https://ollama.com/

これをもちいることで、クラウドに依存せず、ローカルで直接LLMを利用できるようになります。

# 環境
- PCスペック
    - OS：Windows 11 Home
    - CPU：AMD Ryzen 5 4500 6-Core Processor 3.60 GHz
    - GPU：NVIDIA GeForce RTX 4060 Ti
    - メモリ：16GB
- 使用ツール
    - WSL2(Ubuntu 24.04.1 LTS)
    - Docker(Docker Desktop)
    - Ollama

# Ollamaの導入
:::note info
今回はOllamaに着目したいので、Dockerまでの環境構築については省略します。
私は以下を参考にさせていただきました。
:::

https://zenn.dev/misora/articles/1037a94c53a5f0

---

さて、今回は以下を参考に、Dockerhubで共有されているイメージを利用しました。

https://hub.docker.com/r/ollama/ollama

こちらのコマンドでコンテナを起動することができます。

```shell
docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

きちんと起動できていることが確認できます。
```shell
$ docker ps
CONTAINER ID   IMAGE           COMMAND               CREATED      STATUS         PORTS                      NAMES
eefa6bdf1bdd   ollama/ollama   "/bin/ollama serve"   5 days ago   Up 2 minutes   0.0.0.0:11434->11434/tcp   ollama
```

# Ollamaコマンドの確認
こちらのコマンドで中に入って操作してみましょう。

```shell
docker exec -it ollama bin/bash
```

まずは、ヘルプコマンドで機能を確認してみましょう。
```shell
/# ollama help
Large language model runner

Usage:
  ollama [flags]
  ollama [command]

Available Commands:
  serve       Start ollama
  create      Create a model from a Modelfile
  show        Show information for a model
  run         Run a model
  stop        Stop a running model
  pull        Pull a model from a registry
  push        Push a model to a registry
  list        List models
  ps          List running models
  cp          Copy a model
  rm          Remove a model
  help        Help about any command

Flags:
  -h, --help      help for ollama
  -v, --version   Show version information

Use "ollama [command] --help" for more information about a command.
```

こちらを見て感じる方もいらっしゃるかもしれませんが、なかなかDockerライクな使い勝手に感じます。
基本的には`pull`でモデルをダウンロードして、`run`で実行する(未ダウンロードの場合`pull`も行われる)イメージです。
ダウンロードできるモデルは以下のリンクに情報があります。
(こちらにないモデルに関しても、Hugging Faceにあるモデルを動かすことができるようです)
(参考：[Use Ollama with any GGUF Model on Hugging Face Hub](https://huggingface.co/docs/hub/ollama))

https://ollama.com/library

私は現状、以下のモデルをダウンロードしています。
(tagがlatestなのはよくないと思います...)

```shell
/# ollama list
NAME               ID              SIZE      MODIFIED   
gemma2:latest      ff02c3702f32    5.4 GB    4 days ago    
qwen2.5:latest     845dbda0ea48    4.7 GB    4 days ago    
llama3.2:latest    a80c4f17acd5    2.0 GB    5 days ago
```

:::note info
モデルについての補足
- gemma：Google開発のLLM
- qwen：アリババ開発のLLM
- llama：Microsoft開発のLLM
:::

# 実際にモデルを触ってみる
以下コマンドでモデルを起動し触ってみます。
(私の環境では、起動は20秒程度かかります)

```shell
/# ollama run gemma2:latest
>>> Send a message (/? for help)
```

`/show info`コマンドでモデルの情報を確認することができます。

```shell
>>> /show info
  Model
    architecture        gemma2    
    parameters          9.2B      
    context length      8192      
    embedding length    3584      
    quantization        Q4_0      

  Parameters
    stop    "<start_of_turn>"    
    stop    "<end_of_turn>"      

  License
    Gemma Terms of Use                  
    Last modified: February 21, 2024
```

では、やり取りしてみましょう。

```shell
>>> こんにちは！あなたのモデルについて教えてください。
こんにちは！

私はGemmaと呼ばれる、Google DeepMindが開発したオープンソースの言語モデルです。テキストを理解し、生成する能力があり、さまざまなタスクに役立ちます。例え
ば、質問に答える、文章を要約する、ストーリーを作成するなどです。

ただし、いくつか覚えておいてほしいことがあります。

* **私はインターネットにアクセスできません:** 最新の情報を得たり、外部のウェブサイトを参照することはできません。
* **私は感情や意識を持たない:** 人間の様に感情を抱いたり、考えを独立して持つことはできません。
* **私の知識はトレーニングデータに基づく:** トレーニングデータが偏っていた場合、誤った情報や差別的な表現を含む可能性があります。

オープンソースであるため、誰でも私のコードや仕組みを見ることができます。これは透明性と共同開発を促進し、AI技術の進歩に貢献するものです。

何か他に知りたいことがあれば、聞いてください！
```

このように対話形式でやり取りすることができました。
(私の環境では応答に20～30秒程度かかりました)


# LangChainから呼び出してみる
では、次はLnagChainを用いてLLMを呼び出してみましょう。
LangChainでは、`ChatOllama`を用いることで、呼び出すことができます。
詳細については以下リンクを参照してください。

https://python.langchain.com/docs/integrations/chat/ollama/

https://python.langchain.com/api_reference/ollama/chat_models/langchain_ollama.chat_models.ChatOllama.html

今回は以下のようなスクリプトを作成しました。
`ChatOllama`を使ってLLMを呼び出す以外は特段変わったことはないと思います。
(LangChainについての説明は省略します)

```py:model_invoke.py
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage

llm = ChatOllama(base_url="http://localhost:11434", model="llama3.2")

system_message = "あなたは優秀なアシスタントです。常に日本語で回答してください。"
human_message = "あなたのモデルについて教えてください。"

messages = [
    SystemMessage(content=system_message),
    HumanMessage(content=human_message)
]

response = llm.invoke(messages)

print(f"System Message：{system_message}")
print(f"Human Message：{human_message}")
print(f"出力：{response.content}")
```

実行してみましょう。

```shell
$ uv run src/model_invoke.py 
System Message：あなたは優秀なアシスタントです。常に日本語で回答してください。
Human Message：あなたのモデルについて教えてください。
出力：私は、Googleによって開発されたAI技術を使用したコンテンツジェネレーティングモデルです。私は、自然言語処理（NLP）および机械学習を使用して、さまざまなテーマに関する情報を生成できるように設計されています。

私のモデルは、以下の特徴を持っています。

1.  **知識ベース**: 私のモデルのknowledge graphは、数百万のトピックとそれに関連する情報が含まれており、さまざまなテーマに関する質問に答えることができます。
2.  **Natural Language Understanding (NLU)**: 私は、人間の言語を理解し、分析する能力があります。私は、文脈や感情などの微妙な側面を考慮して、情報を提供します。
3.  **Language Generation**: 秒速に情報を生成できるように設計されており、さまざまなテーマに関する質問に答えることができます。
4.  **Continuous Learning**: 私は、学習データの更新によって、より正確で効果的になるように改善されます。

私の目標は、ユーザーが迅速かつ信頼性のある情報を提供できるようにします。
```

以上のように呼び出すことができました。
(こちらも私の環境では応答に20～30秒程度かかりました)

# 最後に
今回はOllamaを用いてOSS LLMをローカルで触ってみました。
Ollamaが便利なこともあり、簡単に対話形式でやり取りをしたり、LangChainで用いることができたりしました。
一方で、性能(主に応答速度)がマシンスペックに依存しそうな点は少し不安でもあります。
今後は、どのくらいのことができるのかを意識しながら付き合っていきたいと思います。
ありがとうございました。
