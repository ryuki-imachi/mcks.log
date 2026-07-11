---
title: "【Secrets Manager】RDSパスワードローテーションをコードから理解する"
description: "AWS Secrets Managerで、データベースのシークレットをローテーションすることができます。このローテーションの際、Lambdaが実行されているのですが、どういった仕組…"
pubDate: 2025-11-15
updatedDate: 2025-11-22
tags: ['AWS', 'RDS', 'SecretsManager']
qiitaId: a49ffb7b2bece4dec53f
importedDate: 2026-07-11
qiitaStats:
  views: 3198
  likes: 3
  stocks: 1
  fetchedAt: 2026-07-11
---

## はじめに

AWS Secrets Managerで、データベースのシークレットをローテーションすることができます。このローテーションの際、Lambdaが実行されているのですが、どういった仕組みになっているのかあまり把握できていませんでした。

そこで、今回はSecrets Managerのローテーションがどのように行われているのかコードを読んで整理してみたいと思います。

なお、今回確認するコードはこちらです。

https://github.com/aws-samples/aws-secrets-manager-rotation-lambdas/blob/master/SecretsManagerRDSMySQLRotationSingleUser/lambda_function.py

## ローテーションの仕組み

### 全体の流れ

Secrets Managerのローテーションは以下の4つのステップからなります。

1. createSecret：新しいパスワードを生成
2. setSecret：データベースに新しいパスワードを設定
3. testSecret：新しいパスワードで接続テスト
4. finishSecret：新しいパスワードを現行バージョンに更新

### シークレットのバージョン管理

Secrets Managerは以下の3つのステージでシークレットを管理しています。
- AWSCURRENT：現在使用中のシークレット
- AWSPENDING：ローテーション中の新しいシークレット
- AWSPREVIOUS：前回のシークレット（ロールバック用）

なお、バージョン状況については以下コマンドで確認することができます。

```bash
aws secretsmanager list-secret-version-ids --secret-id <your-secret-id>
```

https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/list-secret-version-ids.html

この際確認できたそれぞれのバージョンの具体的な値は以下コマンドで確認することができます。

```bash
aws secretsmanager get-secret-value --secret-id <your-secret-id>
```

https://docs.aws.amazon.com/cli/latest/reference/secretsmanager/get-secret-value.html

## 各ステップのコードを見てみる

### 1. createSecret

ここでは、現在のシークレットをコピーして、パスワード部分のみを新しいランダムな値に置き換えます。

```python
def create_secret(service_client, arn, token):
    # 現在のシークレットを取得
    current_dict = get_secret_dict(service_client, arn, "AWSCURRENT")
    
    try:
        # すでにPENDINGバージョンが存在するか確認
        get_secret_dict(service_client, arn, "AWSPENDING", token)
    except service_client.exceptions.ResourceNotFoundException:
        # 新しいランダムパスワードを生成
        current_dict['password'] = get_random_password(service_client)
        
        # PENDINGステージとして保存
        service_client.put_secret_value(
            SecretId=arn, 
            ClientRequestToken=token, 
            SecretString=json.dumps(current_dict), 
            VersionStages=['AWSPENDING']
        )
```


### 2. setSecret

ここでは、現在のパスワードでデータベースに接続し、新しいパスワードに変更します。

```python
def set_secret(service_client, arn, token):
    # 各バージョンのシークレットを取得
    current_dict = get_secret_dict(service_client, arn, "AWSCURRENT")
    pending_dict = get_secret_dict(service_client, arn, "AWSPENDING", token)
    
    # まずPENDINGのパスワードで接続を試みる
    conn = get_connection(pending_dict)
    if conn:
        conn.close()
        return  # すでに設定済み
    
    # 現在のパスワードで接続
    conn = get_connection(current_dict)
    
    if conn:
        try:
            with conn.cursor() as cur:
                # MySQLバージョンを確認
                cur.execute("SELECT VERSION()")
                ver = cur.fetchone()
                password_option = get_password_option(ver[0])
                
                # パスワードを更新
                cur.execute("SET PASSWORD = " + password_option, 
                          pending_dict['password'])
                conn.commit()
        finally:
            conn.close()
```


#### MySQLバージョン（ `get_password_option()` ）について

上記の関数にて、MySQLのバージョンチェックが行われているのですがこれはなぜでしょうか。調べてみると、MySQLはバージョン8.0で`PASSWORD()`関数を廃止したため、パスワード設定の構文が大きく変わるようです。

https://dev.mysql.com/worklog/task/?id=10774

```python
def get_password_option(version):
    """Gets the password option template string to use for the SET PASSWORD sql query"""
    if version.startswith("8"):
        return "%s"
    else:
        return "PASSWORD(%s)"
```

これにより後方互換性が保たれているのではと思います。

### 3. testSecret

ここでは、新しいパスワードで実際にデータベースに接続できることを確認しています。

```python
def test_secret(service_client, arn, token):
    # 新しいパスワードで接続テスト
    conn = get_connection(get_secret_dict(service_client, arn, "AWSPENDING", token))
    
    if conn:
        try:
            with conn.cursor() as cur:
                # 簡単なクエリを実行して権限を確認
                cur.execute("SELECT NOW()")
                conn.commit()
        finally:
            conn.close()
    else:
        raise ValueError("Unable to log into database with pending secret")
```


### 4. finishSecret

最後に、PENDINGステージのシークレットをCURRENTに更新します。以上で、アプリケーションは新しいパスワードを取得するようになります。

```python
def finish_secret(service_client, arn, token):
    # シークレットのメタデータを取得
    metadata = service_client.describe_secret(SecretId=arn)
    
    # 現在のバージョンを探す
    for version in metadata["VersionIdsToStages"]:
        if "AWSCURRENT" in metadata["VersionIdsToStages"][version]:
            current_version = version
            break
    
    # PENDINGをCURRENTに更新
    service_client.update_secret_version_stage(
        SecretId=arn,
        VersionStage="AWSCURRENT",
        MoveToVersionId=token,
        RemoveFromVersionId=current_version
    )
```

### （おまけ）パスワード生成のカスタマイズ性について

以下のコードの通り、生成されるパスワードの要件は環境変数を使用してカスタマイズすることができます。

```python
def get_random_password(service_client):
    passwd = service_client.get_random_password(
        ExcludeCharacters=os.environ.get('EXCLUDE_CHARACTERS', '/@"\'\\'),
        PasswordLength=int(os.environ.get('PASSWORD_LENGTH', 32)),
        ExcludeNumbers=get_environment_bool('EXCLUDE_NUMBERS', False),
        ExcludePunctuation=get_environment_bool('EXCLUDE_PUNCTUATION', False),
        ExcludeUppercase=get_environment_bool('EXCLUDE_UPPERCASE', False),
        ExcludeLowercase=get_environment_bool('EXCLUDE_LOWERCASE', False),
        RequireEachIncludedType=get_environment_bool('REQUIRE_EACH_INCLUDED_TYPE', True)
    )
    return passwd['RandomPassword']
```


## おわりに

以上簡単ではありましたが、Secrets Managerのローテーションがどのように行われているのか見てみました。普段あまり意識して使うことがなかったので、3つのラベルを用いて情報を扱っていることはあまりわかっておらず、勉強になりました。
こういった部分を知っていると何かトラブルがあったときの対応スピードが変わるんだろうなとも感じました。今後も仕組みの部分に注目するようにしたいと思います。
ありがとうございました。


## 参考

https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/rotation-strategy.html

https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/reference_available-rotation-templates.html#sar-template-mysql-singleuser

https://dev.classmethod.jp/articles/aws-secrets-manager-with-cli/
