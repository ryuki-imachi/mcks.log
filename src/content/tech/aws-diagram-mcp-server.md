---
title: "【Diagram MCP】AWS Diagram MCP Server で構成図を作成してみた"
description: "アプリケーションの開発が完了し、AWS CDKを利用してAWSにデプロイして本格運用できる状態になりました。（以下画像のようになりました）"
pubDate: 2025-06-30
tags: ['AWS', 'MCP']
qiitaId: 1fe33f0312a4938fdf2e
importedDate: 2026-07-11
qiitaStats:
  views: 8615
  likes: 13
  stocks: 7
  fetchedAt: 2026-07-11
---

# はじめに
最近「Qiitaへの投稿状況を管理するアプリ」を開発しており、要件定義から実装までClaude Codeと協力して進めてきました。
前回の要件定義については別記事で詳しく書いているので、よろしければご参照ください。

https://qiita.com/ryu-ki/items/1216d00f893f7bdbf95b

アプリケーションの開発が完了し、AWS CDKを利用してAWSにデプロイして本格運用できる状態になりました。（以下画像のようになりました）

![image.png](https://images.ryu-ki-learn.com/aws-diagram-mcp-server/fd72f023-3ccc-4bf9-983b-077336b90735.png)

次のステップとして構成図を作成しようと考えていたところ、AWSから **AWS Diagram MCP Server**というMCPサーバーが公開されていることを思い出し試してみました。本記事ではそちらについて実践したことを備忘として書いていきたいと思います。

:::note
本記事は「生成AI（Claude）にAWS構成図を作ってもらったこと」が主題なのでアプリについての説明はしません。またどこかのタイミングで記事などにできればと思います。
:::

AWS Diagram MCP Server の詳細については、以下のGitHubリポジトリをご覧ください。

https://github.com/awslabs/mcp/tree/main/src/aws-diagram-mcp-server

# 使えるようにする
### 事前準備
前述したGitHubリポジトリを見ていただければわかる（`Prerequisites`）と思うのですが、本MCPサーバーを利用するには以下3点が必要となっています。

1. `uv` のインストール
1. `uv` による Pythonインストール（`uv python install 3.10`）
1. `GraphViz` のインストール（`GraphViz`については後述）

:::note warn
Pythonについて、3.10 以上であればよさそうです。
:::

### MCPクライアントでの設定
各クライアントの設定方法に則って以下を追加します。
（私はClaude Codeで利用するので`.mcp.json`に記載しています）

```json:.mcp.json
{
  "mcpServers": {
    "awslabs.aws-diagram-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.aws-diagram-mcp-server"],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR"
      },
      "autoApprove": [],
      "disabled": false
    }
  }
}
```

### （補足）Graphvizについて
グラフの構造を定義すると、自動的に美しいレイアウトで図を生成してくれるOSSのようです。MCPサーバーでは、Pythonの`diagrams`ライブラリを使用しており、このライブラリが内部でGraphvizを利用してレイアウト計算を行います。そのため、事前にGraphvizのインストールが必要となるようです。

https://www.graphviz.org/

# 使ってみる
早速使ってみたいと思います。

### プロンプト
```
qiita-managerの構成図を保存してほしい。作成はdiagram mcp使ってみて。
```

### 生成された構成図
以下のような構成図が作成されました。めちゃくちゃきれい！というわけでないですが、何をしているのかはある程度分かりそうですし、一言お願いしただけでここまでやってくれるのでなかなかいいなという感じです。

また、こちらは構成図がPNG形式で出力されるので、編集するのが手間っぽく感じます。

![qiita-manager-architecture.png](https://images.ryu-ki-learn.com/aws-diagram-mcp-server/6717cdbb-b27d-4138-9dcf-066842865f05.png)

# MCPなしでも作ってみる
せっかくなのでMCPを使わずに、Claude sonnet 4 の自力で作ってみてもらいました。

### プロンプト
```
同様にして、MCPを使わずに、AWS構成図を.drawioファイルで作成してください。
アイコン図形はAWS 2025を利用してください。
```

### 生成された構成図
以下のような構成図が作成されました。私が作るとしたらこちらに近い見た目になっていたと思います。ところどころアイコンがなく■で代用されている部分がありますが、おおむね問題ないような気はします。

1番違いを感じたのが、**補足説明がある**ことです。構成図としては本来ない方がよいのかもしれませんが（MCPの方では意図的に制御されている可能性がありますが）、生成AIに作成させる（≒人間が1度チェックする）という観点では、個人的にはこの説明がある方がわかりやすくていいように感じました。

また、こちらはMCPを使った際に比べて作成時間が若干長かったです。（誤差と言えば誤差レベルですが）

![qiita-manager-aws-architecture.png](https://images.ryu-ki-learn.com/aws-diagram-mcp-server/c124cd62-bc04-43b7-89db-4dca4ed0e4aa.png)

# 簡単な比較（主観あり）
|      | MCPあり | MCPなし |
|------|-----|-----|
| メリット | 基本的にアイコンの不足はなさそう | drawio形式で作れる（≒編集できる） |
| デメリット  | 編集不可（PNG出力） | アイコンの不足あり |
| 使いどころ  | 簡単なプロトタイプ作成 | 正確で編集可能な図が必要な場合 |

# おわりに
簡単ではありますが、AWS CDKで構築した仕組みの構成図を生成AIを用いて作成してもらいました。Claude 3.7が出たあたりですでに有用さは聞いていましたが、いざ自分が作ったものの構成図を短い時間で書いてもらえると感動しました。今回は簡単なプロンプトで作成してみましたが、何か工夫点があるかもしれません（レイアウト方向、グループ化の仕方など）。機会があればそのあたりの検証などもしてみたいと思います。
ありがとうございました。
