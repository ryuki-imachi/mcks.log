---
title: "【Cloudflare】Route 53 からネームサーバーを移行する"
description: "個人ブログを Cloudflare Workers で公開しようとしたところ、Workers のカスタムドメインには Cloudflare の DNS ゾーンが必要だと分かりました…"
pubDate: 2026-07-04
updatedDate: 2026-07-05
tags: ['AWS', 'DNS', 'Route53', 'Cloudflare']
qiitaId: 0566e27e6c50b9fb399a
importedDate: 2026-07-11
qiitaStats:
  views: 1934
  likes: 3
  stocks: 3
  fetchedAt: 2026-07-11
---


## はじめに

個人ブログを Cloudflare Workers で公開しようとしたところ、Workers のカスタムドメインには Cloudflare の DNS ゾーンが必要だと分かりました。

https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

私のドメイン ryu-ki-learn.com は Route 53 で運用しています。サブドメインだけを Cloudflare に委任する Subdomain setup という構成もあるのですが、これは Enterprise プラン限定でした。無料プランで取れる選択肢は次の 2 つになります。

https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/

- Cloudflare Pages を使う（DNS は外部のままでよい）
- Cloudflare Workers を使う（DNS 全体を Cloudflare へ移す）

今回は Workers を使いたかったので、DNS の引っ越しをすることにしました。この記事では、Route 53 から Cloudflare へネームサーバーを移行した手順を備忘も兼ねて記録します。作業は Claude（Fable 5）と一緒に進めました。

なお、移すのは DNS ホスティングだけで、ドメインの登録（レジストラ）は Route 53 Domains に残します。本記事の画面や仕様は 2026 年 7 月時点のものです。

## 移行前の構成

- ryu-ki-learn.com（apex）: プロフィールサイト配信（S3 + CloudFront、Alias）
- images.ryu-ki-learn.com: 画像CDN（S3 + CloudFront、Alias）
- kawaraban.ryu-ki-learn.com: 自作のAI RSSリーダーが動作（CloudFront、CNAME）
- ACM 検証用の CNAME

なお、レジストラは Route 53 Domains、DNS は Route 53 の Hosted Zone です（$0.50/月）。

:::note warn
ACM 検証用の CNAME は見落としやすいレコードですが、消えると証明書の自動更新が止まります。移行対象に必ず含めます。
:::

https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html

## 移行の方針

安全のために 3 つの方針を決めてから作業しました。

- レジストラは Route 53 Domains に残し、ネームサーバーの向き先だけを変える
- Cloudflare 側の全レコードを DNS only（プロキシなし）にして、配信は今までどおり CloudFront に任せる
- 切り替えがうまくいかなければネームサーバーを戻すだけでロールバックできるよう、Route 53 の旧ホストゾーンは確認が終わるまで消さない

https://developers.cloudflare.com/dns/proxy-status/

では、早速作業していきたいと思います。

## 1. Cloudflare にゾーンを追加

Cloudflare ダッシュボードの Domains から進めます。手順の全体像は次の公式ドキュメントにまとまっています。

https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/

最初の選択肢は Connect a domain です。Transfer a domain はレジストラごと移管するメニューなので、今回の方針とは違います。

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/add-a-site-menu.png)

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/connect-a-domain-selected.png)

ドメイン名を入れて Free プランを選ぶと、追加の設定画面が出ます。Import DNS records は Automatic のまま進みました。ここで既存レコードの自動スキャンが走ります。

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/connect-your-domain-form.png)

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/select-free-plan.png)

## 1.5. 自動スキャンの結果を確認

スキャン結果は「8 A records」でした。一見それらしく見えますが、そのまま使うと事故ります。

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/scan-result-8-a-records.png)

問題は 3 つありました。

1 つ目は、Route 53 の Alias レコードが IP 直書きの A レコードとして取り込まれていることです。Alias は Route 53 独自の仕組みで、外部からの DNS 問い合わせには CNAME ではなく解決済みの IP アドレスで応答します。スキャンから見えるのはその瞬間の CloudFront のエッジ IP だけで、CNAME の情報は見えません。CloudFront の IP は変動するので、このまま使うといずれサイトにつながらなくなります。

https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html

2 つ目は、スキャン漏れです。kawaraban のような珍しい名前のサブドメインと、ACM 検証用のランダムな名前の CNAME が検出されませんでした。スキャンの正体は、よくあるサブドメイン名の辞書を使った総当たり問い合わせなので、辞書にない名前は見つけられません。画面上部の「uncommon records or custom subdomains を見逃しているかもしれない」という注意書きは、まさにこのことです。

3 つ目は、全レコードが Proxied（オレンジ雲）で取り込まれる設定になっていたことです。Cloudflare のプロキシを通す設定で、配信を CloudFront に任せたままにする今回の構成では DNS only（グレー雲）に変える必要があります。

自動スキャンは、外から観測できた瞬間のスナップショットにすぎません。正とすべきは移行元の中身で、必ず突き合わせが必要です。

:::note
（おまけ）登録されていたレコードを一括削除しようとすると、`DELETE` の入力を求められました。

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/delete-records-confirm.png)
:::

## 2. レコードを直して事前に確認

まず Route 53 側で全レコードを棚卸しします。

```bash
aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID> --output json
```

これを基準に、スキャンが検出した 8 本の A レコードをすべて削除し、正しい 4 本を CNAME・DNS only で作り直しました。apex の CNAME は本来 DNS の仕様上は置けませんが、Cloudflare が CNAME flattening という仕組みで自動的に A レコード相当に変換してくれます。

https://developers.cloudflare.com/dns/cname-flattening/

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/fixed-dns-records.png)

そして切り替えの前に、Cloudflare に割り当てられたネームサーバーへ直接問い合わせて、Route 53 と同じ答えが返ることを確認しておきます。

```bash
dig @coen.ns.cloudflare.com ryu-ki-learn.com A +short
dig @coen.ns.cloudflare.com images.ryu-ki-learn.com CNAME +short
```

4 レコードすべてで応答が一致することを確認しました。

## 3. ネームサーバーの切り替え

次はAWS側で設定を変えていくのですが、ここで 1 つ混乱しやすいポイントがあります。Route 53 には「ホストゾーンの NS レコード」と「登録済みドメインのネームサーバー設定」があり、この 2 つは別物です。

- ホストゾーンの NS レコードは、このゾーンが名乗っている名前です。今回は触りません（ロールバック用にそのまま残します）
- 登録済みドメインのネームサーバー設定は、世界がこのドメインについてどこへ聞きに行くかを決めるレジストラ側の設定です。今回書き換えるのはこちらです

上記の通り、今回操作するのは、Route 53 コンソールの「登録済みドメイン」から開くネームサーバーの編集です。

https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-name-servers-glue-records.html

AWS の 4 本のネームサーバーを削除し、

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/edit-nameservers-dialog.png)

Cloudflare の 2 本に書き換えて保存します。

![](https://images.ryu-ki-learn.com/route53-to-cloudflare-nameserver-migration/nameservers-updated.png)

## 4. 反映を確認

コンソールには反映まで最大 24 時間かかる場合があると表示されましたが、whois で確認すると数分でレジストリ側の委任が Cloudflare の NS に切り替わっていました。

```bash
whois ryu-ki-learn.com | grep -i "name server"
#   Name Server: COEN.NS.CLOUDFLARE.COM
#   Name Server: TRICIA.NS.CLOUDFLARE.COM
#Name Server: coen.ns.cloudflare.com 
#Name Server: tricia.ns.cloudflare.com
```

```bash
dig ryu-ki-learn.com NS +short
#coen.ns.cloudflare.com.
#tricia.ns.cloudflare.com.
```

プロフィールサイト、画像CDN、RSSリーダーのすべてが切り替え後も正常に応答していて、ダウンタイムはありませんでした。作業時間は棚卸しから確認まで全体で 40 分ほどです。（Fable 5 さまさま）

Cloudflare 側のゾーンが Active になったことを確認したら、数日様子を見て Route 53 の旧ホストゾーンを削除します。これで月 $0.50 のホストゾーン代がかからなくなります。

## おわりに

以上、今回はDNS ホスティングだけを Cloudflare へ移し、レジストラと配信（CloudFront）はそのまま、という引っ越しをしました。

自動スキャンを鵜呑みにしないということが注意点かと思います。移行元の棚卸しと、切り替え前の答え合わせさえしておけば防げるはずなので、事前の確認が大切ですね。

今後は Cloudflare Workers でブイブイ言わせていければと思います。

ありがとうございました。
