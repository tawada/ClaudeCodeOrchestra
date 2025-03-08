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
```

## macOS での MongoDB インストール

```bash
# Homebrewを使用してインストール
brew tap mongodb/brew
brew install mongodb-community

# MongoDBサービスの開始
brew services start mongodb-community
```

## Windows での MongoDB インストール

1. [MongoDB Download Center](https://www.mongodb.com/try/download/community) からインストーラーをダウンロード
2. ダウンロードしたインストーラーを実行
3. 「Complete」設定でインストール
4. 「Run service as Network Service user」と「Install MongoDB Compass」オプションを選択
5. インストール完了後、サービスが自動的に起動します

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
mongo

# 接続テスト
> db.runCommand({ ping: 1 })
{ "ok" : 1 }
```

## ClaudeCodeOrchestra での MongoDB 設定

1. `.env` ファイルでMongoDB接続文字列を設定
```
MONGODB_URI=mongodb://localhost:27017/claudecodechestra
```

2. `.env.example` ファイルを参考に必要な環境変数を設定

3. アプリケーションを起動すると自動的にMongoDBに接続されます