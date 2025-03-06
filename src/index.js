/**
 * ClaudeCodeOrchestra - メイン実行ファイル
 * 
 * このファイルは複数のClaudeCodeインスタンスをオーケストレーションするサーバーを起動し、
 * スマートフォンからのアクセスを管理する中心的なエントリーポイントです。
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./utils/logger');
const authRoutes = require('./auth/routes');
const apiRoutes = require('./api/routes');
const sessionRoutes = require('./sessions/routes');
const { connectDB } = require('./utils/database');

// 環境変数の設定
dotenv.config();

// Expressアプリケーションのインスタンス化
const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ルーティングの設定
app.use('/api', apiRoutes); // 認証なしでアクセス可能なAPIルート

// 認証関連ルートの無効化（MongoDB接続なしの開発環境用）
// app.use('/api/auth', authRoutes);
// app.use('/api/sessions', sessionRoutes);
logger.info('認証とセッション関連のAPIは無効になっています（MongoDB接続なしのため）');

// モバイルインターフェースへのルート
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/mobile.html'));
});

// 静的ファイルの提供 (フロントエンド)
app.use(express.static('public'));

// 404リダイレクト (すべてのルートが一致しない場合)
app.use((req, res) => {
  if (req.accepts('html')) {
    res.redirect('/');
    return;
  }
  res.status(404).json({ error: 'Not found' });
});

// サーバー起動
const startServer = async () => {
  try {
    // サーバーリスニング開始
    app.listen(PORT, () => {
      logger.info(`サーバーが起動しました。ポート: ${PORT}`);
      
      // MongoDBがない環境でも起動できるようにするためのメッセージ
      logger.info(`注意: MongoDBへの接続はスキップされました。現在はメモリ内データのみで動作します。`);
    });
    
    // MongoDBの接続をオプション化（開発環境では不要）
    // 実際の環境で必要な場合はコメントを外してください
    // await connectDB();
  } catch (error) {
    logger.error(`サーバー起動エラー: ${error.message}`);
    process.exit(1);
  }
};

// プログラム実行
startServer();