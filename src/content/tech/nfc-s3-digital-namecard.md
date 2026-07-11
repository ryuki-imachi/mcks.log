---
title: "【100円でできる！】NFCカード+S3+CloudFrontで始めるデジタル名刺生活"
description: "この記事では、AWSのS3とCloudFrontを使って自分だけのプロフィールページを作成し、NFCカードと連携させる方法を紹介します。"
pubDate: 2025-06-02
updatedDate: 2025-06-18
tags: ['AWS', 'S3', 'NFC', 'CloudFront']
qiitaId: 965d35a5b9abe86d0054
importedDate: 2026-07-11
qiitaStats:
  views: 50895
  likes: 66
  stocks: 59
  fetchedAt: 2026-07-11
---

:::note warn
2025/06/18
昨日、AWS re:inforce 2025 にてアップデートの発表がありました。こちらについては後ほど追記・補足をする予定です
:::

# はじめに
JAWS-UGなどの勉強会後の懇親会でしばしばNFCカードを使ってSNSなどの情報を共有する場面を見かけてきました。それを見て、「**なんかかっこいいから私もやってみよう**」と思い、いろいろ調べてみるといくつかの記事がすぐにヒットしました。しかし、**プロフィールページをAWSで作っている話はあまりありませんでした**。そこで、せっかくなので、**S3+CloudFrontの典型的な構成**でプロフィールページを作ってみることにしました。

この記事では、AWSのS3とCloudFrontを使って自分だけのプロフィールページを作成し、NFCカードと連携させる方法を紹介します。

# この記事でわかること

- NFCカードを活用したデジタル名刺の仕組み
- AWSのS3とCloudFrontを使った低コストで高速なウェブホスティング

今回は以下の構成図の**S3**（格納するhtmlファイルについても）**とCloudFrontの設定を対象**としています。

![profile_contents.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/63874302-a37a-45d7-9be1-28e8d56ae671.png)


Route53とACMについては以下の記事で解説していますので、そちらをご覧ください。

https://qiita.com/ryu-ki/items/badfd87700b016b414a4

CICD部分については以下の記事で解説していますので、そちらをご覧ください。

https://qiita.com/ryu-ki/items/4117fc08969d055358f5

# 必要なもの

- AWSアカウント
- NFC対応のカード
- NFC書き込み用のスマートフォン（iPhoneであればiOS14以降）

# 1. プロフィールページの作成

### モダンなプロフィールページテンプレート

今回、**Claude Opus 4を利用して**プロフィールページを作成しました。

![image.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/929e06ef-5a1d-4eb1-86a4-9d82054d7a32.png)

<details>
<summary>HTMLファイル全体のコード（クリックで展開）</summary>

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile Page</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary: #0066ff;
            --secondary: #00a8ff;
            --accent: #ff0066;
            --dark: #1a1a1a;
            --light: #ffffff;
            --gray: #666;
            --light-gray: #f8f9fa;
            --shadow: rgba(0, 0, 0, 0.1);
            --gradient: linear-gradient(135deg, #0066ff, #00a8ff);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--light);
            color: var(--dark);
            overflow-x: hidden;
            min-height: 100vh;
            position: relative;
        }

        /* Animated Background Pattern */
        .bg-pattern {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            opacity: 0.03;
            background-image: 
                radial-gradient(circle at 1px 1px, var(--primary) 1px, transparent 1px);
            background-size: 50px 50px;
            animation: drift 20s linear infinite;
        }

        @keyframes drift {
            from { transform: translate(0, 0); }
            to { transform: translate(50px, 50px); }
        }

        /* Gradient Orbs */
        .gradient-orb {
            position: fixed;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.3;
            animation: float 20s ease-in-out infinite;
            pointer-events: none;
            z-index: -1;
        }

        .orb1 {
            width: 400px;
            height: 400px;
            background: var(--primary);
            top: -200px;
            right: -200px;
        }

        .orb2 {
            width: 300px;
            height: 300px;
            background: var(--secondary);
            bottom: -150px;
            left: -150px;
            animation-delay: -5s;
        }

        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -30px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
        }

        /* Container */
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            position: relative;
            z-index: 1;
        }

        /* Header Section */
        .header {
            text-align: center;
            padding: 60px 0 30px;
            animation: fadeIn 0.8s ease-out;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .profile-wrapper {
            position: relative;
            display: inline-block;
            margin-bottom: 30px;
        }

        .profile-pic {
            width: 140px;
            height: 140px;
            border-radius: 50%;
            background: var(--gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 10px 40px rgba(0, 102, 255, 0.3);
            animation: profilePulse 3s ease-in-out infinite;
            overflow: hidden;
        }

        .profile-pic img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        @keyframes profilePulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        .profile-pic::after {
            content: '';
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: var(--gradient);
            z-index: -1;
            opacity: 0.2;
            filter: blur(20px);
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            color: var(--dark);
            line-height: 1.2;
        }

        .tagline {
            font-size: 1.1rem;
            color: var(--primary);
            margin-bottom: 25px;
            font-weight: 500;
            letter-spacing: 0.5px;
        }

        .bio {
            font-size: 1rem;
            line-height: 1.8;
            color: var(--gray);
            max-width: 600px;
            margin: 0 auto;
        }

        .bio-highlight {
            color: var(--primary);
            font-weight: 500;
        }

        /* Links Section */
        .links-section {
            margin: 30px 0 50px;
        }

        .section-title {
            font-size: 1.8rem;
            text-align: center;
            margin-bottom: 25px;
            color: var(--dark);
            font-weight: 600;
            position: relative;
            animation: fadeIn 0.8s ease-out 0.2s both;
        }

        .section-title::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 3px;
            background: var(--gradient);
            border-radius: 2px;
        }

        .links-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 16px;
            max-width: 500px;
            margin: 0 auto;
        }

        .link-card {
            background: var(--light);
            border: 2px solid var(--light-gray);
            border-radius: 20px;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            animation: slideUp 0.6s ease-out;
            animation-fill-mode: both;
            box-shadow: 0 2px 10px var(--shadow);
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .link-card:nth-child(1) { animation-delay: 0.1s; }
        .link-card:nth-child(2) { animation-delay: 0.2s; }
        .link-card:nth-child(3) { animation-delay: 0.3s; }

        .link-card:hover {
            transform: translateY(-5px) scale(1.02);
            border-color: var(--primary);
            box-shadow: 0 15px 40px rgba(0, 102, 255, 0.2);
        }

        .link-card a {
            display: flex;
            align-items: center;
            padding: 20px 24px;
            text-decoration: none;
            color: var(--dark);
            gap: 20px;
            position: relative;
            overflow: hidden;
        }

        .link-card a::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 102, 255, 0.05), transparent);
            transition: left 0.5s ease;
        }

        .link-card:hover a::before {
            left: 100%;
        }

        .link-icon {
            width: 50px;
            height: 50px;
            background: var(--light-gray);
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.3s ease;
        }

        .link-card:hover .link-icon {
            background: var(--gradient);
            transform: rotate(5deg);
        }

        .link-icon svg {
            width: 28px;
            height: 28px;
            stroke: var(--primary);
            transition: stroke 0.3s ease;
        }

        .link-card:hover .link-icon svg {
            stroke: var(--light);
        }

        .link-content {
            flex: 1;
        }

        .link-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--dark);
        }

        .link-description {
            font-size: 0.85rem;
            color: var(--gray);
            line-height: 1.4;
        }

        /* Footer */
        .footer {
            text-align: center;
            padding: 40px 0 20px;
            color: var(--gray);
            font-size: 0.85rem;
        }

        /* Mobile Optimization */
        @media (max-width: 640px) {
            .header {
                padding: 40px 0 30px;
            }

            h1 {
                font-size: 2rem;
            }

            .profile-pic {
                width: 120px;
                height: 120px;
            }

            .bio {
                font-size: 0.95rem;
            }

            .link-card a {
                padding: 16px 20px;
            }

            .link-icon {
                width: 45px;
                height: 45px;
            }
        }
    </style>
</head>
<body>
    <div class="bg-pattern"></div>
    <div class="gradient-orb orb1"></div>
    <div class="gradient-orb orb2"></div>

    <div class="container">
        <header class="header">
            <div class="profile-wrapper">
                <div class="profile-pic">
                    <img src="my_icon.jpg" alt="Profile">
                </div>
            </div>
            <h1>ryu-ki</h1>
            <div class="tagline">Infrastructure Engineer</div>
            <p class="bio">
                SIer新卒2年目のインフラエンジニア<br>
                <span class="bio-highlight">AWS</span> / <span class="bio-highlight">DevOps</span> / 
                <span class="bio-highlight">オブザーバビリティ</span> / <span class="bio-highlight">生成AI</span><br>
                まだまだわからないことばかりなので日々勉強中です
            </p>
        </header>

        <section class="links-section">
            <h2 class="section-title">Links</h2>
            <div class="links-grid">
                <!-- X (Twitter) -->
                <div class="link-card">
                    <a href="https://x.com/umitsutech" target="_blank" rel="noopener noreferrer">
                        <div class="link-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                            </svg>
                        </div>
                        <div class="link-content">
                            <div class="link-title">X (Twitter)</div>
                            <div class="link-description">情報収集や、日々の学びなどを発信しています</div>
                        </div>
                    </a>
                </div>
                
                <!-- Qiita -->
                <div class="link-card">
                    <a href="https://qiita.com/ryu-ki" target="_blank" rel="noopener noreferrer">
                        <div class="link-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path>
                                <path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"></path>
                            </svg>
                        </div>
                        <div class="link-content">
                            <div class="link-title">Qiita</div>
                            <div class="link-description">AWS・生成AI技術などの記事を週1件投稿しています</div>
                        </div>
                    </a>
                </div>
                
                <!-- Speakerdeck -->
                <div class="link-card">
                    <a href="https://speakerdeck.com/ryuki0947" target="_blank" rel="noopener noreferrer">
                        <div class="link-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                <line x1="8" y1="21" x2="16" y2="21"></line>
                                <line x1="12" y1="17" x2="12" y2="21"></line>
                            </svg>
                        </div>
                        <div class="link-content">
                            <div class="link-title">Speaker Deck</div>
                            <div class="link-description">勉強会などでの発表資料を公開しています</div>
                        </div>
                    </a>
                </div>
            </div>
        </section>
    </div>

    <script>
        // Smooth hover effect for touch devices
        document.querySelectorAll('.link-card').forEach(element => {
            element.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
            });
            element.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });
    </script>
</body>
</html>
```

</details>

:::note warn
このHTMLコードでは `my_icon.jpg` というプロフィール画像を使用しています。実際に使用する際は、お好みの画像ファイルを用意し、ファイル名を合わせるか、HTMLコード内の `src="my_icon.jpg"` 部分を実際のファイル名に変更してください。
:::

#### このテンプレートの特徴（by Claudeさん）

- **アニメーション背景とグラデーションオーブ**で印象的な視覚効果
- **プロフィール画像のパルス効果**で注意を引きつける
- **スムーズなホバーエフェクト**とアニメーション
- **完全レスポンシブ**でモバイル最適化
- **CSS変数**でカラーテーマのカスタマイズが簡単

#### 作成時のプロンプト
```bash
デジタル名刺（NFCカード）を読み取った際に表示されるプロフィールサイトを作成して
見やすさとすごそうな感じであることを重視したい

また、NFCカードで読み取って表示させるケースが多いのでスマホ表示でもみやすいデザインである必要があることに注意して
```

# 2. AWS環境のセットアップ

### 2-1. S3バケットの作成と設定

AWSコンソールからS3バケットを作成し、静的ウェブサイトホスティングを有効にします。

1. AWSマネジメントコンソールにログイン
2. S3サービスに移動し、「バケットを作成」を選択
3. バケット名を入力（例：`your-profile-page`）
※バケット名はグローバルに一意である必要があります
4. リージョンを選択
5. パブリックアクセスのブロックをすべて解除
※後でCloudFrontからのアクセスのみに制限
6. バケットを作成を選択

### 2-2. 静的ウェブサイトホスティングの有効化

作成したバケットで静的ウェブサイトホスティングを有効にします。

1. バケットの「**プロパティ**」タブを選択
2. 「**静的ウェブサイトホスティング**」セクションで「編集」を選択
3. 「静的ウェブサイトホスティング」を「**有効にする**」を選択
4. インデックスドキュメントに作成したhtmlファイル名を指定
5. 「**変更の保存**」を選択

:::note
オプションとしてエラードキュメントの設定をすることもできます。
（今回は設定しません）
:::

### 2-3. ウェブサイトファイルのアップロード

1. S3バケットに、作成したHTMLファイルをアップロード
1. プロフィール画像ファイル（`my_icon.jpg`）もS3バケットにアップロード
※必要に応じて実施してください。

:::note
現時点では、バケットウェブサイトエンドポイントやオブジェクトURLからアクセスすることが可能です。
:::

### 2-4. CloudFrontディストリビューションの設定
高速で安全なコンテンツ配信のために、CloudFrontを設定します。

1. CloudFrontコンソールに移動し、「**ディストリビューションを作成**」を選択
2. **オリジンドメイン名**にS3バケット名を選択（バケットがドロップダウンに表示されます）
3. 以下の設定を行う
   - **オリジンアクセス**：「Origin access control settings (recommended)」を選択
   - **Origin access control**：「Create control setting」をクリックして新しいOACを作成
※OACの設定はデフォルトのままでOK
   - **ビューワープロトコルポリシー**：「Redirect HTTP to HTTPS」に設定
   - **キャッシュキーとオリジンリクエスト**：「Cache policy and origin request policy (recommended)」を選択
   - **デフォルトルートオブジェクト**：「index.html」を指定
4. 「**ディストリビューションを作成**」を選択

### 2-5. Origin Access Control（OAC）の設定
CloudFrontディストリビューション作成後、S3バケットのアクセス権限を設定してセキュリティを強化します。

:::note
#### Origin Access Control（OAC）とは
OACは、CloudFrontからS3バケットへの安全なアクセスを実現するAWSの仕組みです。これにより、S3バケットへの直接アクセスを制限し、CloudFront経由でのみコンテンツにアクセスできるようになります。

![OAC.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/557c13aa-2c0f-4977-ac4a-48713e7cbbc9.png)

:::

#### 設定手順
1. ディストリビューション作成完了後、表示される「**Copy policy**」を選択してポリシーをコピーする
2. S3バケットのコンソールに戻り、「**アクセス許可**」タブを選択
3. 「**バケットポリシー**」セクションで「編集」を選択
4. コピーしたポリシーを貼り付けて「**変更の保存**」を選択

この設定により、S3バケットへの直接アクセスが制限され、CloudFront経由でのみアクセス可能になります。

#### （参考）コピーしたポリシー
```json:policy
{
        "Version": "2008-10-17",
        "Id": "PolicyForCloudFrontPrivateContent",
        "Statement": [
            {
                "Sid": "AllowCloudFrontServicePrincipal",
                "Effect": "Allow",
                "Principal": {
                    "Service": "cloudfront.amazonaws.com"
                },
                "Action": "s3:GetObject",
                "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*",
                "Condition": {
                    "StringEquals": {
                      "AWS:SourceArn": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
                    }
                }
            }
        ]
      }
```

**注意**：以下は実際の値に置き換わっています。
- YOUR-BUCKET-NAME
- YOUR-ACCOUNT-ID
- YOUR-DISTRIBUTION-ID

### 2-6. 動作確認
1. CloudFrontディストリビューションのデプロイが完了するまで待機（通常5-10分程度）
2. ディストリビューションのドメイン名（例：`d1234567890.cloudfront.net`）にアクセスして動作確認

ディストリビューションのドメイン名から問題なくアクセスできることが確認できました。
![image.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/9c59f372-678d-4208-8aef-81ed733c171a.png)

また、以下のようにS3からはアクセスできなくなりました。
![image.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/8215cbbe-1389-4342-b8c7-07196808e43d.png)

:::note warn
セキュリティ強化のため、S3バケットのパブリックアクセス設定を再度有効にしてS3への直接アクセスをブロックすることを推奨します。
:::

![image.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/b7cc2de4-ea2d-4274-8d9a-ec1c79e6fd9a.png)

### 2-7. さらにカスタマイズする（発展）
次は、独自ドメインの取得・設定やSSL証明書の設定をしていくとよいでしょう。
これらについては、以下記事で詳しく解説しています。

https://qiita.com/ryu-ki/items/badfd87700b016b414a4

## 3. NFCカードの設定

### NFCとは

NFCは「Near Field Communication（近距離無線通信）」の略で、近くのデバイス間でデータをやり取りするための技術です。最近のスマートフォンのほとんどがNFC読み取りに対応しています。

### NFCカードの購入
私はとりあえずこちらを買いました。（5枚600円・10枚1000円程度）

https://www.amazon.co.jp/dp/B0DM8TNN98?ref=ppx_yo2ov_dt_b_fed_asin_title&th=1

### NFCカードにURLを書き込む方法

#### NFC Toolsアプリをインストール

https://apps.apple.com/jp/app/nfc-tools/id1252962749

#### アプリでの操作

1. アプリを開き、「**書く**」を選択
2. 「**レコードを追加**」を選択
3. 「**URL / URI**」を選択
4. CloudFrontのURLを入力し、OKを選択
![IMG_2244.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/c500181c-2e4b-49f5-be45-adbcafc9576a.png)

5. 「**書き込み**」ボタンを押し、NFCカードをスマートフォンの背面にかざす
![IMG_2245.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/fc262b49-bd50-4d05-8bbe-e9a6793be7b2.png)

6. 書き込み完了のメッセージが表示されたら成功

:::note
NFCに対応していないデバイスの考慮をして、QRコードも併用してもよいかもしれません。（NFCカードにQRコードを貼り付けておくなど）
:::

# 4. 運用とメンテナンス

:::note warn
こちらの作業に関して、私の環境では現在Github Actionsを利用して自動化しています。詳細については以下の記事をご覧ください
:::

https://qiita.com/ryu-ki/items/4117fc08969d055358f5

### 情報の更新方法

S3バケットの内容を更新することで、デジタル名刺の情報をいつでも最新に保つことができます。

1. **HTMLファイルを編集**（例：新しいリンクを追加など）
2. **S3コンソール**からファイルをアップロード
3. **CloudFrontのキャッシュを無効化**

### キャッシュ無効化の方法

CloudFrontのキャッシュを無効化することで、変更をすぐに反映させることができます。

1. CloudFrontコンソールに移動
2. 該当するディストリビューションを選択
3. 上部メニューから「キャッシュ削除」を選択し、「**キャッシュ削除を作成**」を選択
4. 無効化するパスを指定
   - 特定のファイル：`/index.html`
   - サイト全体：`/*`
5. 「**キャッシュ削除を作成**」を選択

![image.png](https://images.ryu-ki-learn.com/nfc-s3-digital-namecard/2df7f105-cf67-4a76-9ed4-9bb4fb4b14aa.png)

### コスト管理

S3とCloudFrontの組み合わせは非常にコスト効率が良く、**個人の名刺サイト程度（月間数十アクセス想定）であれば月額数円〜十数円程度**で運用できます。

**参考コスト内訳（東京リージョン、2025年料金）**
- S3ストレージ：数MB程度 → 月額1円未満
- S3リクエスト：月間50回程度 → 月額1円未満  
- CloudFront：月間100MB転送程度 → 月額数円程度
- **合計：月額5〜10円程度**

NFCカードでの名刺交換や、SNSプロフィールからのアクセスを考慮しても、個人利用であれば月間数十回程度のアクセスが一般的です。万が一アクセスが急増しても、AWS無料利用枠内に収まることが多く、予期せぬ高額請求の心配はほとんどありません。念のため**AWS Budgets**でアラートを設定しておくと安心です。

# まとめ

### やったこと

- **プロフィールページ作成**：Claude Opus 4を活用してモダンなHTMLページを作成
- **AWSインフラ構築**：S3バケットの作成と静的ウェブサイトホスティングの設定
- **CloudFront設定**：CDNによる高速配信とOrigin Access Control（OAC）によるセキュリティ強化
- **NFCカード設定**：NFC Toolsアプリを使ってURLをカードに書き込み

### できるようになったこと

- **いつでも情報更新**：HTMLファイルを変更するだけで最新情報に
- **高速アクセス**：CloudFrontのおかげで世界中から素早くアクセス可能
- **セキュア**：S3への直接アクセスを制限し、安全性を確保
- **低コスト**：月額数十円程度で運用可能

### デジタル名刺のメリット

- SNSやポートフォリオに**直接リンク**できる
- **印象的なデザイン**で記憶に残りやすい
- 情報が**常に最新**
- **環境に優しい**（サステナブル！）

# おわりに
NFCカードとAWSのS3・CloudFrontを組み合わせることで、デジタル名刺を作ることができました。「なんかかっこよさそう」というところから始めましたが、**典型的な静的サイト構築を経験できた**ので勉強になったと思います。みなさんも印象的なデジタル名刺を作成してみてはいかがでしょうか。
ありがとうございました。
