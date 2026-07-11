---
title: "【AI-DLC】ホワイトペーパーと実際のworkflowって結構違いそう？"
description: "少し前にAWSから新しい開発ライフサイクルとして、AI-DLCというものが発表されました。"
pubDate: 2026-05-11
tags: ['AWS', 'AI駆動開発', 'AI-DLC']
qiitaId: 4adeb3eb114113831ce8
importedDate: 2026-07-11
qiitaStats:
  views: 988
  likes: 3
  stocks: 0
  fetchedAt: 2026-07-11
---

## はじめに

少し前にAWSから新しい開発ライフサイクルとして、AI-DLCというものが発表されました。

https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/

この考え方の大まかな流れは以下で解説しています。

https://qiita.com/ryu-ki/items/a70ec13e4b622a37cd6f

このAI-DLCはホワイトペーパー版とGitHubで公開されている実装版が存在します。

https://prod.d13rzhkk8cj2z0.amplifyapp.com/

https://github.com/awslabs/aidlc-workflows

両方を読み比べてみると、意外と書かれていることが違っているように感じました。本記事では、ホワイトペーパーと OSS 実装の差分を整理してみたいと思います。

## 対象の違い

両者を読んで、そもそも見ている対象が違いそうだと感じました。

| 観点 | ホワイトペーパー版 | OSS版 |
|---|---|---|
| 主に描いている対象 | 人間チームの動かし方（5〜7名・物理集合・3〜5日専任を前提とする同期プロセス） | AIコーディングエージェントの動かし方（IDE/CLI に配置する Markdown ルール） |
| 中核の儀式 | Mob Elaboration / Mob Construction（同期・対面前提） | Steering Rules + 段階承認（非同期・チャット駆動） |
| 用語 | Intent / Unit / Bolt（時間圧縮を語る用語） | Intent / Unit は引き継がれているが、Bolt の記述は特になく、代わりに Stage / Plan / Approval という実装用語を追加 |
| ブラウンフィールド対応 | 既存コードを「意味モデル」（コンポーネント関係や相互作用）に変換してから AI に渡せ、という理論的推奨。具体手順は未提示 | 「グリーン/ブラウン判定 → 既存コードを読んで Markdown に要約」という具体ステージを実装（Workspace Detection + Reverse Engineering） |
| 成果物 | Deployment Unit（抽象） | aidlc-docs/ 配下の Markdown 群（具体的なファイル構造） |

ホワイトペーパーは「チームをどう集めて、どう議論させるか」という人間プロセスを主に描いていて、OSS版は「AIエージェントが何ステージをどう実行するか」というワークフロー詳細を主に描いている、という風に読めました。

## 差分の一覧

ざっと差分をあげてみました。詳述は次章で行います。

| # | 差分 | ホワイトペーパー版 | OSS版 |
|---|---|---|---|
| 1 | 階層分解 | Level 1/2/n Plan（再帰分解） | フェーズの中にステージが並ぶだけ（再帰分解なし） |
| 2 | PR/FAQ | Inception 成果物として明示 | 無し |
| 3 | ブラウンフィールド対応 | 静的/動的モデルへの昇格を推奨 | コードを読んで Markdown に要約 |
| 4 | 承認ゲート | 同期モブで一括決定 | 1 Bolt あたり複数回実施 |
| 5 | 質問形式 | 対話的な質問 | `[Answer]:` タグ付きの構造化 |
| 6 | Content Validation | 言及なし | バリデーション必須 |
| 7 | Extension 機構 | 言及なし | extensions/ 配下に opt-in 拡張 |
| 8 | Session Continuity | 人間の脳が記憶 | aidlc-state.md, audit.md などのドキュメントに記録 |
| 9 | Operations Phase | 詳細記述 | placeholder（空） |
| 10 | テネット | 暗黙的 | 5原則を明示 |
| 11 | ドキュメント | 議論内容は文書化されない | Documentation-First |

## 特に違いそうな観点

ここからは、上記差分のうち、特に違いそうな観点を取り上げて、もう少し掘り下げてみます。

### 1. テネット（基本理念）の明示

ホワイトペーパー側には、テネットや基本理念として明文化された記述は見当たりません。「Mob Elaboration が機能する組織文化があれば」という前提は暗黙的に置かれています。

一方、OSS版の README には5つのテネットが明示されています。

1. No duplication：情報の出典（Source of Truth）は一箇所に集約
2. Methodology first：ツールではなく方法論
3. Reproducible：異なるモデルでも似た結果が出るよう設計
4. Agnostic：IDE、エージェント、モデルに非依存
5. Human in the loop：重要決定は明示的なユーザー確認

https://github.com/awslabs/aidlc-workflows/blob/main/README.md#L679-L687

ホワイトペーパーが暗黙にしていた「組織文化前提」を、OSSは「Agnostic」（非依存）として切り離し、特定の IDE・エージェント・モデルに縛らない設計を宣言した、という風に読めます。チーム規模や働き方を選ばず使える、という設計意図が明文化されているのが特徴的でした。（AI-DLCはチームですることに意義があるとされていますが、1人でも全然できてしまいます）

### 2. 階層分解（Level n Plan）の有無

ホワイトペーパー側では、Level 1 → Level 2 → Level n と再帰的に作業を分解する考え方が提示されています。

OSS版では、再帰分解の概念は明示されていません。Inception → Construction の2階層になっており、各フェーズの中ではステージが順番に並ぶ構造になっています。

代わりに、OSS には Adaptive Depth という、問題の複雑度に応じて各ステージの成果物の詳細度を変える仕組みが用意されています。「深さの方向」での調整は、別の軸で確保されているという形です。（正直あまりここをうまく使いこなせていないので今後色々触ってみたいと思っています）

https://github.com/awslabs/aidlc-workflows/blob/main/aidlc-rules/aws-aidlc-rule-details/common/depth-levels.md#L9-L20

### 3. 質問のフォーマット

ホワイトペーパー側では、Mob Elaboration の中で対話的に質問するという程度の記述です。

OSS版では、質問が必ず以下のフォーマットに統一されています。

```markdown
## Question: デプロイモデル

A) AWS Lambda (Serverless)
B) AWS ECS Fargate (コンテナ)
C) 既存のオンプレミスインフラ
X) その他（[Answer]: タグの後に記述してください）

[Answer]: A
```

https://github.com/awslabs/aidlc-workflows/blob/main/aidlc-rules/aws-aidlc-rule-details/common/question-format-guide.md#L22-L30

ホワイトペーパー側は Mob Elaboration の中で口頭で質問・回答が行われるのに対し、OSS版ではファイル内に質問と回答が埋め込まれる、という構造の違いがあります。

複数選択肢 + その他 + `[Answer]:` タグ、という形式は OSS 独自で、ホワイトペーパーの中には見当たりませんでした。

### 4. 承認ゲートの存在

ホワイトペーパー側は、Mob Elaboration / Mob Construction で「集まった人間が議論しながらその場で決定する」プロセスのため、明示的な承認ゲートという仕組み自体がホワイトペーパーには存在しません。決定はモブの中で進行する、という形です。

OSS版は、各ステージの完了時に「Approve & Continue」または「Request Changes」の承認を必ず要求する設計になっています。承認しない限り次ステージに進みません。さらに、大半のステージは「Plan（計画書を作る）→ Generation（実際の成果物を作る）」の2段階構造になっており、それぞれの段階で承認が発生します。

https://github.com/awslabs/aidlc-workflows/blob/main/aidlc-rules/aws-aidlc-rules/core-workflow.md#L394-L402

AIが成果物を出すたびに人間のレビューが入るイメージなので、結構な回数実施される印象です。

OSS では「人間が逐一承認するフェーズ」が方法論として組み込まれていて、ホワイトペーパーの Mob のように「みんなで一気に決定する」プロセスとは、人間の関わり方の頻度や形が若干異なる、という印象を持ちました。

### 5. Operations フェーズの空白

これが個人的に一番大きいと感じた差分です。

ホワイトペーパー側の Operations フェーズで議論されていることを整理すると、以下のようになります。

- デプロイ・観測性 (observability)・保守の継続実行
- 異常検知 (Anomaly Detection) や インシデント解決 (Incident Resolution) などの活動も含まれる
- AI の役割：リソーススケーリング、パフォーマンスチューニング、フォールト隔離の推奨
- 人間の役割：AI 生成の洞察と提案アクションを SLA・コンプライアンス要件と整合させる検証者
- グリーンフィールドとブラウンフィールドで、運用フェーズの活動は同じ、とホワイトペーパーは主張している

これに対して、OSS版の `operations/` ディレクトリは placeholder のみとなっています。ビルドとテストは Construction フェーズに含まれる形です。

実際に OSS のドキュメントを見ると、こう書かれています。

> Status: This phase is currently a placeholder and will be expanded in future versions.

https://github.com/awslabs/aidlc-workflows/blob/main/aidlc-rules/aws-aidlc-rule-details/operations/operations.md#L1-L13

ホワイトペーパー側で Operations フェーズの考え方は、OSS の既存部品（aidlc-docs/、aidlc-state.md など）と AWS の運用系エージェントを組み合わせれば、部分的に再構成していけそうかなと感じました。

:::note info
AWS Summit 2026 に、まさに Operations Phase を扱うセッション「Operation Phase of AI-DLC － AI 駆動カオスエンジニアリングのすすめ－（DVT452）」があります。アブストラクトには次のように明記されていました。

> AI-DLC において、Operation Phase は最も発展途上の領域です

このセッションでは、AI 駆動のリスクストーミングとカオスエンジニアリング実験を通じた Operation Phase のアプローチが紹介される予定とのことで、私も当日聞きに行く予定です。知見があればまた記事化したいと思います。
:::

## おわりに
以上、簡単ではありましたが違いを整理してみました。今回見た workflow もあくまでも進め方の一例だと思っています。そのため、これをベースにチームで進めやすいようにカスタマイズしていくのが良いのかなと思います。

ただ、私もカスタマイズするにはまだまだ理解が浅い部分が多いので、どんどん試してみて知見を蓄えたり、アイデアを膨らませればなと思います。

ぜひ、皆さんも知見や考えたことがあれば共有していただければと思います。

ありがとうございました。
