---
title: "【Dev Container】今更 Dev Container に入門して Python 環境を用意してみる"
description: "ローカルで色々開発していると、環境がぐちゃぐちゃになりよくないという話は耳にタコができるほどよく聞くかと思います。"
pubDate: 2026-01-18
updatedDate: 2026-01-19
tags: ['Python', 'devcontainer']
qiitaId: 49c84bb533c4064bdbd6
importedDate: 2026-07-11
qiitaStats:
  views: 6077
  likes: 6
  stocks: 5
  fetchedAt: 2026-07-11
---

## はじめに

ローカルで色々開発していると、環境がぐちゃぐちゃになりよくないという話は耳にタコができるほどよく聞くかと思います。

しかし、私は今まで WSL を用いており、最悪 WSL ごとリセットすればよいと考えており特に気にしたことがありませんでした。

今回、開発用のPCを購入し、ちゃんと隔離した環境でコードを実行したい需要が出たので Dev Container に入門してみたいと思います。

## Dev Container とは

コンテナ内に開発環境を構築する仕組みです。
VS Code が Docker コンテナを開発環境として利用できるようにします。

https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers

### メリット

以下のような点がメリットかと思います。

| メリット | 説明 |
|---------|------|
| 環境の再現性 | チームメンバー全員が同じ環境で開発できる |
| ホスト環境を汚さない | Python、Node.js などがローカルに散らばらない |
| セットアップが簡単 | `git clone` → VS Code で開くだけ |
| 依存関係の分離 | プロジェクトごとに異なるバージョンを使える |

## 使用するツール

- uv：Rust製の高速パッケージマネージャー（pip の代替）
- ruff：Rust製の高速リンター＆フォーマッター

https://docs.astral.sh/uv/

https://docs.astral.sh/ruff/

## 前提条件

以下がインストール済みであることを前提とします（インストール方法は割愛）。

- Docker Desktop
- VS Code
- VS Code 拡張機能「Dev Containers」

## ディレクトリ構成

以下のような構成になっています。

```
your-project/
├── .devcontainer/
│   ├── devcontainer.json    # 設定ファイル
│   └── Dockerfile           # カスタムイメージ
└── pyproject.toml           # Python プロジェクト設定
```

## 各ファイルの作成

### Dockerfile

```dockerfile
FROM mcr.microsoft.com/devcontainers/python:3.12

# uv インストール（公式イメージからコピー）
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# キャッシュ効率化
ENV UV_LINK_MODE=copy
```

ポイントは以下2点です。
- Microsoft公式のPythonイメージをベースに使用
- uv は公式イメージからバイナリをコピーするだけでOK（apt不要で高速）

### devcontainer.json

```json
{
  "name": "Python Dev",
  "build": {
    "dockerfile": "Dockerfile"
  },
  "customizations": {
    "vscode": {
      "settings": {
        "[python]": {
          "editor.defaultFormatter": "charliermarsh.ruff",
          "editor.codeActionsOnSave": { "source.fixAll": "always" }
        },
        "editor.formatOnSave": true,
        "python.defaultInterpreterPath": ".venv/bin/python"
      },
      "extensions": [
        "ms-python.python",
        "charliermarsh.ruff"
      ]
    }
  },
  "mounts": [
    "source=${localEnv:HOME}/.aws,target=/home/vscode/.aws,type=bind"
  ],
  "postCreateCommand": "uv sync"
}
```

ポイントは以下の通りです。
- `customizations.vscode.extensions`
  - コンテナ起動時に自動インストールされる拡張機能
- `customizations.vscode.settings`
  - VS Code の設定（保存時自動フォーマットなど）
- `mounts`
  - ホストの `~/.aws` をマウントしてAWS認証情報を共有
- `postCreateCommand`
  - コンテナ作成後に `uv sync` で依存関係をインストール

設定できる項目の詳細については以下ドキュメントをご参照ください。

https://containers.dev/implementors/json_reference/

### pyproject.toml

```toml
[project]
name = "my-project"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "bedrock-agentcore",
    "boto3",
    "botocore[crt]",
    "python-dotenv",
    "strands-agents",
]

[dependency-groups]
dev = ["ruff", "pytest"]

[tool.ruff]
line-length = 120
```

一旦使いそうなものを `dependencies` に記載しています。私は `aws login` をよく使うのですが、 `botocore[crt]` がないとうまく動作しないので同様の方は気をつけましょう。

https://qiita.com/moritalous/items/482b1e0a7418652568e0

## 使い方

### 1. VS Code でフォルダを開く

```bash
code /path/to/your-project
```

### 2. コンテナで開き直す

左下の `><` アイコンをクリック → 「コンテナで再度開く」 を選択

![スクリーンショット 2026-01-18 12.52.14.png](https://images.ryu-ki-learn.com/devcontainer-python-setup/5a9d73e4-0fc7-4166-92bf-e97cf4efcc4c.png)

初回は Docker イメージのビルドに時間がかかりますが、2回目以降はキャッシュが効いて高速です。

### 3. 開発開始

コンテナが起動すると `uv sync` が自動実行され、`.venv` が作成されます。あとは普通にコードを書きましょう。

## テンプレートリポジトリ化

毎回ファイルを作るのは面倒なので、GitHub のテンプレートリポジトリにしておくと便利です。(と Claude Code に教えてもらいました)

### テンプレートリポジトリの作成

```bash
# リポジトリ作成
gh repo create python-devcontainer-template --private --clone
cd python-devcontainer-template

# .devcontainer と pyproject.toml を配置
# （省略）

# プッシュ
git add -A && git commit -m "初期テンプレート" && git push

# テンプレートリポジトリとして設定
gh repo edit --template
```

### テンプレートから新規プロジェクトを作成

```bash
gh repo create my-new-project --private --template your-username/python-devcontainer-template --clone
cd my-new-project
code .
```

これだけで、Dev Container 環境が整ったプロジェクトがすぐに使えます。

...が、これだけでと言いながらめんどくさかったので、 スキルにして Claude Code に渡しています。

<details>
<summary>スキル（長いので折りたたみ）</summary>

```md
# 新規プロジェクト作成スキル

GitHub テンプレート `ryuki-imachi/python-devcontainer-template` から新しいプロジェクトを作成します。

## 使い方

/new-project プロジェクト名

## 手順

1. **リポジトリ作成**: GitHub テンプレートからプライベートリポジトリを作成してクローン

gh repo create $ARGUMENTS --private --template ryuki-imachi/python-devcontainer-template --clone

2. **ディレクトリ移動**: 作成したプロジェクトに移動

cd $ARGUMENTS

3. **pyproject.toml更新**: プロジェクト名を更新

`pyproject.toml` の `name` フィールドを `$ARGUMENTS` に変更してください。

4. **完了報告**: 以下を報告

- 作成されたリポジトリのURL
- プロジェクトの構成
- 次のステップ（VS Code で開く、依存関係追加など）

## 注意事項

- `gh` コマンド（GitHub CLI）が必要です
- GitHub 認証が済んでいる必要があります
- プロジェクト名は小文字・ハイフン・数字のみ推奨
```

</details>


## まとめ

以上簡単ではありますが Dev Container に入門してみました。思っていたよりも簡単に扱えていい感じです。

また、テンプレートリポジトリにしたおかげで、新規プロジェクトの立ち上げも簡単にできました。

今後有効活用していきたいと思います。
ありがとうございました。
