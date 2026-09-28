---
title: "【OpenTelemetry】grafana/otel-lgtm から OTel 入門してみたい"
description: "突然ですが、勉強がてらコーディングエージェントのテレメトリを OpenTelemetry（以下 OTel）で収集したくなりました。"
pubDate: 2026-09-28
tags: ['grafana', 'Loki', 'OpenTelemetry', 'tempo', 'observability']
qiitaId: 2132064879c7f3867cbd
importedDate: 2026-09-29
qiitaStats:
  views: 79
  likes: 0
  stocks: 0
  fetchedAt: 2026-09-29
---

## はじめに

突然ですが、勉強がてらコーディングエージェントのテレメトリを OpenTelemetry（以下 OTel）で収集したくなりました。

調べてみると、otel-lgtm というコンテナがあり、こちらを使えばローカル完結でその仕組みを用意できそうです。

https://github.com/grafana/docker-otel-lgtm

とりあえず使うこともできると思いますが、どういう仕組みで動いているのか気になります。

この記事では、otel-lgtm のコンテナの中身を覗きながら、Grafana スタックの構成とテレメトリが流れる経路を整理します。

## Grafana とは何か

Grafana は、さまざまなデータソースに接続してクエリ結果をグラフやダッシュボードとして表示する OSS の可視化ツールです。

https://grafana.com/oss/grafana/

Grafana 自身はデータを保存しません。Prometheus や CloudWatch、MySQL といった外部のデータソースにクエリを投げて、返ってきた結果を描画するのが仕事です。見る専（見せる専？）なんですね。

保存を担うコンポーネントとして、Grafana Labs（Grafana を開発している会社）はテレメトリの種類ごとに専用のデータベースを OSS で揃えています。

## LGTM スタックの役割分担

Grafana Labs のスタックは、頭文字を取って LGTM スタックと呼ばれています。Loki・Grafana・Tempo・Mimir の4つです。コードレビューでおなじみの「Looks good to me」と同じ略語で、Grafana Labs のブログでもこれにかけて紹介されています。

https://grafana.com/blog/grafana-labs-open-source-projects-2022/

Grafana 以外はそれぞれ専用のクエリ言語を持っていますが、この記事では名前の紹介にとどめます。

| 頭文字 | コンポーネント | 担当 | クエリ言語 |
|---|---|---|---|
| L | Loki | ログ | LogQL |
| G | Grafana | 可視化 | - |
| T | Tempo | トレース | TraceQL |
| M | Mimir | メトリクス | PromQL |

### Loki（ログ）

ログ集約システムです。公式サイトでは「Prometheus にインスパイアされたログ版」と説明されていて、ログ本文の全文インデックスを作らず、ラベル（`service_name` など）だけをインデックスする設計が特徴です。そのぶん軽くて運用が楽、という思想です。

https://grafana.com/oss/loki/

### Tempo（トレース）

分散トレースのバックエンドです。トレース ID による検索を基本にすることで、こちらもインデックスを最小限にしてストレージコストを抑える設計になっています。

https://grafana.com/oss/tempo/

### Prometheus と Mimir（メトリクス）

メトリクスの保存を担うのは時系列データベースです。

この分野では Prometheus という OSS が広く使われているそうです。Prometheus は Grafana Labs 製ではなく CNCF のプロジェクトで、メトリクスの収集・保存と、PromQL というクエリ言語での検索を担います。Grafana のデータソースとしても代表格のようです。

https://prometheus.io/

一方、LGTM の M は Mimir を指します。Mimir は Prometheus を水平スケールできるようにした Grafana Labs 製のバックエンドで、クエリ言語は Prometheus と同じ PromQL です。

https://grafana.com/oss/mimir/

そして otel-lgtm イメージでメトリクスを受け持っているのは、Mimir ではなく素の Prometheus です。ローカル検証ならスケールが不要で Prometheus 本体で十分、という判断だと思われます。

## 動作環境

| 項目 | バージョン |
|---|---|
| macOS | 26（Apple Silicon） |
| Docker Engine | 29.1.3（Docker Desktop） |
| grafana/otel-lgtm | latest（2026-08-29時点） |

## grafana/otel-lgtm を覗く

ここから、起動中のコンテナに入って中身を見ていきます。

### 1コンテナに入っているもの

コンテナ内の `/otel-lgtm/` を覗いてみると以下のような構成になっています。

```bash
docker exec otel-lgtm ls /otel-lgtm/
# 実行結果（抜粋）
# grafana/  loki/  tempo/  prometheus/  pyroscope/  otelcol-contrib
# run-all.sh  run-grafana.sh  run-loki.sh  run-tempo.sh
# run-prometheus.sh  run-pyroscope.sh  run-otelcol.sh
# otelcol-config.yaml  loki-config.yaml  tempo-config.yaml
# prometheus.yaml  pyroscope-config.yaml
```

各コンポーネントのバイナリと、それぞれの起動スクリプト、設定ファイルが同じ階層に並んでいます。LGTM の4つに加えて、OTel Collector と Pyroscope も入っています。

なお、Pyroscope は、CPU 時間やメモリをコードのどの関数が消費しているかを記録するプロファイリングのデータを保存するバックエンドです。

https://grafana.com/oss/pyroscope/

イメージサイズは 3.41GB となっていました。

### 起動の仕組み

エントリーポイントは `run-all.sh` というシェルスクリプトです。

6つのコンポーネントをバックグラウンドジョブとして並列起動し、それぞれのヘルスチェック URL（Grafana なら `/api/health`、Loki なら `/ready` など）を1秒間隔でポーリングします。

全コンポーネントが200を返したら `/tmp/ready` というファイルを作って起動完了、という流れです。

![run-all.sh の起動の流れ](https://images.ryu-ki-learn.com/grafana-otel-lgtm-anatomy/startup-sequence.png)

起動が終わると、各コンポーネントの起動時間のサマリが出力されます。

```text
Waiting for the OpenTelemetry collector and the Grafana LGTM stack to start up...
Prometheus is up and running. Startup time: 1 seconds
Otelcol is up and running. Startup time: 1 seconds
Tempo is up and running. Startup time: 2 seconds
Loki is up and running. Startup time: 3 seconds
Pyroscope is up and running. Startup time: 4 seconds
Grafana is up and running. Startup time: 7 seconds
Total startup time: 7 seconds
The OpenTelemetry collector and the Grafana LGTM stack are up and running. (created /tmp/ready)
```

この `/tmp/ready` は起動完了の目印になっていて、公式リポジトリの Kubernetes 例では readinessProbe（`cat /tmp/ready`）としてこのファイルを確認しています。

docker compose から使う場合も、healthcheck でこのファイルを見るようにすれば、コンテナが healthy になった時点で全コンポーネントの準備が済んでいることを保証できます。

なお、イメージ自体にも HEALTHCHECK が組み込まれていて、そちらは各コンポーネントのヘルスエンドポイントを直接確認する作りです。

起動を待つだけではなく、ヘルスチェックが通る前にコンポーネントのプロセスが終了していたら全体をエラーで即終了する fail fast の作りになっていて、SIGTERM を受けたときに全ジョブへ転送して安全に停止する処理も入っています。

### Collector の設定を読む

テレメトリの交通整理を担うのが OTel Collector です。

アプリから OTLP（OpenTelemetry Protocol。OTel のテレメトリを送受信するための標準プロトコル）でテレメトリを受け取り、バックエンドへ振り分ける役割を持ちます。

設定ファイル `otelcol-config.yaml` の骨格は以下の通りです。

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:

exporters:
  otlp_http/metrics:
    endpoint: http://127.0.0.1:9090/api/v1/otlp
  otlp_http/traces:
    endpoint: http://127.0.0.1:4418
  otlp_http/logs:
    endpoint: http://127.0.0.1:3100/otlp

service:
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp_http/metrics]
    # traces / logs も同じ形
```

receivers で4317（gRPC）と4318（HTTP）の2つの受信エンドポイントを開けて、processors でテレメトリをバッチにまとめ、exporters でシグナルごとに同一コンテナ内の保存先へ OTLP のまま転送する構成です。

送り先はそれぞれ、メトリクスが Prometheus（9090）、トレースが Tempo（4418）、ログが Loki（3100）です。

このうちメトリクスの送り先パスは `/api/v1/otlp` になっています。これは Prometheus が OTLP を直接受け取るためのエンドポイントで、Prometheus の起動スクリプトを見ると次のフラグで有効化されていました。

```bash
./prometheus/prometheus \
  --web.enable-otlp-receiver \
  --web.enable-remote-write-receiver \
  --enable-feature=exemplar-storage \
  ...
```

`--web.enable-otlp-receiver` が OTLP 受信の有効化フラグです。これで Collector から先も OTLP のまま受け渡しできるようになっています。

https://prometheus.io/docs/guides/opentelemetry/

### テレメトリが流れる経路

ここまでを整理すると、テレメトリの経路は以下の通りになります。

![otel-lgtm 内のテレメトリの経路](https://images.ryu-ki-learn.com/grafana-otel-lgtm-anatomy/otel-lgtm-telemetry-flow.png)

送る側のアプリは Collector のエンドポイントだけ知っていればよく、保存先の3つへは Collector が振り分けてくれます。Grafana は3つの保存先をデータソースとして登録済みで、クエリした結果を表示します。

ちなみに環境変数 `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` などを渡すと、ローカル保存に加えて外部のバックエンドへ同じテレメトリを転送する設定も自動生成されます。ローカルで見つつ本命の監視基盤にも送る、という二段構えもできるようになっています。

## 起動と画面の確認

最後に、起動まわりを確認しておきます。動かすだけなら docker run 一発です。

```bash
docker run -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
```

`http://localhost:3000` で Grafana が開き（初期ユーザーは admin / admin）、データソースには Prometheus・Loki・Tempo・Pyroscope が最初から登録されています。あとは手元のアプリのテレメトリを `http://localhost:4318` に向ければ、そのまま流れ込んできます。

![データソースが最初から登録されている](https://images.ryu-ki-learn.com/grafana-otel-lgtm-anatomy/grafana-datasources.png)

:::note
なお、公式リポジトリにも明記されていますが、このイメージは開発・デモ・検証用です。データの永続化や冗長化を考える段階になったら、コンポーネントを個別に立てる構成（あるいは Grafana Cloud）に移行することになります。
:::

## おわりに

以上、grafana/otel-lgtm の中身を一通り覗いてみました。蓋を開けてみれば、6つの OSS をシェルスクリプトで束ねた構成で、OTLP の受信から可視化までが1コンテナで完結する便利な代物かと思います。

肝心のコーディングエージェントのテレメトリを流し込む話も、そのうち別の記事に書きたいと思います。

ありがとうございました。
