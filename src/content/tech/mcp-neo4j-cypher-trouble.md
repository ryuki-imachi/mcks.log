---
title: "【MCP】mcp-neo4j-cypher が使えずちょっと困った話"
description: "Strands Agents で Neo4j の MCP サーバー（mcp-neo4j-cypher）を使おうとした際、以下のようなエラーに遭遇しました。"
pubDate: 2026-01-09
updatedDate: 2026-01-19
tags: ['neo4j', 'MCP', 'StrandsAgents']
qiitaId: 45b925ddbad7698edeb6
importedDate: 2026-07-11
qiitaStats:
  views: 1464
  likes: 2
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

Strands Agents で Neo4j の MCP サーバー（`mcp-neo4j-cypher`）を使おうとした際、以下のようなエラーに遭遇しました。

```
TypeError: FastMCP.__init__() got an unexpected keyword argument 'dependencies'
```

Claudeに相談しながら原因を解決しましたので、今回の記事ではそのことについて共有したいと思います。

## その前に、そもそも Neo4j とは

本題に入る前に Neo4j について簡単に紹介します。

Neo4j は、データをノード（点）とリレーションシップ（線）で表現するグラフデータベースです。

従来のリレーショナルデータベースがテーブル形式でデータを管理するのに対し、Neo4j はデータ間の「つながり」を直感的に表現・検索できます。

例えば、映画データベースでは「俳優」と「映画」をノードとして、「出演した」というリレーションシップで結びます。「この俳優と共演したことがある俳優を全員探す」といった複雑な関係性のクエリも、Cypher というクエリ言語でシンプルに書けるのが特徴です。

SNSのフォロー関係、レコメンドエンジン、不正検知など、データの関係性が重要な場面で広く使われています。

詳細については以下をご覧ください。

https://neo4j.com/

また、以下が今回利用したMCPサーバーです。

https://github.com/neo4j-contrib/mcp-neo4j

## 発生した問題

### エラー内容

`mcp-neo4j-cypher@0.5.1` を使おうとしたところ、以下のエラーが発生しました。（最新は v0.5.2 であり、なぜこのバージョンにしてしまったのか覚えていません...）

```
TypeError: FastMCP.__init__() got an unexpected keyword argument 'dependencies'
```

## 原因

`mcp-neo4j-cypher` v0.5.1 では、内部で `fastmcp` の `dependencies` 引数を使用していました。

```python
# mcp-neo4j-cypher v0.5.1 の内部コード
mcp: FastMCP = FastMCP(
    "mcp-neo4j-cypher", 
    dependencies=["neo4j", "pydantic"],  # ← この引数
    stateless_http=True
)
```

しかし、`fastmcp` 側で `dependencies` 引数が削除されたため、エラーが発生していました。

> This release removes deprecated APIs accumulated across the 2.x series: BearerAuthProvider, Context.get_http_request(), the dependencies parameter, legacy resource prefix formats, and several deprecated methods.

https://github.com/jlowin/fastmcp/releases

## 解決方法

`mcp-neo4j-cypher` v0.5.2 では、`fastmcp` 側の変更に対応して `dependencies` 引数が削除されています。

```diff_python
# mcp-neo4j-cypher v0.5.2
mcp: FastMCP = FastMCP(
     "mcp-neo4j-cypher", 
-    dependencies=["neo4j", "pydantic"], 
     stateless_http=True  # dependencies 引数を削除
)
```

https://github.com/neo4j-contrib/mcp-neo4j/pull/246/commits/296c15eb286296fc664addd8026a5729280c4286

そのため、`mcp-neo4j-cypher` v0.5.2 を利用すれば解決します。

なお、`uvx` はプロジェクトの仮想環境とは別の独立した環境でパッケージを管理しています。キャッシュをクリアして最新版を取得します。

```bash
uv cache clean
```

その後、v0.5.2 を指定して実行すれば解決です。

```python
args=["mcp-neo4j-cypher@0.5.2"]
```

## 結局必要だったこと

キャッシュをクリアして最新バージョンを利用するようにするだけです。

```bash
# uvx のキャッシュをクリア
uv cache clean
```

```python
# mcp-neo4j-cypher v0.5.2 を使用
args=["mcp-neo4j-cypher@0.5.2"]
```

### まとめると…

- `mcp-neo4j-cypher` v0.5.1 は `fastmcp` の `dependencies` 引数を使用
- `fastmcp` 側で `dependencies` 引数が削除されたためエラーが発生
- `mcp-neo4j-cypher` v0.5.2 で `dependencies` が削除され、問題が解消
- `uvx` は独立した環境でパッケージを管理するため、`uv cache clean` で最新版を取得する必要あり

:::note
要は**最新バージョンを指定していれば起きなかった**問題です。みなさんはちゃんとバージョン指定しましょう。
:::

## おわりに

しょうもないことがきっかけで困るのを何回すれば気が済むんだと思いながらこの記事を書いています。
とはいいつつ、CHANGELOG や Releases を眺めるいい機会になったので、今後も困っては解決してそれを周りに共有するというのは続けていきたいと思います。
ありがとうございました。

## （おまけ）実装例

おまけとして、試しに簡単に実装した例を記載します。

```python
from strands import Agent
from strands.models import BedrockModel
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

model = BedrockModel(
    model_id="anthropic.claude-sonnet-4-20250514",
    region_name="ap-northeast-1"
)

neo4j_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="uvx",
        args=["mcp-neo4j-cypher@0.5.2"],
        env={
            "NEO4J_URI": "neo4j+s://demo.neo4jlabs.com",
            "NEO4J_USERNAME": "movies",
            "NEO4J_PASSWORD": "movies",
            "NEO4J_DATABASE": "movies"
        }
    )
))

with neo4j_mcp_client:
    agent = Agent(
        model=model,
        tools=neo4j_mcp_client.list_tools_sync(),
        system_prompt="Neo4jのクエリエージェントです。",
    )

    agent("最も多くの映画に出演した俳優を教えて")

```

サンプルデータベースは以下を参考に利用しています。

https://neo4j.com/docs/getting-started/appendix/example-data/
