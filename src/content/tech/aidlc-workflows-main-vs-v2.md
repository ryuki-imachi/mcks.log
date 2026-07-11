---
title: "【AI-DLC】aidlc-workflows の v2 が生えていたので差分を見てみた"
description: "AWS が公開している awslabs/aidlc-workflows という、AI 駆動の開発ライフサイクル（AI-Driven Development Life Cycle、以…"
pubDate: 2026-06-01
updatedDate: 2026-06-23
tags: ['AWS', 'プロンプトエンジニアリング', 'ClaudeCode', 'Kiro', 'AI-DLC']
qiitaId: 6ed097f5bf99d3d2b5a7
importedDate: 2026-07-11
qiitaStats:
  views: 8539
  likes: 15
  stocks: 2
  fetchedAt: 2026-07-11
---

## はじめに

AWS が公開している `awslabs/aidlc-workflows` という、AI 駆動の開発ライフサイクル（AI-Driven Development Life Cycle、以下 AI-DLC）を回すためのワークフローをご存知でしょうか。

https://github.com/awslabs/aidlc-workflows

なんとなく眺めていたら、`main` ブランチと `v2` ブランチが両方アクティブに更新されていて、しかも構造がガラッと違うことに気づきました。今回はその差分を整理してみたいと思います。

なお、AI-DLC 自体の概要については以前別の記事で扱っているので、本記事ではブランチ間の差分に絞って書きます。

https://qiita.com/ryu-ki/items/a70ec13e4b622a37cd6f

また、ドキュメントとリポジトリ構造を読んだだけのレベル感での整理で、実プロジェクトで v2 版を使ったわけではないのでご了承ください。

## main ブランチの構造

main ブランチは複数の AI コーディングエージェントに対応したルールファイル群（Markdown）というのが実態です。

ディレクトリ構造は以下の通りです。

```text
aidlc-rules/
├── aws-aidlc-rules/          # コアワークフロー本体（中身は Markdown）
└── aws-aidlc-rule-details/   # フェーズごとの詳細ルール
    ├── common/
    ├── inception/            # 要件定義フェーズ
    ├── construction/         # 実装フェーズ
    ├── operations/           # 運用フェーズ
    └── extensions/           # セキュリティ等の拡張ルール
```

Kiro、Claude Code、GitHub Copilot、OpenAI Codex などの多くのコーディングエージェントで扱うことができます。（単なるステアリングファイルなので当たり前かもしれませんが）

導入方法もシンプルで、リリースページから zip をダウンロードして、自分の使うツール向けの所定のパスにコピーするだけです。Claude Code であれば以下のように `CLAUDE.md` にコアワークフローを丸ごとコピーします。

```bash
cp aidlc-rules/aws-aidlc-rules/core-workflow.md ./CLAUDE.md
cp -R aidlc-rules/aws-aidlc-rule-details .aidlc-rule-details/
```

つまり、ステアリングファイルにベタガキする方式ですね。

## v2 ブランチの構造

一方の v2 はかなり毛色が違います。エージェント + スキル方式に作り替えられています。

```text
src/
├── kiro/
│   └── agents/
│       ├── aidlc-builder-agent.json     # 生成担当のエージェント
│       └── aidlc-validator-agent.json   # 検証担当のエージェント
└── skills/                              # 15個のスキルに分割
    ├── aidlc-intent-bootstrap/
    ├── aidlc-requirements-analysis/
    ├── aidlc-user-stories/
    ├── aidlc-functional-design/
    ├── aidlc-application-design/
    ├── aidlc-wireframes/
    ├── aidlc-infrastructure-design/
    ├── aidlc-nfr-assessment/
    ├── aidlc-nfr-design/
    ├── aidlc-owasp/
    ├── aidlc-code-generation/
    ├── aidlc-units-generation/
    ├── aidlc-reverse-engineering/
    ├── aidlc-orchestrator/
    └── aidlc-workflow-composition/
```

main では `inception` `construction` `operations` という大きな 3 フェーズだったものが、15 個のスキルに細かく分割されています。生成担当の `builder` と検証担当の `validator` という 2 つのエージェントが連携して回す設計です。

:::note warn
ただし対応プラットフォームは Kiro IDE / Kiro CLI のみで、README では `make build-kiro` で配布物を生成する手順が案内されています。README には他プラットフォームへの拡張は将来対応と書かれています。（普段使いしているAIエージェントに頼めば対応する形に変換してくれそうですね）
:::

## 差分まとめ

並べて整理するとこんな感じです。

| 観点         | main              | v2                  |
| ---------- | ----------------- | ------------------- |
| 対応ツール      | 7種類               | Kiro 専用             |
| 配布方式       | zip コピー           | `make build-kiro` 推奨 |
| 構造         | ルールファイル（Markdown） | エージェント + スキル        |
| フェーズ分割     | 3 フェーズ            | 15 スキル              |
| 自己検証       | ルールに記述            | validator エージェントが担当 |
| セキュリティ     | security 拡張ルール    | `aidlc-owasp` スキル    |

## main と v2 を比較考察してみる

AI-DLC のキャッチフレーズに `Humans codify the judgement. AI orchestrates and self-verifies — deterministically.` というものがあります。判断基準は人間が決めて、その実行と自己検証は AI に任せる、という思想です。main と v2 は、この同じ思想に対するアプローチが違います。観点ごとにトレードオフを整理してみます。

:::note
余談ですが Claude も含めて LLM の出力は本質的に確率的なので、`deterministically` を厳密な意味で達成するのは無理です。ここで言う「決定的」は、人間が承認ゲートを挟んでバラつきを抑える、くらいの意味と認識しています。
:::

### ルールが効く確実性

main はルールが全部 `CLAUDE.md` に乗っていて、AI は常にそれを参照しながら動きます。手順が固定的でルールがそもそも読み込まれていないという事態が起きにくいのは強みです。ただし、与えさえすれば必ず守られるとは限りません。規模が大きくなるとプロンプトを圧迫し、モデルが中央部を無視する問題（Lost in the middle）なども起こり得ます。

一方 v2 では、今どのスキルを呼ぶべきかをまず AI が判断するステップが増えます。ここを誤れば本来通るべきフェーズがスキップされるリスクはあります。ただ、必要なスキルだけをその都度ロードする方式なので、呼び出された後はそのフェーズのルールがコンテキスト内でしっかり効くと思います。これは巨大なルール集をそのまま与えている main とは対照的かと思います。加えて v2 には `aidlc-orchestrator` や `aidlc-workflow-composition` といったスキル選択・合成を担うスキルが用意されていて、ルーティングのブレをこの層で吸収しようとする設計に見えます。

### 自己検証のしやすさ

生成と検証を別の役に分けること自体は、コーディングエージェントのサブエージェント機能などを使えば main のほうでも自分で組めます。そのため、違いはそれが最初から整備されているかどうかという話になりそうです。main はルールを与えるだけなので、検証役を別に立てるかどうかは利用者やツール側に委ねられます。一方 v2 は、生成役の `builder` と検証役の `validator` を別々のエージェントとして定義済みで、builder が作ったものを validator が別の立場でチェックする流れが最初から用意されています。キャッチフレーズの `self-verifies`（AI が自分で検証する）を、追加の手間なく形にしているのは v2 のほうと言えそうです。

### 整理すると

main の強みは構造が単純なぶんルールが確実に読み込まれること、そして対応ツールの広さと導入の手軽さになると思います。v2 の強みは、コンテキスト効率の良さと、生成役・検証役を分けて、作ったものを別の役がチェックする流れを仕組みに組み込んでいることかと思いました（将来的には v2 も導入は手軽になっていくと思います）。同じ目的に対してそれぞれ別ルートで近づこうとしているのが面白いところだなと思いました。

## おわりに

ドキュメントとリポジトリを追っていただけでも、生成 AI をルールでまとめて縛るか、スキルに分業させるかという設計の違いが見えてなかなか興味深かったです。

AWS 公式が出している方法論なのでベストプラクティスだろう、と思って眺め始めましたが、実際にはまだ模索中の領域なんだなと感じました。私自身は Claude Code 中心で動いているので、まずは main の `CLAUDE.md` 方式で AI-DLC を試しつつ、機会があれば v2 版を自作して（もしくは公式から出されるのを待って）出力のブレ幅を比べてみたいです。

ありがとうございました。
