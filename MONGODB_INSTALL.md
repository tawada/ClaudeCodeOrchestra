# MongoDB インストール手順

## Debian/Ubuntu での MongoDB インストール

```bash
# MongoDBの公式リポジトリを追加
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo 'deb http://repo.mongodb.org/apt/debian buster/mongodb-org/7.0 main' | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update

# MongoDBのインストール
sudo apt-get install -y mongodb-org

# MongoDBサービスの開始と自動起動設定
sudo systemctl start mongod
sudo systemctl enable mongod

# サービスとして登録せずに直接起動する場合
mkdir -p /data/db
mongod --bind_ip_all
```

## macOS での MongoDB インストール

```bash
# Homebrewを使用してインストール
brew tap mongodb/brew
brew install mongodb-community

# MongoDBサービスの開始
brew services start mongodb-community

# サービスとして登録せずに直接起動する場合
mkdir -p ~/data/db
mongod --dbpath ~/data/db --bind_ip_all
```

## Windows での MongoDB インストール

1. [MongoDB Download Center](https://www.mongodb.com/try/download/community) からインストーラーをダウンロード
2. ダウンロードしたインストーラーを実行
3. 「Complete」設定でインストール
4. 「Run service as Network Service user」と「Install MongoDB Compass」オプションを選択
5. インストール完了後、サービスが自動的に起動します

サービスとして登録せずに直接起動する場合:
```
md \data\db
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath=\data\db
```

## Docker での MongoDB 実行

```bash
# MongoDBコンテナの起動
docker run --name mongodb -d -p 27017:27017 mongo

# データベースを永続化する場合
docker run --name mongodb -d -p 27017:27017 -v ~/mongo-data:/data/db mongo
```

## 検証方法

MongoDBが正常に動作しているか確認するには：

```bash
# コマンドラインから確認
mongosh

# 接続テスト
> db.runCommand({ ping: 1 })
{ "ok" : 1 }
```

## ClaudeCodeOrchestra での MongoDB 設定

1. `.env` ファイルでMongoDB接続を有効化し、接続文字列を設定
```
USE_MONGODB=true
MONGODB_URI=mongodb://localhost:27017/claudecodechestra
```

2. `.env.example` ファイルを参考に必要な環境変数を設定

3. アプリケーションを起動すると、自動的にMongoDBに接続を試みます
```
npm start
```

4. 接続が成功すると以下のようなログが表示されます
```
MongoDBに接続しました。URI: mongodb://localhost:27017/claudecodechestra
認証とセッション関連のAPIが有効になりました
```

## Anthropic APIの設定 (オプション)

実際のClaudeを使用したい場合は、以下の設定を行います:

1. Anthropicの[公式サイト](https://console.anthropic.com/)でAPIキーを取得

2. `.env`ファイルに以下の設定を追加
```
ANTHROPIC_API_KEY=sk-ant-xxx...  # 取得したAPIキー
USE_REAL_ANTHROPIC_API=true      # 実際のAPI使用を有効化
```

3. APIキーが設定されている場合、セッション作成時のAPIキー入力は省略可能になります