---
title: "【Codex】pet が見切れる問題を解決する"
description: "Codex app に pet と呼ばれるキャラクター機能が追加されました。/pet コマンドで画面上に呼び出すことができます。"
pubDate: 2026-05-05
tags: ['macOS', 'Electron', 'Codex']
qiitaId: 69fedda12fc751bcc415
importedDate: 2026-07-11
qiitaStats:
  views: 1665
  likes: 2
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

Codex app に pet と呼ばれるキャラクター機能が追加されました。`/pet` コマンドで画面上に呼び出すことができます。

https://x.com/OpenAIDevs/status/2050275713824211041

しかし、私の環境では pet が見切れたり、画面外にいるような状態になっていました。（スクリーンショットを撮り忘れた...）

どうしたものかと思っていたところ、以下のツイートを見かけました。

https://x.com/currypurin/status/2050712323841741223

内容としては、Codex の pet が表示されない、または見切れる場合、座標キャッシュが壊れている可能性があり、Codex を完全終了したうえで Electron 側の state/cache と `~/.codex/.codex-global-state.json` をバックアップ退避すると直るかもしれない、というものでした。

実際に試してみたところ、今のところうまくいっていそうなので、やったことを残しておきます。

## 前提環境

- macOS 26.2
- Codex デスクトップ版 26.429.30905（Build 2345）

## やったこと

今回やったことは以下です。

1. リセット前のバックアップを作成
2. Codex を完全終了
3. スクリプトで state/cache を `mv` 退避
4. Codex を起動して `/pet` を実行
5. 必要そうな Codex の UI 設定だけ一部復旧

## バックアップ用スクリプト

Codex の状態ファイルやキャッシュをいきなり削除するのは怖いので、後から戻せるように Desktop にバックアップを残す形にしました。内容としては、Codex が起動していたら処理を止め、対象のファイルやディレクトリが存在する場合だけバックアップフォルダへ `mv` するものです。

対象にしたパスは以下です。

```text
~/.codex/.codex-global-state.json
~/Library/Application Support/Codex
~/Library/Application Support/com.openai.codex
~/Library/Caches/Codex
~/Library/Caches/com.openai.codex
~/Library/Preferences/com.openai.codex.plist
~/Library/Saved Application State/com.openai.codex.savedState
~/Library/HTTPStorages/com.openai.codex
~/Library/HTTPStorages/com.openai.codex.binarycookies
~/Library/WebKit/com.openai.codex
```

参考にしたツイートの内容に沿って、Electron 側の state/cache と `~/.codex/.codex-global-state.json` を退避する形です。

## 実行結果

スクリプト実行し、以下を退避しました。

```text
Library__Application Support__Codex
Library__Caches__com.openai.codex
Library__HTTPStorages__com.openai.codex
Library__HTTPStorages__com.openai.codex.binarycookies
Library__Preferences__com.openai.codex.plist
.codex__.codex-global-state.json
```

存在しないパスもありましたが、今回は存在したものだけが退避されています。

その後 Codex を起動して `/pet` を実行したところ、pet の表示はうまくいっていそうでした。

## UI 設定を元に戻す

状態ファイルやキャッシュを退避したため、Codex の UI 設定も一部初期化されていました。（最近使ったワークスペースやサイドバーの状態、入力履歴など）

このあたりをいい感じに戻したいと思います。

### `.codex-global-state.json` を確認

現在のファイルと、バックアップ側のファイルを確認しました。

```bash
plutil -p ~/.codex/.codex-global-state.json
plutil -p ~/Desktop/codex-pet-reset-backup-20260505-032017/.codex__.codex-global-state.json
```

見たところ、以下のキーが pet の表示位置に関係していそうでした。

```text
electron-avatar-overlay-bounds
electron-avatar-overlay-open
```

特に `electron-avatar-overlay-bounds` には `x`、`y`、`width`、`height` などが入っていました。名前と中身を見る限り、pet の座標情報っぽいです。そのため、この値は戻さないことにしました。

### 戻したもの

今回は、pet の座標情報らしきものは戻さず、Codex の UI 設定として影響が小さそうなものだけ戻しました。

戻した主な設定は以下です。

- 最近使ったワークスペース一覧
- サイドバーの折りたたみ状態
- 入力履歴
- パネル幅やファイルツリー表示状態
- ターミナル表示状態
- プロジェクト順序

逆に、以下は戻していません。

- `electron-avatar-overlay-bounds`
- `electron-avatar-overlay-open`
- `Application Support/Codex` 配下の WebView / Cookie / Cache 類
- `Library/Caches` や `HTTPStorages` 類

確認してみると、pet の座標情報は現在の値を残したまま、ワークスペース一覧や入力履歴が戻っている状態になっていそうでした。

## おわりに

簡単ではありますが、Codex pet が画面外に行ったときに state/cache を退避して復旧した流れをまとめました。今のところ pet の表示はうまくいっていそうです。

![](https://images.ryu-ki-learn.com/codex-pet-offscreen-fix/pet-restored.png)

なお、今回はツイートで紹介されていた範囲をまとめて退避したため、どのファイルが効いたか個別の切り分けまではできていません。最小構成での再現はできていないものの、同じような状態になった方の参考になれば幸いです。

今度はオリジナルのペットを作ってみたいと思います。

ありがとうございました。
