---
title: "【Python】青空文庫からテキストを取得する ～夏休みの自由研究①～"
description: "夏休みの自由研究記事を書きたいと思っていましたが、8月が終わり、9月になってしまいました。何をしようかというアイデアがなかなか思いつかなかったのですが、テキスト類似度の算出方法の学…"
pubDate: 2025-09-04
updatedDate: 2025-09-09
tags: ['Python', '青空文庫', '自由研究']
qiitaId: ad4131dadc617817926e
importedDate: 2026-07-11
qiitaStats:
  views: 8287
  likes: 16
  stocks: 15
  fetchedAt: 2026-07-11
---

## はじめに

夏休みの自由研究記事を書きたいと思っていましたが、8月が終わり、9月になってしまいました。何をしようかというアイデアがなかなか思いつかなかったのですが、テキスト類似度の算出方法の学習を兼ねて、「**青空文庫で取得できる作家の文体と、私のQiita記事の文体を比べて、最も似ている文体の作家は誰か調べてみる**」というテーマで記事を書くことにしました。

ただ、これを1つの記事にすると内容が膨大になり、読んだ後に結局何をしたのかわからないということになりそうだったので、いくつかの記事に分けて書いていきたいと思います。

この記事では、第1ステップとなる、青空文庫からテキストデータを取得する実装を紹介し、そのポイントを解説します。

## 青空文庫とは

青空文庫は、著作権が切れた作品や著者が許可した作品を電子化して無料公開している日本の電子図書館です。夏目漱石、芥川龍之介、宮沢賢治など、多くの名作がテキスト形式で読めます。

詳細は以下リンクをご覧ください。

https://www.aozora.gr.jp/

## 完成形のコード

まず、完成形のコードを見てみましょう。このクラスを使えば、青空文庫からテキストデータを取得できます。

<details><summary>長いので折り畳み</summary>

```python
# aozora_extractor.py
import requests
from bs4 import BeautifulSoup
import re
from typing import Dict, List
import time
import warnings
from bs4 import XMLParsedAsHTMLWarning

class AozoraTextExtractor:
    """青空文庫テキスト抽出クラス"""
    
    def __init__(self, wait_time: float = 1.0):
        self.wait_time = wait_time
        warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
    
    def extract_text(self, url: str, include_metadata: bool = False) -> Dict[str, str]:
        """
        青空文庫からテキストを抽出
        
        Args:
            url: 青空文庫の作品URL
            include_metadata: メタデータを含めるか
            
        Returns:
            抽出結果（text, title, author）
        """
        time.sleep(self.wait_time)
        response = requests.get(url)
        response.encoding = 'shift_jis'
        soup = BeautifulSoup(response.text, 'html.parser')
        
        result = {}
        
        if include_metadata:
            result['title'] = self._extract_title(soup)
            result['author'] = self._extract_author(soup)
        
        main_text = soup.find('div', class_='main_text')
        result['text'] = self._clean_text(main_text) if main_text else ''
        
        return result
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """作品タイトルを抽出"""
        title_tag = soup.find('h1', class_='title')
        if title_tag:
            return title_tag.get_text().strip()
        
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text()
            return re.sub(r'図書カード：', '', title).strip()
        
        return ""
    
    def _extract_author(self, soup: BeautifulSoup) -> str:
        """著者名を抽出"""
        author_tag = soup.find('h2', class_='author')
        if author_tag:
            return author_tag.get_text().strip()
        
        for td in soup.find_all('td'):
            if '作者：' in td.get_text():
                next_td = td.find_next('td')
                if next_td:
                    return next_td.get_text().strip()
        
        return ""
    
    def _clean_text(self, main_text_element: BeautifulSoup) -> str:
        """テキストをクリーニング"""
        # ルビの処理
        for ruby in main_text_element.find_all('ruby'):
            rb = ruby.find('rb')
            if rb:
                ruby.replace_with(rb.text)
            else:
                for tag in ruby.find_all(['rt', 'rp']):
                    tag.decompose()
                ruby.unwrap()
        
        text = main_text_element.get_text()
        
        # 青空文庫記号を除去
        text = re.sub(r'［＃[^］]*］', '', text)    # 編集注記
        text = re.sub(r'《[^》]*》', '', text)       # 青空文庫記号
        text = re.sub(r'｜', '', text)              # ルビ開始記号
        text = re.sub(r'　{2,}', '　', text)        # 連続全角スペース
        text = re.sub(r'\r\n|\r', '\n', text)       # 改行コード統一
        text = re.sub(r'\n{3,}', '\n\n', text)      # 過剰な改行
        text = re.sub(r'^　+', '', text, flags=re.MULTILINE)  # 行頭スペース
        
        return text.strip()
    
    def extract_multiple(self, urls: List[str], include_metadata: bool = False) -> List[Dict[str, str]]:
        """複数URLから一括でテキストを抽出"""
        results = []
        
        for i, url in enumerate(urls, 1):
            print(f"処理中... ({i}/{len(urls)}): {url}")
            try:
                result = self.extract_text(url, include_metadata)
                results.append(result)
            except requests.RequestException as e:
                print(f"ネットワークエラー: {url} - {e}")
                results.append({'text': '', 'error': f'ネットワークエラー: {str(e)}'})
            except Exception as e:
                print(f"処理エラー: {url} - {e}")
                results.append({'text': '', 'error': f'処理エラー: {str(e)}'})
        
        return results
```
</details>

## 使い方

実際に芥川龍之介『羅生門』を取得してみます。

```python
extractor = AozoraTextExtractor(wait_time=1.0)

# 芥川龍之介「羅生門」
url = "https://www.aozora.gr.jp/cards/000879/files/127_15260.html"
result = extractor.extract_text(url, include_metadata=True)

print(f"タイトル: {result['title']}")
print(f"著者: {result['author']}")
print(f"文字数: {len(result['text']):,}")
print(f"\n冒頭部分:\n{result['text'][:300]}")
```

実行結果は以下のようになります。

```text
タイトル: 羅生門
著者: 芥川龍之介
文字数: 5,717

冒頭部分:
ある日の暮方の事である。一人の下人が、羅生門の下で雨やみを待っていた。
広い門の下には、この男のほかに誰もいない。ただ、所々丹塗の剥げた、大きな円柱に、蟋蟀が一匹とまっている。羅生門が、朱雀大路にある以上は、この男のほかにも、雨やみをする市女笠や揉烏帽子が、もう二三人はありそうなものである。それが、この男のほかには誰もいない。
何故かと云うと、この二三年、京都には、地震とか辻風とか火事とか饑饉とか云う災がつづいて起った。そこで洛中のさびれ方は一通りではない。旧記によると、仏像や仏具を打砕いて、その丹がついたり、金銀の箔がついたりした木を、路ばたにつみ重ねて、薪の料に売っていたと云う事である。洛
```

## 実装時のポイント

### 1. 文字コードの扱い

青空文庫の多くの作品はShift-JISでエンコードされています。そのため、以下のように指定しないと文字化けしてしまいます。

```python
response.encoding = 'shift_jis'
```

以下のように、指定していない場合は文字化けしていることがわかります。

```
タイトル: 
å
著者: H´Vî
文字数: 11,439

冒頭部分:
@ éúÌéûÌÅ éBêÌºªA
åÌºÅJâÝðÒÁÄ¢½B
@L¢åÌºÉÍA±ÌjÌÙ©ÉNà¢È¢B½¾AXOhÌ°½Aå«È~ÉAå§å©ªêCÆÜÁÄ¢éB
åªAéåÉ éÈãÍA±ÌjÌÙ©ÉàAJâÝð·és}âGXqªAà¤ñOÍ è»¤ÈàÌÅ éB»ê
```

### 2. ルビ（ふりがな）の処理

青空文庫では、ルビが`<ruby>`タグで表現されています。

```html
<ruby><rb>漢字</rb><rp>（</rp><rt>かんじ</rt><rp>）</rp></ruby>
```

このままだと「漢字かんじ」のようにルビも含めて取得してしまうので、以下のようにベーステキスト（`<rb>`タグ内）のみを抽出します。

```python
for ruby in main_text_element.find_all('ruby'):
    rb = ruby.find('rb')
    if rb:
        ruby.replace_with(rb.text)  # 「漢字」のみを残す
    else:
        # rbタグがない場合は、rt/rpタグを除去してからunwrap
        for tag in ruby.find_all(['rt', 'rp']):
            tag.decompose()
        ruby.unwrap()
```

### 3. 青空文庫特有の記号処理

青空文庫には以下のような独特の記号があります。

|記号パターン|意味|例|
|---|---|---|
|`［＃...］`|編集注記|［＃ページの左右中央］|
|`《...》`|青空文庫記号|《きごう》|
|`｜`|ルビ開始位置|｜漢字《かんじ》|

これらを正規表現で除去します。

```python
text = re.sub(r'［＃[^］]*］', '', text)    # 編集注記
text = re.sub(r'《[^》]*》', '', text)       # 青空文庫記号
text = re.sub(r'｜', '', text)              # ルビ開始記号
```


## 実際の出力例

処理前と処理後で以下のように異なることがわかります。

#### 処理前（生のHTML）

```
　ある日の｜暮方《くれがた》の事である。一人の｜下人《げにん》が、［＃「下人」に傍点］羅生門《らしょうもん》の下で雨やみを待っていた。
```

#### 処理後（クリーンなテキスト）

```
ある日の暮方の事である。一人の下人が、羅生門の下で雨やみを待っていた。
```

## まとめ
青空文庫からテキストを取得する際は以下のことに注意するとよいと思います。
- 文字コード
- ルビの処理
- 青空文庫特有の記号除去

## おわりに
簡単ではありましたが、以上で青空文庫からテキストを取得することができるようになりました。このテキストを使えば、様々な分析ができます。次回は、このテキストデータを使った文章類似度の計算について実施・解説できればと思います。
ありがとうございました。
