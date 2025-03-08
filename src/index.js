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

// 静的ファイルの提供 (フロントエンド)
app.use(express.static('public'));

// m.htmlへのショートカットルート
app.get('/m', (req, res) => {
  res.redirect('/m.html');
});

// モバイルインターフェースへのルート（明示的にファイルを送信）
app.get('/mobile', (req, res) => {
  const mobilePath = path.resolve(__dirname, '../public/mobile.html');
  logger.info(`モバイルURLにアクセスがありました。ファイルパス: ${mobilePath}`);
  
  // ファイルの存在を確認
  const fs = require('fs');
  if (fs.existsSync(mobilePath)) {
    logger.info('ファイルが存在します。送信します。');
    res.sendFile(mobilePath);
  } else {
    logger.error(`ファイルが見つかりません: ${mobilePath}`);
    res.status(404).send('Mobile interface file not found.');
  }
});

// ルーティングの設定
app.use('/api', apiRoutes); // 認証なしでアクセス可能なAPIルート

// 認証関連ルートの無効化（MongoDB接続なしの開発環境用）
// app.use('/api/auth', authRoutes);
// app.use('/api/sessions', sessionRoutes);
logger.info('認証とセッション関連のAPIは無効になっています（MongoDB接続なしのため）');

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
    
    // MongoDBの接続をオプション化
    // MongoDB を使用する場合はこのコメントを解除してください
    // また、MongoDB のインストールが必要です（MONGODB_INSTALL.md 参照）
    // await connectDB();
  } catch (error) {
    logger.error(`サーバー起動エラー: ${error.message}`);
    process.exit(1);
  }
};

// プログラム実行
startServer();