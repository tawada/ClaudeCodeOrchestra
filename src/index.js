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

// API共通ルート（認証不要）
app.use('/api', apiRoutes); // 認証なしでアクセス可能なAPIルート

// MongoDB無しで実際のAPIも動作するようにプロジェクトとセッションのルートを追加
// これらは認証を必要としない簡易実装
// メモリ内にデータを保持するためのストア
const memoryStore = {
  projects: [],
  sessions: [],
  messages: {}
};

// プロジェクト
app.get('/api/projects', (req, res) => {
  logger.info('実際のAPIからプロジェクト一覧を取得');
  res.status(200).json({
    success: true,
    data: memoryStore.projects
  });
});

app.post('/api/projects', (req, res) => {
  const { name, description } = req.body;
  const newProject = {
    id: Date.now().toString(),
    name,
    description,
    createdAt: new Date().toISOString()
  };
  
  // メモリ内ストアに保存
  memoryStore.projects.push(newProject);
  
  logger.info(`実際のAPIでプロジェクトを作成: ${name}`);
  
  res.status(201).json({
    success: true,
    data: newProject
  });
});

// セッション
app.post('/api/sessions', (req, res) => {
  const { projectId, anthropicApiKey } = req.body;
  
  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: 'プロジェクトIDが必要です'
    });
  }
  
  // プロジェクトの存在確認
  const project = memoryStore.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({
      success: false,
      message: '指定されたプロジェクトが見つかりません'
    });
  }
  
  const newSession = {
    id: Date.now().toString(),
    projectId,
    status: 'active',
    lastActive: new Date().toISOString(),
    messages: []
  };
  
  // メモリ内ストアに保存
  memoryStore.sessions.push(newSession);
  memoryStore.messages[newSession.id] = [];
  
  logger.info(`実際のAPIでセッションを作成: ${newSession.id} (プロジェクト: ${project.name})`);
  
  res.status(201).json({
    success: true,
    data: newSession
  });
});

app.get('/api/sessions', (req, res) => {
  logger.info('実際のAPIからセッション一覧を取得');
  res.status(200).json({
    success: true,
    data: memoryStore.sessions
  });
});

app.post('/api/sessions/:id/message', (req, res) => {
  const { message } = req.body;
  const sessionId = req.params.id;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'メッセージが必要です'
    });
  }
  
  // セッションの存在確認
  const session = memoryStore.sessions.find(s => s.id === sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      message: '指定されたセッションが見つかりません'
    });
  }
  
  // ユーザーメッセージを保存
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  // 実際のAPIレスポンス
  const aiResponse = `これは実際のAPIからの応答です。あなたのメッセージ「${message}」を受け取りました。ClaudeCodeOrchestraを使ってモバイルからの開発が進められています。`;
  
  // アシスタントメッセージを保存
  const assistantMessage = {
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  };
  
  // メッセージをメモリ内ストアに保存
  if (!memoryStore.messages[sessionId]) {
    memoryStore.messages[sessionId] = [];
  }
  
  memoryStore.messages[sessionId].push(userMessage, assistantMessage);
  
  // セッション情報を更新
  session.lastActive = new Date().toISOString();
  session.messages = memoryStore.messages[sessionId];
  
  logger.info(`実際のAPIでメッセージを送信: セッション ${sessionId}`);
  
  res.status(200).json({
    success: true,
    data: {
      message: aiResponse,
      sessionId
    }
  });
});

app.get('/api/sessions/:id', (req, res) => {
  const sessionId = req.params.id;
  const session = memoryStore.sessions.find(s => s.id === sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: '指定されたセッションが見つかりません'
    });
  }
  
  // セッションデータにメッセージを含める
  session.messages = memoryStore.messages[sessionId] || [];
  
  res.status(200).json({
    success: true,
    data: session
  });
});

// 認証・セッション関連のAPIルートは動的に追加
// .envのUSE_MONGODBフラグに基づいてstartServer()内で設定

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
    // .envからMongoDBの設定を読み込む
    const useMongoDb = process.env.USE_MONGODB === 'true';
    
    logger.info(`USE_MONGODB設定: ${process.env.USE_MONGODB}, 比較結果: ${useMongoDb}`);
    
    // MongoDBを使用する場合は接続
    if (useMongoDb) {
      try {
        await connectDB();
        logger.info(`MongoDBに接続しました。URI: ${process.env.MONGODB_URI}`);
        
        // 認証・セッション関連のAPIルートを有効化
        app.use('/api/auth', authRoutes);
        app.use('/api/sessions', sessionRoutes);
        logger.info('認証とセッション関連のAPIが有効になりました');
      } catch (dbError) {
        logger.error(`MongoDB接続エラー: ${dbError.message}`);
        logger.info('モックモードにフォールバックします');
      }
    } else {
      logger.info('USE_MONGODB=falseまたは設定されていないため、モックモードで起動します');
    }
    
    // サーバーリスニング開始
    app.listen(PORT, () => {
      logger.info(`サーバーが起動しました。ポート: ${PORT}`);
      
      if (!useMongoDb) {
        logger.info(`注意: MongoDBは使用されていません。現在はメモリ内データのみで動作します。`);
        logger.info(`機能を完全に使用するには、MongoDBをインストールし、.envファイルでUSE_MONGODB=trueに設定してください`);
      }
    });
  } catch (error) {
    logger.error(`サーバー起動エラー: ${error.message}`);
    process.exit(1);
  }
};

// プログラム実行
startServer();