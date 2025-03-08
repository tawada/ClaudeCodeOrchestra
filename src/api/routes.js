/**
 * APIルーター
 * 
 * APIエンドポイントのルーティングを定義します。
 * 他のモジュールのルーターをマウントします。
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// ヘルスチェックエンドポイント
router.get('/health', (req, res) => {
  // MongoDBが使用されているかどうかのフラグを含める
  const useMongoDb = process.env.USE_MONGODB === 'true';
  
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: Date.now(),
    useMongoDb: useMongoDb
  });
});

// インメモリモックデータ（開発用）
const mockData = {
  projects: [],
  sessions: [],
  users: [
    {
      id: '1',
      username: 'demo',
      email: 'demo@example.com',
      role: 'user'
    }
  ]
};

// モックデータAPI（MongoDB接続なしでも動作確認できるように）
router.get('/mock/projects', (req, res) => {
  logger.info('モックプロジェクト一覧を取得');
  res.status(200).json({
    success: true,
    data: mockData.projects
  });
});

router.post('/mock/projects', (req, res) => {
  const { name, description } = req.body;
  const newProject = {
    id: Date.now().toString(),
    name,
    description,
    createdAt: new Date().toISOString()
  };
  
  mockData.projects.push(newProject);
  logger.info(`モックプロジェクトを作成: ${name}`);
  
  res.status(201).json({
    success: true,
    data: newProject
  });
});

// モックセッション
router.post('/mock/sessions', (req, res) => {
  const { projectId, anthropicApiKey } = req.body;
  
  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: 'プロジェクトIDが必要です'
    });
  }
  
  // APIキーのデフォルト値
  const apiKey = anthropicApiKey || 'demo';
  
  const newSession = {
    id: Date.now().toString(),
    projectId,
    status: 'idle',
    lastActive: new Date().toISOString(),
    messages: []
  };
  
  mockData.sessions.push(newSession);
  logger.info(`モックセッションを作成: ${newSession.id}`);
  
  res.status(201).json({
    success: true,
    data: newSession
  });
});

router.post('/mock/sessions/:id/message', (req, res) => {
  const { message } = req.body;
  const sessionId = req.params.id;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'メッセージが必要です'
    });
  }
  
  const session = mockData.sessions.find(s => s.id === sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'セッションが見つかりません'
    });
  }
  
  // ユーザーメッセージを追加
  session.messages.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  });
  
  // AI応答を追加
  const aiResponse = `[モックAPI] これはデモ用の応答です。あなたのメッセージ「${message}」に対する応答です。`;
  session.messages.push({
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  });
  
  session.lastActive = new Date().toISOString();
  session.status = 'active';
  
  logger.info(`モックセッションにメッセージを送信: ${sessionId}`);
  
  res.status(200).json({
    success: true,
    data: {
      message: aiResponse,
      sessionId
    }
  });
});

module.exports = router;