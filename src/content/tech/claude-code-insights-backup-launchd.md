---
title: "【Claude Code】/insights のレポートが上書きされないように逃がしておきたい"
description: "Claude Code には /insights というコマンドがあり、過去のセッションを分析した使用状況レポートが HTML で生成されます。"
pubDate: 2026-05-02
tags: ['macOS', 'launchd', 'ClaudeCode']
qiitaId: 1fd91c4c68ef3f0a33d7
importedDate: 2026-07-11
qiitaStats:
  views: 1919
  likes: 5
  stocks: 2
  fetchedAt: 2026-07-11
---

## はじめに

Claude Code には `/insights` というコマンドがあり、過去のセッションを分析した使用状況レポートが HTML で生成されます。

https://qiita.com/ryu-ki/items/7748d48a725f742428b0

こちらの記事でも書いたのですが、試してみるとなかなか面白く、自分の Claude Code との付き合い方の傾向や、改善できそうなポイントが整理されていてためになります。

ただし、生成されるレポート（`report.html`）にはタイムスタンプが付かず、`/insights` を実行するたびに上書きされてしまいます。

そのため、コマンド実行時に既存レポートを退避するように依頼したのですが、容赦なく上書きされてしまいました。

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-backup-launchd/8b38f22b-5db9-4d95-b137-aaadce14a149.png)

「ファイル上書きしちゃったけどログはあるから気にすんなって！（意訳）」とのことです。

🤨

~~反省が見られずちょっとイラっとしたので~~不便なので、`/insights` を実行したら裏で自動的に日本語版 HTML を別ディレクトリに作って蓄積する仕組みを組んでみました。（あとついでに翻訳もしてもらうことにしました）

:::note warn
この「ついで」が大変だと気づくのはもう少し後のお話
:::

## 前提環境
- macOS 26.2（launchd を使うので macOS 限定です）
- Claude Code 2.1.126
- Python 3.13.11 / uv 0.9.24

## やりたいこと

整理するとこんな感じです。

- `/insights` 実行で `report.html` が更新されたら、それを検知する
- 同じ内容を翻訳した日本語版 HTML を作る
- 上書きしないようにタイムスタンプ付きのファイル名で別ディレクトリに保存する
- 翻訳は重いのでバックグラウンドで実行する
  - ただし、裏で何かやっていることはわかるようにしておきたい

## 仕組み

最初は Claude Code の Stop Hook でやろうと考えたのですが、Stop Hook が `/insights` の完了より早く発火してしまう（書き換え途中の `report.html` を掴んでしまう）という問題があり、Claude Code のライフサイクルに乗るのはよくなさそうと判断しました。

そこで、Claude Code から完全に切り離した macOS の launchd の `WatchPaths` で `report.html` を直接監視する形に切り替えています。launchd がファイル変更を検知してエージェントを別プロセスとして起動するので、Claude Code がいつ何をしているかに依存しません。

エージェント本体は Python スクリプトです。中身は以下の流れで動きます。

1. `report.html` の書き込みが落ち着くまでサイズの変化を監視する
2. BeautifulSoup で HTML をパースし、テキストノードだけ抽出する
3. テキストを4分割して、`claude -p`（ノンインタラクティブモード）の Haiku に並列で翻訳させる
4. 戻ってきた訳文を元の HTML に再注入し、別名で保存する
5. 開始・完了は macOS の通知センターのバナーで知らせる

ポイントは2と3で、HTML 全体を LLM に出力させると CSS や HTML タグまで律儀に書き直してくれて、出力トークン数が約18,000にもなり、Haiku でも3分以上かかってしまうのですが、テキストノードだけ抜き出して並列で投げると実測1分弱で終わります。

## 実装

### ディレクトリ構成

最終的にはこうなりました。

```text
~/.claude/
└── scripts/
    └── insights-translate.py        ← 翻訳本体（Python）
~/Library/LaunchAgents/
└── com.ryuki.insights-translate.plist  ← launchd 登録
~/.claude/usage-data/
├── report.html                      ← /insights が生成する元レポート
└── insights-ja/                     ← 日本語版 HTML を蓄積するディレクトリ
    ├── insights-2026-05-02_172938-ja.html
    └── ...
```

### 翻訳スクリプト

`~/.claude/scripts/insights-translate.py` を作ります。冒頭はこんな感じで、`# /// script` ブロックに依存関係を書いておきます。

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["beautifulsoup4"]
# ///
```

これは PEP 723 のインラインメタデータで、`uv run --script` で実行すると uv が依存関係（BeautifulSoup）を勝手に解決してくれます。仮想環境を切る手間がないので、こういう一発もののスクリプトと相性がいいですね。

https://peps.python.org/pep-0723/

ここから先はインポートやロックファイル制御、通知の関数定義など定型処理が続くのでバッサリ省略します。実際に翻訳の動作のポイントになるのは以下の3つの関数です。

1つ目は HTML からテキストノードだけ集める処理です。`<style>` や `<code>` の中身、それと `<!DOCTYPE html>` などは LLM に翻訳させたくないので除外しています。

```python
SKIP_TAGS = {"style", "script", "code", "pre"}

def collect_texts(soup: BeautifulSoup):
    items = []
    for elem in soup.find_all(string=True):
        if isinstance(elem, (Doctype, Comment)):
            continue
        if elem.parent.name in SKIP_TAGS:
            continue
        s = str(elem)
        if not s.strip():
            continue
        m = re.match(r"^(\s*)(.*?)(\s*)$", s, re.DOTALL)
        prefix, content, suffix = m.groups()
        items.append((elem, prefix, content, suffix))
    return items
```

2つ目は翻訳の本体です。テキストを `[0] Hello world` のように番号付きで `claude -p` に渡し、戻ってきた `[N]` 行を正規表現でパースして `{元の通し番号: 訳文}` の dict として返します。番号がついているので、戻ってきた順序が多少前後しても元の位置に再注入できます。

```python
def translate_chunk(chunk: list[tuple[int, str]]) -> dict[int, str]:
    payload = "\n".join(f"[{local}] {t}" for local, (_, t) in enumerate(chunk))
    prompt = (
        "次の番号付き英文を日本語に翻訳してください。要件:\n"
        "- 各行の [N] 番号は必ず保持する\n"
        "- 文体は「です・ます」体（敬体）で統一する\n"
        "- 各行は HTML テキストノードを抽出したもの。途中で文が切れていても、前後の行と自然に繋がるよう翻訳する\n"
        "- コード、識別子、ファイルパス、コマンド名、URL、数字は原文のまま\n"
        "- 翻訳後の行だけを出力（前置き・後置き・コードフェンスは付けない）\n\n"
        f"{payload}"
    )
    result = subprocess.run(
        ["claude", "-p", "--model", "haiku", prompt],
        capture_output=True, text=True, check=True,
    )
    # ... [N] パターンで結果をパースして辞書に戻す（省略） ...
```

3つ目は並列実行です。テキストノードを4分割して、`ThreadPoolExecutor` で4つの `translate_chunk` を同時に走らせます。これで所要時間が短くなります。

```python
def translate_parallel(texts: list[str], num_chunks: int = 4) -> dict[int, str]:
    indexed = list(enumerate(texts))
    chunk_size = (len(indexed) + num_chunks - 1) // num_chunks
    chunks = [indexed[i : i + chunk_size] for i in range(0, len(indexed), chunk_size)]

    merged: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=len(chunks)) as ex:
        for partial in ex.map(translate_chunk, chunks):
            merged.update(partial)
    return merged
```

メインの `main()` 関数では、これらを順番に呼び出して、最後に翻訳結果を `NavigableString` で元の HTML ツリーに再注入し、タイムスタンプ付きのファイルに書き出して終わりです。

### LaunchAgent の登録

LaunchAgent は macOS のバックグラウンドジョブ管理の仕組み（launchd）にユーザー単位のサービスを登録するもので、`~/Library/LaunchAgents/` に plist を置いておくとログイン時に自動で読み込まれます。今回はファイル監視（`WatchPaths`）の機能を使って、`report.html` が更新されたタイミングで Python スクリプトを起動してもらいます。

なお、launchd や plist の各キーの詳細は、以下のリファレンスサイトがわかりやすくまとまっています。

https://www.launchd.info/

今回は以下のような `~/Library/LaunchAgents/com.ryuki.insights-translate.plist` を作ります。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ryuki.insights-translate</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/uv</string>
        <string>run</string>
        <string>--script</string>
        <string>/Users/ryuki/.claude/scripts/insights-translate.py</string>
    </array>
    <key>WatchPaths</key>
    <array>
        <string>/Users/ryuki/.claude/usage-data/report.html</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/ryuki/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
```

`WatchPaths` の `report.html` が変更されると `ProgramArguments` の `uv run --script` が起動する、という流れです。

## 動作確認

`/insights` を実行してしばらく待つと、まず macOS の通知センターに「Insights 翻訳開始」のバナーが出ます。

![image.png](https://images.ryu-ki-learn.com/claude-code-insights-backup-launchd/b25bd690-95e6-4187-a170-38eb46354350.png)

`/insights` を実行してから日本語版 HTML が完成するまで、最終構成（テキスト抽出 + 4並列）で約57秒です。`/insights` を実行して Claude Code との対話に戻り、そのうちバナーで気づく、という温度感で運用できています。

ここに辿り着くまでの実測値の変遷を以下に示します。

| ファイル | 構成 | 開始 → 終了 | 所要時間 |
|---|---|---|---|
| `insights-2026-05-02_165127-ja.html` | Opus 全体 | 16:51:27 → 16:57:16 | 5分49秒 |
| `insights-2026-05-02_170035-ja.html` | Haiku 全体 | 17:00:35 → 17:03:57 | 3分22秒 |
| `insights-2026-05-02_172049-ja.html` | テキスト抽出（直列） | 〜17:18 → 17:20:49 | 約2分半 |
| `insights-2026-05-02_172938-ja.html` | テキスト抽出（4並列） | 17:28:41 → 17:29:38 | 57秒 |

なお、Opus 全体・Haiku 全体の行は bash スクリプト時代のもので、ファイル名にエンコードされた時刻が「処理開始時刻」、mtime が「処理終了時刻」になるため、両者の差分から所要時間を出しています。

テキスト抽出（4並列）の行は Python に切り替えて以降のもので、ファイル名の時刻が「処理終了時刻」を指すようになったため、`report.html` が更新された時刻（launchd が発火した瞬間）を「開始」、ja.html の mtime を「終了」として測っています。

テキスト抽出（直列）の行だけ「約2分半」と概算なのは、Python 移行直後にこの計測手法を整える前の試行で、開始時刻を残せていなかったためです。稼働中の `ps` で観測した `claude -p` の経過時間（2:31）から逆算しています。

## ハマったところ

ここに至るまでに何回か方針転換しています。同じことをやろうとする人の参考に、思考過程を残しておきます。

### Stop Hook は早すぎる

最初は Claude Code の Stop Hook で `/insights` の完了を捕まえようとしましたが、Stop Hook は `/insights` がレポートを書き終わる前にも発火してしまい、書き換え途中の `report.html` を読みに行ってしまいました。Claude Code のライフサイクルから切り離せる launchd に逃がしたら綺麗に解決しました。

### HTML 全体を LLM に翻訳させると遅い

最初は `report.html` の中身を丸ごと `claude -p` に流して、日本語版 HTML を受け取る構成にしていたのですが、これがデフォルトモデルの Opus で約6分弱、Haiku に切り替えても2〜3分かかります。出力するトークン数が単純に多いので（インライン CSS や HTML タグまで全部 LLM に書き直させているため）、モデルを変えても根本解決にならないという話ですね。

### テキストノードだけ抽出 + 並列化で1分弱に短縮

そこで BeautifulSoup でテキストノードだけ抜き出して翻訳する方式に変えました。これだけで翻訳対象のトークン数が大幅に減り、さらに4並列にすることで実測で約57秒まで縮みました。

### `<!DOCTYPE html>` が消える

BeautifulSoup の `find_all(string=True)` は DOCTYPE 宣言も `NavigableString` のサブクラスとして拾ってくるので、何も考えずにそれを `replace_with` で置き換えると `<!DOCTYPE html>` が壊れて、ブラウザが過去互換モードでレンダリングしてレイアウトが微妙に崩れます。`Doctype` と `Comment` は明示的にスキップする必要があります。

## おわりに

これで `/insights` を実行するたびに、過去のレポートが上書きで消えてしまうこともなくなり、別ディレクトリにタイムスタンプ付きで蓄積されるようになりました。（大変でしたが）おまけで日本語訳まで勝手に作ってくれるようになったのでひとまず満足といったところです。

また、今回採用した launchd の `WatchPaths` は「あるファイルが書き換わったら何か走らせたい」系の自動化に汎用的に使えるので、他の場面でもうまく使えればと思います。

ありがとうございました。
