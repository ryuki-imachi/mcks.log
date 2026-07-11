---
title: "【draw.io MCP】触ってみた所感と何が便利なのか"
description: "draw.io の MCP サーバーが公開されていたので、軽く触ってみました。"
pubDate: 2026-02-12
tags: ['Draw.io', 'MCP']
qiitaId: 29219d2c3126b97e7a0c
importedDate: 2026-07-11
qiitaStats:
  views: 32286
  likes: 62
  stocks: 32
  fetchedAt: 2026-07-11
---

## はじめに

draw.io の MCP サーバーが公開されていたので、軽く触ってみました。

https://www.npmjs.com/package/@drawio/mcp

https://github.com/jgraph/drawio-mcp

勝手に、よりいい感じの図を出力してくれると思って使ったのですが、（何も使わずに「drawio 形式で書いて」と指示する場合と比べて）あまり違いを感じませんでした。

https://x.com/umitsutech/status/2021428088635334718

そこで今回は、ちゃんとリポジトリなどの説明を読んで、このMCPサーバーにはどういう価値があるのか確認したいと思います。なお、内容は 2026年2月11日 時点の README をもとに整理しています。

## 公式情報で確認できること

### できること

`drawio-mcp` では、Mermaid と draw.io XML と CSV（draw.io の CSV import 形式）を draw.io で開けます。README ベースだと対応ツールは `open_drawio_mermaid` と `open_drawio_xml` と `open_drawio_csv` とのことです。

README でも、まず次のように説明されています。

> "The official draw.io MCP (Model Context Protocol) server that enables LLMs to create and open diagrams in the draw.io editor."

https://github.com/jgraph/drawio-mcp#drawio-mcp-server

MCP クライアント側の設定は、例えば以下のような起動になります。

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "@drawio/mcp"]
    }
  }
}
```

### どう動くか

README の説明を見ると、MCP ツールは draw.io の `#create` 形式 URL を返し、クライアントがそれを開く流れです。

この点も README の `How It Works` に明記されています。

> "A draw.io URL is generated with the `#create` hash parameter"

https://github.com/jgraph/drawio-mcp#how-it-works

この挙動からも、MCP サーバーの主役はデータを draw.io に渡すことと、エディタ起動までをスムーズにすることにあるように見えます。そのため、自動レイアウト品質を直接上げる仕組みではなさそうです。

### MCP なしでも実現できること

README には、MCP を使わない代替手順も記載されています。LLM に Mermaid や XML を生成させて、ファイルとして保存し、draw.io へ import する方法です。

こちらも README では次の一文で始まっています。

> "An alternative approach is available that works without installing the MCP server."

https://github.com/jgraph/drawio-mcp#alternative-project-instructions-no-mcp-required

この点からも、機能自体は従来手順でも実現可能であり、違いはそこに至るまでの手間と速さにあるといえるのではないでしょうか。

## ありなしで変わることと変わらないこと

MCP の有無で変わるのは、コピペや import の手間、図を開くまでの時間、修正着手までのテンポかと思います。

逆に変わらないのは、初回生成時点の見た目の良さや、情報設計の妥当性、最終品質です。最終品質は人がどこまで整えるかに依存する部分が大きいと感じます。

## 使いどころの目安

一発で終わる簡易図や、自分だけで使うラフ図であれば、MCP なしでも十分な気がしています。

一方で、修正回数が多い図やレビュー前提で見やすさを詰める図、LLM 生成結果を叩き台にして短時間で整えたい図では、MCP の恩恵が出やすいと思います。

:::note
図の綺麗さを上げるポイントは、プロンプトの粒度調整と人手でのレイアウト調整です。MCP はその試行回数を増やせる、という立ち位置だと思います。
:::

## おわりに

簡単ではありましたが、以上が整理した内容になります。

ここまでで感じたのは、自動で図の品質を上げるというよりは、編集導線の短縮に効くという点でした。（ブラウザが開いていじれるのはとても便利に思います）

期待値としては、図の品質を直接上げるツールではなく、LLM 出力を draw.io の編集フローに素早く渡すための仕組みとして捉えるのが良さそうです。（使う前にちゃんとドキュメントを読みましょう...）

これから使ってみようかなと考えている方の参考になれば幸いです。
ありがとうございました。
