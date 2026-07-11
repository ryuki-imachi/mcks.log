---
title: "【MCP】あくる日 mcp-server-motherduck でエラーが出た"
description: "以前触っていたAIエージェントで設定していた mcp-server-motherduck を久しぶりに使ったところ、急に起動エラーが出るようになりました。"
pubDate: 2026-02-10
tags: ['トラブルシューティング', 'MCP', 'DuckDB']
qiitaId: 48bdc968e0865f2d7355
importedDate: 2026-07-11
qiitaStats:
  views: 369
  likes: 0
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

以前触っていたAIエージェントで設定していた `mcp-server-motherduck` を久しぶりに使ったところ、急に起動エラーが出るようになりました。

https://github.com/motherduckdb/mcp-server-motherduck

今回は、実際に遭遇した以下のエラーについて、原因と対処を自分向けメモも兼ねてまとめます。

```
Usage: mcp-server-motherduck [OPTIONS]
Try 'mcp-server-motherduck --help' for help.

Error: In-memory databases require the --read-write flag.
Options:
  - Add --read-write to allow writes (data won't persist anyway)
  - Use --db-path with a file path for read-only access to a DuckDB file
  - Use --db-path md: with a MotherDuck token for cloud database access
```

## 結論

原因は、`mcp-server-motherduck` v1系で read-only がデフォルトになったことです。

今回の設定は `:memory:` を使っており、このモードでは `--read-write` が必須です。`--read-write` を付けていなかったため、今回のエラーが発生しました。


## v1.0について

今回のエラーの背景にある v0.8.1 → v1.0.0 の変更点を確認しておきます。

https://github.com/motherduckdb/mcp-server-motherduck/compare/0.8.1...v1.0.0

まず、デフォルトの起動モードが **read-only** に変更されました。書き込みを行うには `--read-write` の明示が必要です。これが今回のエラーの直接的な原因です。

あわせて、`--db-path` のデフォルトも `md:` から `:memory:` に変わっています。そのため、MotherDuck に接続したい場合は `--db-path md:` を明示する必要があります。

ツールまわりも大きく変わっています。v0.8.1 では `execute_query` のみでしたが、v1.0.0 で `list_databases`・`list_tables`・`list_columns` が新たに追加されました。さらに `--allow-switch-databases` を有効にすると `switch_database_connection` ツールも使えるようになり、実行中にデータベースの接続先を切り替えられるようです。


## 実際の修正内容（Python / MCPクライアント設定）

### 修正前

```python
# MCPクライアントを設定
duckdb_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="uvx",
        args=[
            "mcp-server-motherduck",
            "--db-path",
            ":memory:"
        ]
    )
))
```

この状態は `:memory:`（インメモリDB）を使っていますが、
現行の `mcp-server-motherduck` では read-only がデフォルトのため起動エラーになります。

### 修正後（今回の対応）

```python
# MCPクライアントを設定（:memory: を read-write で利用）
duckdb_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="uvx",
        args=[
            "mcp-server-motherduck",
            "--db-path",
            ":memory:",
            "--read-write"
        ]
    )
))
```

`--read-write` を追加することで、インメモリDBでも起動できるようになります。

:::note
`:memory:` はプロセス終了時にデータが消えるため、永続化したい場合は `--db-path` に `.duckdb` ファイルか `md:` を指定します。
:::

:::note
少し話はずれますが、リモートMCPサーバーもあるようです。(知らなかった…)こちらは読み取り専用のようですが、状況によってはこちらの方が便利に扱えるかもしれません。
:::

https://motherduck.com/docs/sql-reference/mcp/

## おわりに

今回のエラーは、アプリコードそのものではなく、MCPサーバー側の既定値変更が原因でした。

MCPまわりは更新頻度も高いので、起動引数の明示とメジャー更新時の確認を習慣化しておくと、同じようなハマりを避けやすいと思います。

...と言いつつ自分で見に行くのは大変なので、仕組み化できるといいのかもしれません。

同じエラーに遭遇した方の参考になれば幸いです。
ありがとうございました。
