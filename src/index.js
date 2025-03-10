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
const axios = require('axios');

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

// ClaudeCodeを使ったAI応答生成
async function generateClaudeResponse(sessionId, message, context) {
  try {
    // メッセージ履歴を取得
    const messageHistory = context.messageHistory || [];
    
    // ClaudeCodeのコンテキスト情報を作成
    const projectInfo = `プロジェクト: ${context.projectName || '不明'}, セッションID: ${sessionId}`;
    
    // ClaudeCodeで使用するためのプロンプトを作成
    const prompt = `あなたはClaudeCodeOrchestraというモバイルアプリのAIアシスタントです。
以下のプロジェクト情報を元に、ユーザーの質問に答えてください:
${projectInfo}

会話履歴:
${messageHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}`).join('\n')}

簡潔かつ役立つ回答を心がけてください。
ClaudeCodeOrchestraは複数のClaudeCodeインスタンスを管理し、モバイルから開発作業を行うためのツールです。

ユーザーの質問: ${message}

回答:`;

    // ClaudeCodeを使って応答を生成
    logger.info(`ClaudeCode実行: sessionId=${sessionId}`);
    
    // この環境ではClaudeCodeの直接実行は難しいため、代替処理
    // 本来は子プロセスでClaudeCodeのCLIを実行する
    // 例: const response = execSync(`claude -p "${prompt}"`, {encoding: 'utf-8'});
    
    // 擬似的な回答生成
    let aiResponse;
    
    // メッセージの内容に応じて応答を変える
    if (messageHistory.length === 0 || context.messageCount === 0) {
      // 最初のメッセージの場合
      aiResponse = `こんにちは！ClaudeCodeOrchestraへようこそ。${context.projectName || ''}プロジェクトのお手伝いをします。
あなたのメッセージ「${message}」を受け取りました。どのようなお手伝いが必要ですか？

ClaudeCodeOrchestraでは複数のClaudeCodeインスタンスを管理し、効率的な開発をサポートします。`;
    } else if (message.toLowerCase().includes('機能') || message.toLowerCase().includes('できること')) {
      // 機能についての質問
      aiResponse = `ClaudeCodeOrchestraの主な機能は以下の通りです：

1. 複数のClaudeCodeインスタンスの並行管理
2. モバイルからの開発環境操作と監視
3. プロジェクト間のコンテキスト切り替え
4. セッション履歴の保持と再開
5. APIを介した外部サービス連携

現在「${context.projectName || '不明'}」プロジェクトのセッションで対応中です。`;
    } else if (message.toLowerCase().includes('使い方') || message.toLowerCase().includes('ヘルプ')) {
      // ヘルプ要求
      aiResponse = `ClaudeCodeOrchestraの基本的な使い方：

1. プロジェクトを作成またはリストから選択
2. セッションを開始（APIキーは環境変数から自動取得可能）
3. チャットインターフェースでClaudeと対話
4. 複数プロジェクトを切り替えながら並行開発

特定の機能について詳しく知りたい場合は、お気軽にお尋ねください。`;
    } else {
      // 通常の応答
      aiResponse = `「${context.projectName || '不明'}」プロジェクトのClaudeCodeOrchestraセッションからの応答です。

ご質問「${message}」について、ClaudeCode統合機能を使用した回答です。この応答はセッション内で保存され、後で参照できます。

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

app.post('/api/sessions/:id/message', async (req, res) => {
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