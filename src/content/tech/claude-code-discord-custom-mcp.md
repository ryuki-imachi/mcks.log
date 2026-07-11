---
title: "【Claude Code】Discord の Channels 機能を拡張する自作 MCP サーバーを作ってみた"
description: "前回の記事で、Claude Code の Channels 機能を使って Discord から Claude Code を操作できるようにしました。"
pubDate: 2026-06-19
updatedDate: 2026-06-22
tags: ['生成AI', 'MCP', 'Discord', 'Claude', 'ClaudeCode']
qiitaId: 66fae78d3c92388d9f69
importedDate: 2026-07-11
qiitaStats:
  views: 914
  likes: 1
  stocks: 1
  fetchedAt: 2026-07-11
---


## はじめに

前回の記事で、Claude Code の Channels 機能を使って Discord から Claude Code を操作できるようにしました。

https://qiita.com/imachi_ryuki/items/e89507c5fe497540339c

そのとき「今後の展望」として書いていたのですが、公式の Discord プラグインはメッセージのやり取りしかできず、チャンネルの作成や削除といったサーバー管理系の操作には対応していません。

学習用の Discord サーバーを Claude Code に整備してもらいたかったので、チャンネル管理ができる MCP サーバーを自作してみました。この記事ではその実装と、途中でハマったポイントを共有します。

## 前提環境

- macOS Sequoia
- Claude Code v2.1.167
- Python 3.12 / uv 0.9.24
- Discord Bot（前回記事でセットアップ済み）

## 公式プラグインでできること

まず、公式プラグイン（`discord@claude-plugins-official`）で使えるツールを整理しておきます。

https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord

| ツール | 操作 |
|--------|------|
| `fetch_messages` | メッセージ取得（最大 100 件） |
| `reply` | メッセージ送信（ファイル添付可） |
| `react` | リアクション追加 |
| `edit_message` | 送信済みメッセージの編集 |
| `download_attachment` | 添付ファイルのダウンロード |

すべてメッセージ操作です。チャンネルの作成・削除・名前変更やカテゴリの管理といったサーバー管理系の操作は一切ありません。

## discord.py ではなく httpx にした理由

Python で Discord Bot を作るなら discord.py が定番ですが、今回はあえて httpx で Discord REST API を直接呼ぶ方針にしました。

https://www.python-httpx.org/

https://discordpy.readthedocs.io/

discord.py は常駐型の Bot 向けライブラリで、`Bot.run()` を呼ぶと独自の非同期イベントループに入ります。一方、MCP サーバーは FastMCP が内部で独自のイベントループを持っているため、両者を同居させると競合してうまく動かない、もしくは複雑な実装になりえます。

https://github.com/modelcontextprotocol/python-sdk

httpx は独自のイベントループを持たない非同期 HTTP クライアントなので、FastMCP のループの中から `await` ひとつで Discord の REST API を呼べます。

最終的に採用した技術スタックは以下の通りです。

| コンポーネント | 技術 |
|--------------|------|
| 言語 | Python 3.12（3.10 以上で動作） |
| MCP SDK | mcp v1.27.2（FastMCP） |
| HTTP クライアント | httpx |
| パッケージ管理 | uv |

## 実装

### プロジェクト構成

最終的にはこうなりました。

```text
original-tools/
├── pyproject.toml
├── .env                  # Bot Token & Guild ID（サーバーID）
└── src/
    └── discord_mcp/
        ├── __init__.py
        ├── __main__.py   # エントリポイント
        ├── server.py     # MCP サーバー本体
        ├── client.py     # Discord REST API クライアント
        └── tools/
            ├── __init__.py
            └── channels.py   # チャンネル管理ツール
```

### Discord REST API クライアント

Discord REST API v10 を httpx で叩くクライアントです。認証は `Authorization: Bot {トークン}` ヘッダーを付けるだけです。

https://docs.discord.com/developers/resources/channel

```python
# client.py
BASE_URL = "https://discord.com/api/v10"

class DiscordClient:
    def __init__(self, bot_token: str, guild_id: str) -> None:
        self.guild_id = guild_id
        self._headers = {"Authorization": f"Bot {bot_token}"}
        self._http = httpx.AsyncClient(
            base_url=BASE_URL, headers=self._headers, timeout=10.0
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = await self._http.request(method, path, **kwargs)

        response.raise_for_status()
        if response.status_code == 204:
            return None
        return response.json()
```

各操作のメソッドは、この `_request` を使って対応する REST API エンドポイントを呼ぶだけです。例えばチャンネル作成なら `POST /guilds/{guild_id}/channels`、削除なら `DELETE /channels/{channel_id}` という具合で、パターンは同じなので省略します。

### MCP ツールの定義

FastMCP の `@mcp.tool()` デコレータを付けた関数がそのまま Claude Code のツールになります。

https://github.com/modelcontextprotocol/python-sdk?tab=readme-ov-file#tools

```python
# tools/channels.py
@mcp.tool()
async def list_channels() -> str:
    """サーバーのチャンネル一覧を取得する"""
    channels = await client.list_channels()
    # ... 整形して返す
```

同じパターンで `create_channel`、`delete_channel`、`edit_channel`、`create_category` の計 5 つを定義しました。

### access.json の自動更新

公式の Discord プラグインは `~/.claude/channels/discord/access.json` でチャンネルごとのアクセス制御を管理しています。新しいチャンネルを作っても、このファイルにチャンネル ID を追加しないと Bot が反応できません。毎回手動で追加するのは面倒なので、チャンネル作成・削除時に自動で更新するようにしました。

https://github.com/anthropics/claude-plugins-official/blob/main/external_plugins/discord/ACCESS.md

```python
# tools/channels.py
ACCESS_JSON = Path.home() / ".claude" / "channels" / "discord" / "access.json"

def _add_channel_to_access(channel_id: str) -> None:
    data = _read_access()
    groups = data.setdefault("groups", {})
    if channel_id not in groups:
        allow_from = data.get("allowFrom", [])
        groups[channel_id] = {"requireMention": True, "allowFrom": allow_from}
        _write_access(data)

def _remove_channel_from_access(channel_id: str) -> None:
    data = _read_access()
    groups = data.get("groups", {})
    if channel_id in groups:
        del groups[channel_id]
        _write_access(data)
```

ここで気をつけたのは削除時の順序です。access.json から先にエントリを消してから Discord のチャンネルを削除するようにしています。

:::note warn
逆の順序にすると、Discord 側の削除は成功したのに access.json の更新に失敗した場合、存在しないチャンネルがアクセスリストに残り続けてしまいます。
:::

### MCP サーバーのエントリポイント

Bot Token と Guild ID は `.env` から読み込みます。

```bash
# .env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=123456789012345678   # サーバーを右クリック →「サーバーIDをコピー」で取得
```

## セットアップ

### Bot の権限追加

前回のセットアップではメッセージ関連の権限のみ付けていました。チャンネル管理を行うには、追加で `Manage Channels` と `View Channels` の権限が必要です。

https://discord.com/developers/applications

Discord Developer Portal の OAuth2 → URL Generator で権限を追加した URL を生成し、Bot を再招待すると権限が更新されます。

### Claude Code への登録

以下のコマンドで MCP サーバーを Claude Code に登録します。

https://code.claude.com/docs/en/mcp

```bash
claude mcp add --transport stdio --scope user discord-server-admin -- \
  uv run --directory /path/to/original-tools python -m discord_mcp.server
```

### 権限の自動許可

`~/.claude/settings.json` の `permissions.allow` に以下を追加すると、チャンネル削除以外のツールは確認なしで実行されます。

```json
{
  "permissions": {
    "allow": [
      "mcp__discord-server-admin__list_channels",
      "mcp__discord-server-admin__create_channel",
      "mcp__discord-server-admin__edit_channel",
      "mcp__discord-server-admin__create_category"
    ]
  }
}
```

削除だけは毎回確認が出るようにして、うっかり消してしまうのを防いでいます。

## 動作確認

Discord の Channels 経由で Claude Code にチャンネルの作成と削除を依頼してみました。

![](https://images.ryu-ki-learn.com/claude-code-discord-custom-mcp/discord-mcp-demo.png)

チャンネルの作成・削除ともに問題なく動作しています。access.json の自動更新が効いているので、作成したチャンネルでそのまま Bot とやり取りできます。

## ハマったポイント

### `--scope user` の指定漏れ

`claude mcp add` のデフォルトはプロジェクトスコープ（カレントディレクトリに紐づく設定）です。

| スコープ | 指定方法 | 有効範囲 |
|---------|---------|---------|
| プロジェクト（デフォルト） | `claude mcp add` | 登録したディレクトリのみ |
| ユーザー | `claude mcp add --scope user` | どのディレクトリからでも |

私は MCP サーバーのソースがあるディレクトリで `claude mcp add` を実行してしまい、普段使っている `~/Desktop/work` から MCP サーバーが見えなくなっていました。どこからでも使いたい場合は `--scope user` が必要です。

### `settings.json` と `.claude.json` の混同

`~/.claude/settings.json` にも `mcpServers` というキーを書けますが、MCP サーバーの登録先としては機能しません。

| ファイル | 用途 |
|---------|------|
| `~/.claude.json` | MCP サーバーの登録先（`claude mcp add` が書き込む先） |
| `~/.claude/settings.json` | 権限設定など（`mcpServers` を書いても認識されない） |

`claude mcp add` コマンドを使うか、`~/.claude.json` に直接書き込む必要があります。

## おわりに

ということで、公式プラグインにない機能を自作 MCP サーバーでサクッと補完してみました。（Claude Code さまさま）

今回はチャンネル管理だけですが、同じ仕組みでロール管理やメッセージの一括削除なども追加できます。Discord REST API のエンドポイントに対応するツール関数を書くだけなので、必要になったら拡張していこうと思います。

ありがとうございました。
