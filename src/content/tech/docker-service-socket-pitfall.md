---
title: "【Docker】docker.service, docker.socketで大ハマりした話"
description: "docker.socket：自動起動する（preset; enableになっている）"
pubDate: 2024-12-16
updatedDate: 2025-01-18
tags: ['Docker']
qiitaId: 255fe26db2f6949cab61
importedDate: 2026-07-11
qiitaStats:
  views: 5645
  likes: 3
  stocks: 1
  fetchedAt: 2026-07-11
---

:::note info
2024/12/18 背景部分で勘違いをしていたことが分かったので修正いたしました。
:::

# はじめに
AWS EC2インスタンス内のDockerで立ち上げたWebアプリのcurlエラーの解決に苦戦したので備忘録を残します。
`docker.socket`の話だけ読みたい方は、背景を読み飛ばしてください。

# 背景
## curl: (56) Recv failure: Connection reset by peer が1か月以上解決しなかった話
docker内のFlaskで実装したAPIをEC2のcurlで定時実行させようとしたところ上記エラーが発生しました。また、1度curlを実行した後、再度実行するとうまくcurlが実行されました。

### 当時の状況
#### EC2インスタンス起動時
docker.service：自動起動しない（`preset; disabled`になっている）
![docker_service_disable.png](https://images.ryu-ki-learn.com/docker-service-socket-pitfall/060ef17f-6df9-4c79-a1ea-13899e85a7fe.png)

docker.socket：自動起動する（`preset; enable`になっている）
![docker_socket_enable.png](https://images.ryu-ki-learn.com/docker-service-socket-pitfall/d0e0a71f-7b46-a2c2-a249-4dd9ada8a89c.png)

#### Flaskが反応しなかった理由
**docker.service**
  → 自動起動しない
  → `docker compose`の`restart always`が効かない
  → Flaskが起動しない
  → curlが失敗する

#### dockerコマンドを打った後に使えるようになった理由
**docker.socket**
  → 自動起動している
  → `docker`コマンドを打つと、`docker.socket`に通信が飛んでいく
  → `docker.socket`は停止している`docker.service`を起動しようとする
  → `docker`コマンド実行後は、`docker.service`が起動して`restart always`が動き出す
  → Flaskが起動する
  → curlが成功する


### 当時の対応
以下コマンドを実行して、`docker.service`を自動起動するように設定しました。
```bash
sudo systemctl enable docker
```

実行後、以下のようにdocker.serviceが自動起動する設定にすることができ、無事エラーを解決することができました。
![docker_service_enable.png](https://images.ryu-ki-learn.com/docker-service-socket-pitfall/ed21887c-7ac3-b4f8-ee89-5d52c376b692.png)

### 余談
以下コマンドでステータス（現在の状態とプリセット）を一覧できます。
例はdocker関連の情報だけに絞って表示させています。
```bash
sudo systemctl list-unit-files | grep docker.s
```
![list_unit_files.png](https://images.ryu-ki-learn.com/docker-service-socket-pitfall/c5bfa16f-8cd3-5d8d-45f8-30ad9cc56d75.png)

# `docker.socket`とはなんぞや？
## 一言でいうと…
docker デーモンと（docker CLIなどの）クライアント間の通信を管理するコンポーネント

## そもそもDocker Engineの仕組みとは？
ドキュメントによると、Docker Engineは以下の3要素からなります。
- docker CLI
- REST API
- docker デーモン

![engine-components-flow.png](https://images.ryu-ki-learn.com/docker-service-socket-pitfall/3d0c03c4-5c46-9c68-9479-546b94b71367.png)
（参照：[Docker 概要 — Docker-docs-ja 1.12.RC2 ドキュメント](https://docs.docker.jp/v1.12/engine/understanding-docker.html#docker-engine)）

docker CLIで（`docker build`などの）コマンドを実行すると、UNIXソケットやTCPソケットを介して、docker デーモンにアクセスします。（ソケットパス：`/var/run/docker.sock`）`docker.socket`はそのソケットの設定を管理しているようです。

![architecture.png](https://images.ryu-ki-learn.com/docker-service-socket-pitfall/5cad7aa2-ffe1-95e8-6f36-8af1753fd670.png)
（参照：[Docker 概要 — Docker-docs-ja 1.12.RC2 ドキュメント](https://docs.docker.jp/v1.12/engine/understanding-docker.html#id6)）

気になったので中身も少し見てみました。
![docker_socket_content.png](https://images.ryu-ki-learn.com/docker-service-socket-pitfall/a04d4b89-c9be-befb-8bc2-6f7560973d0f.png)
- `ListenStream=/var/run/docker.sock`
    - リッスンする場所を指定しています。
    - docker CLIはこのソケット経由で通信が行われていそうです。

このように、ソケットに関する設定が記述されていることが分かりました。

# さいごに
今回は、`docker.socket`に関するエラーでハマったので、その際調べたことなどを記録しました。今回のような状態になってしまった理由などはわからずじまいですが、Dockerの仕組みについて学びなおすいいきっかけにはなったかなと思います。

# 参考文献
- [Docker 概要 — Docker-docs-ja 1.12.RC2 ドキュメント](https://docs.docker.jp/v1.12/engine/understanding-docker.html)
- [さわって理解するDocker入門 第6回 | オブジェクトの広場](https://www.ogis-ri.co.jp/otc/hiroba/technical/docker/part6.html)
- [Docker Engineとは何か](https://zenn.dev/ryoatsuta/articles/64dcc2e2b4e0cf#%E5%8F%82%E8%80%83%E6%96%87%E7%8C%AE)
- [Docker内部の仕組みについて手を動かして理解してみた](https://zenn.dev/sre_holdings/articles/239ab67a3d44a1)
- [Dockerデーモンに関するもう少し詳しい説明 | めもたんす](https://www.memotansu.jp/docker/377/)
