---
title: "【Claude Code】カスタムステータスラインがホームディレクトリで表示されない"
description: "Claude Code のカスタムステータスラインは、画面下部にコンテキスト残量や使用率、モデル名などを表示してくれる便利機能です。"
pubDate: 2026-05-04
tags: ['トラブルシューティング', 'ClaudeCode']
qiitaId: fa32472acb437bd2565a
importedDate: 2026-07-11
qiitaStats:
  views: 2945
  likes: 7
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

Claude Code のカスタムステータスラインは、画面下部にコンテキスト残量や使用率、モデル名などを表示してくれる便利機能です。

https://code.claude.com/docs/ja/statusline

私も `~/.claude/settings.json` に Python スクリプトを仕込んで、ずっと愛用しています。

![image.png](https://images.ryu-ki-learn.com/claude-code-statusline-home-issue/b2a24a2f-a2be-4387-8674-1d986bccd225.png)

ところが先日、ふとホームディレクトリで `claude` を起動したらステータスラインが表示されないことに気づきました。

![スクリーンショット 2026-05-03 15.04.05.png](https://images.ryu-ki-learn.com/claude-code-statusline-home-issue/ef7fdfc4-8352-4ec9-8442-f987957cbfae.png)

## 前提環境

- macOS Sequoia 26.2
- Claude Code 2.1.126
- Mac 標準ターミナル / VSCode のターミナル（どちらでも同じ現象を確認）

## 起きていた現象

`~/.claude/settings.json` にカスタムステータスラインを設定済みです。

```json
{
  "statusLine": {
    "type": "command",
    "command": "/opt/homebrew/bin/uv run --python 3.13 --script /Users/ryuki/.claude/statusline.py"
  }
}
```

しかし、起動するディレクトリによって表示されたりされなかったりします。気になるので原因を調べてみたいと思います。

## 切り分けの過程

順番に状況を切り分けて確認してみました。

### 仮説1：スクリプトが壊れている

まず疑ったのは自分のステータスラインスクリプト（Python）です。しかし、直接実行してみると普通に動きました。

```bash
echo '{"session_id":"test","model":{"display_name":"Opus"}}' \
    | /opt/homebrew/bin/uv run --python 3.13 --script ~/.claude/statusline.py

# 実行結果
# ~ | Model: Opus | Project: ryuki
```

### 仮説2：ターミナルウィンドウが小さすぎる

`tput lines` で行数を確認したら 24 行と出たので、「ステータスライン2行が描画領域から押し出されているのでは」と疑いました。

ところがこれは、Claude Code が呼び出した Bash サブシェルの値で、実際のターミナルの行数とは無関係でした。

### 仮説3：Mac 標準ターミナル特有の問題

私は Mac 標準ターミナルから起動していて、表示できている方の画面は VSCode のターミナルでした。「ターミナルアプリの違いか？」と思い、Mac 標準ターミナルから別プロジェクトで `claude` を起動してみました。

結果、Mac 標準ターミナルでもプロジェクトディレクトリなら問題なくステータスラインが表示されました。

### 結局：ワークスペーストラスト未承認

「ターミナルでもサイズでもなく、起動時の cwd だけが違いを生んでいる」としか考えられない状態になりました。

`~/.claude.json` を覗いてみると、過去に Claude Code を起動したディレクトリごとに信頼状態が記録されているのが見えました。

```bash
uv run --python 3.13 --no-project -- python <<'EOF'
import json
d = json.load(open('/Users/ryuki/.claude.json'))
p = d['projects']['/Users/ryuki']
print(f"hasTrustDialogAccepted: {p['hasTrustDialogAccepted']}")
EOF

# 実行結果
# hasTrustDialogAccepted: False
```

結局、ホームディレクトリだけワークスペーストラスト（workspace trust）が未承認のまま運用していたのが原因でした。（気づいたのは Claude）

公式ドキュメントを改めて読み直すと、statusline の項にしっかり書いてあります。

> The status line command only runs if you've accepted the workspace trust dialog for the current directory.
> If trust isn't accepted, you'll see the notification `statusline skipped · restart to fix` instead of your status line output.

https://code.claude.com/docs/en/statusline

訳すと、「ステータスラインのコマンドは、現在のディレクトリのワークスペーストラストダイアログを承認した場合のみ実行されます。Trust が承認されていない場合は、ステータスラインの出力の代わりに `statusline skipped · restart to fix` という通知が表示されます」とのことです。

言われてみれば、ステータスラインが表示されない代わりに `statusline skipped · restart to fix` という通知が出ていたので（本記事「はじめに」参照）、これに気づければもっと早く真相にたどり着けたかもしれません。

過去にホームディレクトリで `claude` を起動したとき、Trust ダイアログを受け入れずに通っていたようです。一方、各プロジェクトディレクトリでは初回起動時に Trust を選択していたため、`hasTrustDialogAccepted: True` になっていました。

## 対処（特に何もしない）

ホームディレクトリ全体を Trust すると、`~/.ssh/`、`~/.aws/credentials` など機密情報の塊が「事前承認済み」扱いになります。セキュリティ上のリスクが大きく Trust しない方がいいのかなと思うので、ステータスラインが出せないのは仕方ないとしたいと思います。

## おわりに

「ステータスラインが表示されない」と聞くと、つい `statusLine` の設定や Python スクリプト、ターミナルの能力あたりを疑いたくなりますが、実はそのディレクトリが Trust されているかどうかがポイントだったというお話でした。

`~/.claude.json` の `projects.<path>.hasTrustDialogAccepted` をチェックするだけでわかるので、もし同じ現象に出会ったら覗いてみてください。

ありがとうございました。
