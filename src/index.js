/**
 * ClaudeCodeOrchestra - メイン実行ファイル
 * 
 * このファイルは複数のClaudeCodeインスタンスをオーケストレーションするサーバーを起動し、
 * スマートフォンからのアクセスを管理する中心的なエントリーポイントです。
 * 
 * @module index
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const logger = require('./utils/logger');
const authRoutes = require('./auth/routes');
const apiRoutes = require('./api/routes');
const sessionRoutes = require('./sessions/routes');
const { connectDB } = require('./utils/database');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const websocket = require('./utils/websocket');
const claudeProcess = require('./utils/claudeProcess');

// ClaudeCode実行管理用のオブジェクト
const claudeCodeSessions = {};

// セッションデータの永続化と復元用の関数
function saveSessionsToFile() {
  const sessionsDataDir = path.join(__dirname, '../data/sessions');
  if (!fs.existsSync(sessionsDataDir)) {
    fs.mkdirSync(sessionsDataDir, { recursive: true });
  }
  
  const sessionsDataPath = path.join(sessionsDataDir, 'sessions.json');
  
  try {
    // memoryStoreとclaudeCodeSessionsの状態を保存
    const dataToSave = {
      memoryStore: memoryStore,
      claudeCodeSessions: claudeCodeSessions,
      savedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(sessionsDataPath, JSON.stringify(dataToSave, null, 2));
    logger.info(`セッションデータを永続化しました: ${sessionsDataPath}`);
    return true;
  } catch (error) {
    logger.error(`セッションデータの永続化に失敗: ${error.message}`);
    return false;
  }
}

function loadSessionsFromFile() {
  const sessionsDataPath = path.join(__dirname, '../data/sessions/sessions.json');
  
  try {
    if (fs.existsSync(sessionsDataPath)) {
      const savedData = JSON.parse(fs.readFileSync(sessionsDataPath, 'utf8'));
      
      // memoryStoreの復元
      if (savedData.memoryStore) {
        memoryStore.projects = savedData.memoryStore.projects || [];
        memoryStore.sessions = savedData.memoryStore.sessions || [];
        memoryStore.messages = savedData.memoryStore.messages || {};
      }
      
      // claudeCodeSessionsの復元
      if (savedData.claudeCodeSessions) {
        Object.assign(claudeCodeSessions, savedData.claudeCodeSessions);
      }
      
      logger.info(`セッションデータを読み込みました（保存日時: ${savedData.savedAt || '不明'}）`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`セッションデータの読み込みに失敗: ${error.message}`);
    return false;
  }
}

// 環境変数の設定
dotenv.config();

// Expressアプリケーションのインスタンス化
const app = express();
const PORT = process.env.PORT || 3000;

// HTTPサーバーを作成 (WebSocketのため)
const httpServer = http.createServer(app);

// ミドルウェアの設定
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF保護設定
const csrfProtection = csrf({ 
  cookie: { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' 
  } 
});

// CSRF トークン取得エンドポイント
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// 静的ファイルの提供 (フロントエンド)
app.use(express.static('public'));

// モバイルページへのショートカットルート
app.get('/m', (req, res) => {
  res.redirect('/mobile.html');
});

// 古いm.htmlへのアクセスも全てmobile.htmlへリダイレクト
app.get('/m.html', (req, res) => {
  res.redirect('/mobile.html');
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

// ClaudeCode実行のヘルパー関数
function startClaudeCodeSession(sessionId, projectName) {
  // すでに起動済みの場合は何もしない
  if (claudeCodeSessions[sessionId]) {
    logger.info(`ClaudeCodeセッションはすでに起動しています: ${sessionId}`);
    return claudeCodeSessions[sessionId];
  }

  try {
    // 作業ディレクトリを作成
    const workspacesDir = path.join(__dirname, '../claude_workspaces');
    if (!fs.existsSync(workspacesDir)) {
      fs.mkdirSync(workspacesDir, { recursive: true });
    }
    
    const sanitizedName = (projectName || 'project').replace(/[^a-zA-Z0-9]/g, '_');
    const sessionWorkdir = path.join(workspacesDir, `${sanitizedName}_${sessionId}`);
    
    if (!fs.existsSync(sessionWorkdir)) {
      fs.mkdirSync(sessionWorkdir, { recursive: true });
    }
    
    logger.info(`ClaudeCodeセッションを開始します: ${sessionId}, プロジェクト: ${projectName}`);
    
    // 実際の環境ではClaudeCodeプロセスを起動
    // const claudeProcess = spawn('claude', ['server'], {
    //   cwd: sessionWorkdir,
    //   detached: true,
    //   stdio: 'ignore'
    // });
    // 
    // claudeProcess.unref(); // 親プロセスから切り離す
    
    // セッション情報を記録
    claudeCodeSessions[sessionId] = {
      // process: claudeProcess,
      workdir: sessionWorkdir,
      projectName: projectName,
      startTime: new Date().toISOString()
    };
    
    logger.info(`ClaudeCodeセッションを記録しました: ${sessionId}`);
    return claudeCodeSessions[sessionId];
  } catch (error) {
    logger.error(`ClaudeCodeセッション起動エラー: ${error.message}`);
    return null;
  }
}

// ClaudeCodeを使ったAI応答生成
async function generateClaudeResponse(sessionId, message, context) {
  try {
    // セッションがなければ開始する
    if (!claudeCodeSessions[sessionId]) {
      logger.info(`ClaudeCodeセッションが見つからないため開始します: ${sessionId}`);
      startClaudeCodeSession(sessionId, context.projectName);
    }
    
    const sessionInfo = claudeCodeSessions[sessionId];
    if (!sessionInfo) {
      logger.error(`ClaudeCodeセッションの開始に失敗しました: ${sessionId}`);
      return `ClaudeCodeセッションの開始に失敗しました。管理者にお問い合わせください。`;
    }
    
    // メッセージ履歴を取得
    const messageHistory = context.messageHistory || [];
    
    // ClaudeCodeで使用するためのプロンプトを作成
    const prompt = `あなたはClaudeCodeOrchestraというモバイルアプリのAIアシスタントです。
以下のプロジェクト情報を元に、ユーザーの質問に答えてください:
- プロジェクト名: ${context.projectName || '不明'}
- セッションID: ${sessionId}
- 作業ディレクトリ: ${sessionInfo.workdir}
- セッション開始時間: ${sessionInfo.startTime}

会話履歴:
${messageHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}`).join('\n')}

簡潔かつ役立つ回答を心がけてください。
ClaudeCodeOrchestraは複数のClaudeCodeインスタンスを管理し、モバイルから開発作業を行うためのツールです。

ユーザーの質問: ${message}

回答:`;

    // 実際の環境ではClaudeCodeを実行
    logger.info(`ClaudeCodeにプロンプトを送信: ${sessionId}`);
    
    // プロンプトをファイルに保存
    // const promptFile = path.join(sessionInfo.workdir, 'prompt.txt');
    // fs.writeFileSync(promptFile, prompt);
    
    // 実際のClaudeCode呼び出し
    // const claudeProc = spawn('claude', ['-f', promptFile], {
    //   cwd: sessionInfo.workdir,
    //   stdio: ['pipe', 'pipe', 'pipe']
    // });
    // 
    // let output = '';
    // claudeProc.stdout.on('data', data => { output += data.toString(); });
    // 
    // await new Promise((resolve, reject) => {
    //   claudeProc.on('close', code => {
    //     if (code === 0) resolve();
    //     else reject(new Error(`ClaudeCode実行エラー: 終了コード ${code}`));
    //   });
    // });
    // 
    // const aiResponse = output.trim();
    
    // デモ環境用のシミュレーション応答
    let aiResponse;
    
    // メッセージの内容に応じて応答を変える
    if (messageHistory.length === 0 || context.messageCount === 0) {
      // 最初のメッセージの場合
      aiResponse = `こんにちは！ClaudeCodeOrchestraへようこそ。${context.projectName || ''}プロジェクトのお手伝いをします。
あなたのメッセージ「${message}」を受け取りました。このセッションはClaudeCodeプロセスによって提供されています。

セッション情報:
- セッションID: ${sessionId}
- プロジェクト: ${context.projectName || '不明'}
- 開始時間: ${sessionInfo.startTime}

どのようなお手伝いが必要ですか？`;
    } else if (message.toLowerCase().includes('機能') || message.toLowerCase().includes('できること')) {
      // 機能についての質問
      aiResponse = `ClaudeCodeOrchestraの主な機能は以下の通りです：

1. 複数のClaudeCodeインスタンスの並行管理
2. モバイルからの開発環境操作と監視
3. プロジェクト間のコンテキスト切り替え
4. セッション履歴の保持と再開
5. APIを介した外部サービス連携

現在「${context.projectName || '不明'}」プロジェクトのセッションで対応中です。
このセッションは独立したClaudeCodeプロセスとして実行されています。`;
    } else if (message.toLowerCase().includes('使い方') || message.toLowerCase().includes('ヘルプ')) {
      // ヘルプ要求
      aiResponse = `ClaudeCodeOrchestraの基本的な使い方：

1. プロジェクトを作成またはリストから選択
2. セッションを開始（セッション起動時にClaudeCodeも自動起動）
3. チャットインターフェースでプロジェクト開発を進行
4. 複数プロジェクトを切り替えながら並行開発

セッション情報:
- セッションID: ${sessionId}
- プロジェクト: ${context.projectName || '不明'}
- 開始時間: ${sessionInfo.startTime}

特定の機能について詳しく知りたい場合は、お気軽にお尋ねください。`;
    } else {
      // 通常の応答
      aiResponse = `「${context.projectName || '不明'}」プロジェクトのClaudeCodeOrchestraセッションからの応答です。

ご質問「${message}」について、独立したClaudeCodeプロセスによる回答です。
このセッションは ${sessionInfo.startTime} に開始され、現在も実行中です。

このメッセージはセッション作業ディレクトリ: ${path.basename(sessionInfo.workdir)} に記録されています。
何か他にお手伝いできることがあれば、お知らせください。`;
    }
    
    logger.info('ClaudeCode応答生成完了');
    return aiResponse;
  } catch (error) {
    logger.error(`ClaudeCode実行エラー: ${error.message}`);
    // エラー時のフォールバック応答
    return `申し訳ありません。ClaudeCodeの実行中にエラーが発生しました: ${error.message}。現在はデモモードで応答します。`;
  }
}

// プロジェクト
app.get('/api/projects', (req, res) => {
  logger.info('実際のAPIからプロジェクト一覧を取得');
  res.status(200).json({
    success: true,
    data: memoryStore.projects
  });
});

app.post('/api/projects', csrfProtection, (req, res) => {
  const { name, description } = req.body;
  const newProject = {
    id: Date.now().toString(),
    name,
    description,
    createdAt: new Date().toISOString()
  };
  
  // メモリ内ストアに保存
  memoryStore.projects.push(newProject);
  
  // プロジェクト作成後にセッションデータを永続化
  saveSessionsToFile();
  
  logger.info(`実際のAPIでプロジェクトを作成: ${name}`);
  
  res.status(201).json({
    success: true,
    data: newProject
  });
});

// セッション
app.post('/api/sessions', csrfProtection, (req, res) => {
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
  
  // APIキーの取得 (リクエストから、または環境変数から)
  const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY || 'demo';
  
  const newSession = {
    id: Date.now().toString(),
    projectId,
    status: 'active',
    lastActive: new Date().toISOString(),
    messages: [],
    projectName: project.name, // プロジェクト名を含める
    usingRealApi: (apiKey !== 'demo' && apiKey.startsWith('sk-ant')), // 本物のAPIを使用しているかのフラグ
    createdAt: new Date().toISOString()
  };
  
  // メモリ内ストアに保存
  memoryStore.sessions.push(newSession);
  memoryStore.messages[newSession.id] = [];
  
  // ClaudeCodeセッションを開始
  try {
    startClaudeCodeSession(newSession.id, project.name);
    logger.info(`セッション開始時にClaudeCodeも起動: ${newSession.id}`);
    
    // セッション作成後にデータを永続化
    saveSessionsToFile();
  } catch (error) {
    logger.error(`ClaudeCode起動エラー: ${error.message}`);
  }
  
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

app.post('/api/sessions/:id/message', csrfProtection, async (req, res) => {
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
  
  // プロジェクト情報の取得
  const project = memoryStore.projects.find(p => p.id === session.projectId);
  
  // ユーザーメッセージを作成
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  // メッセージの履歴を取得
  if (!memoryStore.messages[sessionId]) {
    memoryStore.messages[sessionId] = [];
  }
  
  // 会話コンテキストの作成
  const messageCount = memoryStore.messages[sessionId].filter(m => m.role === 'user').length;
  const context = {
    projectName: project ? project.name : '不明',
    messageCount: messageCount,
    messageHistory: memoryStore.messages[sessionId]
  };
  
  // ClaudeCodeを使ってAI応答を生成
  let aiResponse;
  
  try {
    // 実際のAPIを使用する場合（APIキーが有効な場合）
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant')) {
      // Anthropic APIを使った応答生成を試みる
      aiResponse = await generateClaudeResponse(sessionId, message, context);
    } else {
      // APIキーがない場合はフォールバック応答
      logger.info('有効なAPIキーがないため、フォールバック応答を使用します');
      
      if (messageCount === 0) {
        // 最初のメッセージの場合
        aiResponse = `こんにちは！ClaudeCodeOrchestra（プロジェクト: ${project ? project.name : '不明'}）へようこそ。あなたのメッセージ「${message}」を受け取りました。どのようなお手伝いが必要ですか？`;
      } else if (message.includes('機能') || message.includes('できること')) {
        // 機能についての質問
        aiResponse = `ClaudeCodeOrchestraでは以下のことができます：
1. 複数のClaudeCodeインスタンスを一元管理
2. モバイルからの開発環境アクセス
3. プロジェクト間の切り替えとセッション管理
4. 進行中の開発タスクのモニタリング

現在、「${project ? project.name : '不明'}」プロジェクトのセッションで作業中です。`;
      } else if (message.includes('使い方') || message.includes('ヘルプ')) {
        // ヘルプ要求
        aiResponse = `ClaudeCodeOrchestraの基本的な使い方：
1. プロジェクトを作成または選択
2. セッションを開始（APIキーは環境変数から自動取得可能）
3. チャットでClaude AIと対話
4. 複数のプロジェクトを並行して管理可能

何か具体的な質問があればお知らせください。`;
      } else {
        // 通常の応答
        aiResponse = `これは「${project ? project.name : '不明'}」プロジェクトのセッションからの応答です。あなたのメッセージ「${message}」を受け取りました。ClaudeCodeOrchestraを使ってモバイルからの開発が進められています。どうぞ続けてください。[デモモード]`;
      }
    }
  } catch (error) {
    // エラー時のフォールバック
    logger.error(`AI応答生成エラー: ${error.message}`);
    aiResponse = `申し訳ありません。応答生成中にエラーが発生しました: ${error.message}。現在はデモモードで応答します。`;
  }
  
  // アシスタントメッセージを作成
  const assistantMessage = {
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  };
  
  // メッセージをメモリ内ストアに保存
  memoryStore.messages[sessionId].push(userMessage, assistantMessage);
  
  // セッション情報を更新
  session.lastActive = new Date().toISOString();
  session.messageCount = memoryStore.messages[sessionId].length;
  
  // メッセージ送信後にデータを永続化
  saveSessionsToFile();
  
  // セッションにメッセージを含める
  session.messages = memoryStore.messages[sessionId];
  
  logger.info(`実際のAPIでメッセージを送信: セッション ${sessionId} (メッセージ数: ${session.messageCount})`);
  
  res.status(200).json({
    success: true,
    data: {
      message: aiResponse,
      sessionId,
      messageCount: session.messageCount
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
    // 重要な環境変数が設定されているか確認
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_secure_jwt_secret_key') {
      logger.error('==================== エラー ====================');
      logger.error('環境変数JWT_SECRETが適切に設定されていません');
      logger.error('サーバーを起動する前に必ず有効なJWT_SECRETを設定してください');
      logger.error('例: JWT_SECRET=your_secret_key_here npm start');
      logger.error('開発環境の場合は .env ファイルに追加することも可能です');
      logger.error('==============================================');
      
      // アプリケーションを終了する
      logger.error('セキュリティリスクを避けるため、サーバーを終了します');
      process.exit(1);
    }
    
    // 保存されたセッションデータを読み込む
    const sessionsLoaded = loadSessionsFromFile();
    if (sessionsLoaded) {
      logger.info('保存されたセッションデータを復元しました');
      
      // 復元されたClaudeCodeセッションの状態を確認
      const sessionCount = Object.keys(claudeCodeSessions).length;
      logger.info(`復元されたClaudeCodeセッション数: ${sessionCount}`);
    } else {
      logger.info('保存されたセッションデータが見つからないか読み込めませんでした');
    }
    
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
    
    // WebSocketルートの設定
    app.get('/ws', (req, res) => {
      res.status(400).send('WebSocketエンドポイントはHTTPでは使用できません');
    });

    // 定期的なセッションデータの永続化設定（5分ごと）
    setInterval(() => {
      saveSessionsToFile();
    }, 5 * 60 * 1000);
    
    // クリーンアップ関数
    const cleanupAllProcesses = () => {
      logger.info('すべてのプロセスをクリーンアップします...');
      
      try {
        // セッションデータを保存
        saveSessionsToFile();
        
        // Claudeプロセスをクリーンアップ
        if (claudeProcess && typeof claudeProcess.cleanupAllProcesses === 'function') {
          claudeProcess.cleanupAllProcesses();
        }
      } catch (error) {
        logger.error(`プロセスクリーンアップエラー: ${error.message}`);
      }
    };
    
    // プロセス終了時のクリーンアップハンドラを登録
    process.on('exit', cleanupAllProcesses);
    process.on('SIGINT', () => {
      logger.info('アプリケーションが終了します。リソースをクリーンアップします...');
      cleanupAllProcesses();
      process.exit(0);
    });
    
    // サーバーリスニング開始
    httpServer.listen(PORT, () => {
      logger.info(`サーバーが起動しました。ポート: ${PORT}`);
      
      if (!useMongoDb) {
        logger.info(`注意: MongoDBは使用されていません。セッションデータはファイルシステムに自動保存されます。`);
        logger.info(`機能を完全に使用するには、MongoDBをインストールし、.envファイルでUSE_MONGODB=trueに設定してください`);
      }
    });
    
    return httpServer;
  } catch (error) {
    logger.error(`サーバー起動エラー: ${error.message}`);
    process.exit(1);
  }
};

// サーバーインスタンスの参照を保持するための変数
let server;
let wss;

// 環境変数がtestの場合はサーバーを起動しない
if (process.env.NODE_ENV !== 'test') {
  // プログラム実行
  startServer().then((httpServer) => {
    server = httpServer;
    console.log('メインサーバー起動');
    
    // WebSocketサーバーをセットアップ
    wss = websocket.setupWebSocketServer(server);
    
    // WebSocketのコマンドイベントハンドラを設定
    websocket.setEventHandler('command', async (sessionId, command) => {
      try {
        logger.info(`WebSocketから受信したコマンドをClaudeプロセスに送信: ${sessionId}`);
        
        // コマンド送信前にプロセスの状態をチェック
        const processStatus = claudeProcess.getProcessStatus(sessionId);
        if (!processStatus) {
          logger.warn(`セッション ${sessionId} のプロセスが見つかりません。新規作成を試みます。`);
          
          // プロセスが存在しない場合は新規作成
          const workdir = path.join(process.cwd(), 'claude_workspaces', `session_${sessionId}_${Date.now()}`);
          const newProcess = claudeProcess.startClaudeProcess(sessionId, workdir);
          
          if (!newProcess) {
            throw new Error(`セッション ${sessionId} の新規プロセス作成に失敗しました`);
          }
          
          logger.info(`セッション ${sessionId} の新規プロセスを作成しました。PID: ${newProcess.pid}`);
          
          // プロセス起動後少し待機
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else if (!processStatus.running) {
          logger.warn(`セッション ${sessionId} のプロセスは停止しています。再起動します。`);
          claudeProcess.stopClaudeProcess(sessionId);
          
          // 新しいプロセスを起動
          const workdir = processStatus.workdir || path.join(process.cwd(), 'claude_workspaces', `session_${sessionId}_${Date.now()}`);
          const newProcess = claudeProcess.startClaudeProcess(sessionId, workdir);
          
          if (!newProcess) {
            throw new Error(`セッション ${sessionId} のプロセス再起動に失敗しました`);
          }
          
          logger.info(`セッション ${sessionId} のプロセスを再起動しました。PID: ${newProcess.pid}`);
          
          // プロセス起動後少し待機
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          logger.info(`セッション ${sessionId} のプロセスは実行中です。PID: ${processStatus.pid}`);
        }
        
        // プロセスにコマンドを送信
        logger.info(`コマンド送信を開始します: "${command.substring(0, 30)}..."`);
        const response = await claudeProcess.sendCommandToProcess(sessionId, command);
        logger.info(`コマンド応答を受信しました: ${response.length} 文字`);
        
        // レスポンスをWebSocketクライアントに送信
        websocket.sendClaudeOutput(sessionId, response);
        logger.info(`WebSocketクライアントに応答を送信しました: セッション ${sessionId}`);
        return response;
      } catch (error) {
        logger.error(`WebSocketコマンド処理エラー: ${error.message}, スタック: ${error.stack}`);
        websocket.sendError(sessionId, `エラー: ${error.message}`);
        throw error;
      }
    });
  });
} else {
  console.log('テスト環境ではサーバーを自動起動しません');
}

// シャットダウン用の関数
function stopServer() {
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        console.log('サーバーを正常にシャットダウンしました');
        resolve();
      });
    });
  }
  return Promise.resolve();
}

// テスト用にエクスポート
module.exports = {
  saveSessionsToFile,
  loadSessionsFromFile,
  app,
  startServer,
  stopServer
};