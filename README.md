# ClaudeCodeOrchestra

ClaudeCodeOrchestrasは、1台のスマートフォンから複数のClaudeCodeインスタンスを管理し、異なるWebアプリケーションを並行開発できるオーケストレーションシステムです。

## 主な機能

- 複数のClaudeCodeセッションを管理する中央オーケストレーターサーバー
- 異なるWebアプリケーションを同時に開発するためのセッション分離
- Gitリポジトリ連携とCI/CDパイプライン管理
- スマートフォンに最適化されたモバイルフレンドリーインターフェース
- プロジェクト状態の永続化とコンテキスト管理

## 技術スタック

- **バックエンド**: Node.js, Express, MongoDB
- **認証**: JWT (JSON Web Tokens)
- **AI連携**: Anthropic Claude API
- **データベース**: MongoDB

## インストール方法

### 前提条件

- Node.js 16以上
- MongoDB 5.0以上 ([インストール手順](MONGODB_INSTALL.md))
- Anthropic API キー (オプション)

### アプリケーションのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/claudecodechestra.git
cd claudecodechestra

# 依存関係をインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な環境変数を設定

# 重要: セキュリティのために必ず強力なJWT_SECRETを設定してください
# 例: JWT_SECRET=$(openssl rand -hex 32)
# これをあなたの.envファイルに追加してください

# MongoDB接続を有効化する場合
# .envファイルを編集してMongoDB関連の設定を行う
# USE_MONGODB=true に変更

# 開発サーバーを起動
npm run dev
```

### MongoDB無しで実行する場合

データベースがない環境でもデモ機能を試すことができます：

```bash
# 依存関係をインストール
npm install

# 実際のAnthropicAPIを使用する場合
# .envファイルを編集して以下を設定:
# ANTHROPIC_API_KEY=sk-ant-xxxxx...（実際のAPIキー）
# USE_REAL_ANTHROPIC_API=true

# アプリケーションを起動
npm start

# ブラウザで以下にアクセス:
# - http://localhost:5000      # メインページ（ポート番号はデフォルトが5000）
# - http://localhost:5000/m    # モバイルインターフェース
```

## API エンドポイント

### 認証

- `POST /api/auth/register` - 新規ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報取得

### プロジェクト管理

- `GET /api/sessions/projects` - プロジェクト一覧取得
- `POST /api/sessions/projects` - 新規プロジェクト作成
- `GET /api/sessions/projects/:id` - プロジェクト詳細取得
- `PUT /api/sessions/projects/:id` - プロジェクト更新
- `DELETE /api/sessions/projects/:id` - プロジェクト削除

### ClaudeCodeセッション

- `POST /api/sessions/start` - 新規セッション開始
- `POST /api/sessions/:id/message` - メッセージ送信
- `GET /api/sessions/:id/history` - 会話履歴取得
- `PUT /api/sessions/:id/terminate` - セッション終了

## 開発者向け情報

- 開発サーバー: `npm run dev`
- テスト実行: `npm test`
- リント: `npm run lint`


## トラブルシューティング

- **MongoDB接続エラー**: [MONGODB_INSTALL.md](MONGODB_INSTALL.md)の手順に従ってMongoDBをインストールするか、`.env`ファイルの`USE_MONGODB=true`を`USE_MONGODB=false`に変更して一時的にファイルシステムモードで実行できます。
- **Node.js環境の問題**: Voltaなどのバージョン管理ツールを使用している場合、`volta install node`を実行するか、システムレベルでNode.jsをインストールしてください。

## ライセンス

MIT
