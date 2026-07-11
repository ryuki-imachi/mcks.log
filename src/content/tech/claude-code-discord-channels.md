---
title: "【Claude Code】Discord から Claude Code を操作できる Channels 機能を試してみた"
description: "Claude Code に Channels という機能があることを知り、試してみました。"
pubDate: 2026-06-06
tags: ['生成AI', 'Discord', 'Claude', 'ClaudeCode']
qiitaId: e89507c5fe497540339c
importedDate: 2026-07-11
qiitaStats:
  views: 993
  likes: 2
  stocks: 0
  fetchedAt: 2026-07-11
---


## はじめに

Claude Code に Channels という機能があることを知り、試してみました。

https://code.claude.com/docs/en/channels

これは Discord や Telegram などの外部メッセージングアプリから、ローカルで動いている Claude Code のセッションにメッセージを送って操作できる仕組みです。つまり、スマホの Discord アプリから「このバグ直しておいて」と送ると、PC で動いている Claude Code がそのまま応答してくれます。

今回は Discord との連携をセットアップした際の手順と、いくつかハマったポイントを共有します。

## 前提環境

- macOS Sequoia
- Claude Code v2.1.165
- Claude Max プラン（Anthropic 直接認証）

Channels を使うにはいくつか前提条件があります。

まず、Claude Code は v2.1.80 以上が必要です。また、認証は Anthropic 直接の認証（claude.ai アカウント or Console API キー）のみ対応しており、Amazon Bedrock や Google Vertex 経由では利用できません。

コスト面については、Claude Code のサブスクリプション内で完結するので追加課金は発生しません。ただし、Channels 経由のやり取りも通常の利用量としてカウントされるので、Max プランの上限に早く到達する可能性はあります。

なお、Channels はセッションを開いている間だけ動作します。Claude Code を閉じるとメッセージを受け取れなくなるので、この点は注意が必要です。

## Bun のインストール

Channels のプラグインは Bun で動作するので、まずインストールしておきます。

```bash
curl -fsSL https://bun.sh/install | bash
```

https://bun.sh

:::note warn
Bun のインストーラーは `~/.zshrc` にのみ PATH を追加します。しかし、Claude Code のプラグインプロセスはログインシェルとして起動するため、`~/.zprofile` を読みます。`.zprofile` にも PATH を追加しないとプラグインが起動しません。

```bash
# ~/.zprofile に以下を追加
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

`.zshrc` はターミナルを開いたとき（インタラクティブシェル）に読まれるファイルで、`.zprofile` はログインシェル起動時に読まれるファイルです。PATH のようにシステム全体で使う環境変数は `.zprofile` に書くのが正解ですが、多くのインストーラーが `.zshrc` にだけ書くので、バックグラウンドプロセスで問題になることがあります。私もここでしばらくハマりました。
:::

## Discord Bot の作成

Discord Developer Portal で Bot を作成します。

https://discord.com/developers/applications

「New Application」から新しいアプリケーションを作って、好きな名前をつけます。私は `kuroko-chan` にしました。

左メニューの「Bot」を開いて「Reset Token」をクリックすると Bot トークンが表示されます。このトークンは 1 回しか表示されないのでコピーして控えておいてください。

![](https://images.ryu-ki-learn.com/claude-code-discord-channels/bot-token-reset.png)

同じ Bot ページの下の方にある「Message Content Intent」は ON にしておく必要があります。これが OFF だとメッセージの内容を読めません。

![](https://images.ryu-ki-learn.com/claude-code-discord-channels/message-content-intent.png)

## Bot の権限設定とサーバーへの追加

左メニューの「OAuth2 → URL Generator」を開いて、Scopes で `bot` にチェックを入れます。

Bot Permissions では View Channels、Send Messages、Send Messages in Threads、Read Message History、Attach Files、Add Reactions にチェックを入れます。

![](https://images.ryu-ki-learn.com/claude-code-discord-channels/bot-permissions.png)

生成された URL をブラウザで開くと、Bot をどのサーバーに追加するか選べるので、私のサーバーを選択して追加します。

## プラグインのインストールと設定

ここからは Claude Code の CLI で作業します。今回利用する Discord プラグインは、Anthropic 公式のプラグインリポジトリで公開されています。

https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord

最近 Desktop 版（Claude Desktop）を使っているのですが、Desktop 版では `/plugin` コマンドが使えなかったので、ターミナルから Claude Code を起動して進めました。

```bash
claude /plugin install discord@claude-plugins-official
```

実行するとプラグインの一覧が表示されるので、discord を選択します。

続けてトークンを設定します。

```bash
claude /discord:configure <ボットトークン>
```

## ペアリング

トークンの設定ができたら、Channels 付きで Claude Code を起動します。

```bash
claude --channels plugin:discord@claude-plugins-official
```

起動したら、Discord で Bot に DM を送ります。内容は「hello」など何でも大丈夫です。すると Bot からペアリングコードが返ってくるので、Claude Code の CLI で以下を実行します。

![](https://images.ryu-ki-learn.com/claude-code-discord-channels/pairing-code.png)

```bash
/discord:access pair <ペアリングコード>
```

最後にセキュリティ設定として、私だけにアクセスを制限しておきます。

```bash
/discord:access policy allowlist
```

これで DM での連携は完了です。Discord から Bot にメッセージを送ると、Claude Code が応答してくれるようになります。

![](https://images.ryu-ki-learn.com/claude-code-discord-channels/dm-response.png)

## サーバーチャンネルでも使えるようにする

DM だけでなく、Discord サーバーのテキストチャンネルでもメンション付きでやり取りできます。

まず Discord の設定から「詳細設定 → 開発者モード」を ON にします。次に、やり取りしたいテキストチャンネルを右クリックして「チャンネル ID をコピー」を選びます。

コピーしたチャンネル ID を使って、Claude Code の CLI で以下を実行します。

```bash
/discord:access group add <テキストチャンネルID>
```

ただし、チャンネルを追加しただけではメンションに反応しませんでした。Bot がどのメンションに反応するかを示す mentionPatterns（メンション判定用のパターン設定）が未設定だったためです。以下のコマンドで Bot のメンションパターンを設定する必要があります。

https://github.com/anthropics/claude-plugins-official/blob/main/external_plugins/discord/ACCESS.md

```bash
/discord:access set mentionPatterns <@Bot のユーザーID>, <@!Bot のユーザーID>
```

Discord のメンションは内部的に `<@ユーザーID>` と `<@!ユーザーID>` の 2 種類の形式で送られることがあるので、両方を登録しておきます。Bot のユーザー ID は、Discord の開発者モードで Bot のプロフィールを右クリックしてコピーできます。

これでそのチャンネルで `@kuroko-chan こうしてほしい` とメンション付きでメッセージを送ると応答するようになります。

:::note warn
Discord の開発者モードではサーバー名を右クリックしても「サーバー ID をコピー」が表示されます。group add に渡すのはサーバー ID ではなくテキストチャンネルの ID です。サーバー ID を指定してもエラーにならず登録できてしまいますが、メッセージが届きません。
:::

![](https://images.ryu-ki-learn.com/claude-code-discord-channels/server-channel-response.png)

## 権限プロンプトの自動許可

デフォルトでは、Discord からメッセージが来るたびに Claude Code 側で権限の確認プロンプトが表示されます。スマホから操作する用途だと、いちいち PC のターミナルで許可するのは現実的ではないので、自動許可の設定を入れておくのがよいと思います。

Claude Code の権限設定については以下のドキュメントに詳しく書かれています。

https://code.claude.com/docs/en/permissions

`~/.claude/settings.json` の `permissions.allow` に以下を追加します。

```json
{
  "permissions": {
    "allow": [
      "mcp__plugin_discord_discord__*"
    ]
  }
}
```

## 今後の展望

サーバーにも導入できたので、いろいろ整備してもらおうと思ったのですが、今回利用している plugin ではサーバーをいじるツールがないようです。ここは今後自作していきたいと思います。

![](https://images.ryu-ki-learn.com/claude-code-discord-channels/available-tools.png)

## おわりに

セットアップ自体はそこまで複雑ではないのですが、Bun の PATH を `.zprofile` に書く必要がある点や、権限のワイルドカードパターンのフォーマット、サーバー ID とチャンネル ID の取り違えなど、地味にハマるポイントがいくつかありました。

外出先からスマホで Claude Code に指示を出せるのはなかなか便利なので、興味のある方は試してみてください。

ありがとうございました。
