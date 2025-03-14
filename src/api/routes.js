/**
 * APIルーター
 * 
 * APIエンドポイントのルーティングを定義します。
 * 他のモジュールのルーターをマウントします。
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const path = require('path');
const claudeProcess = require('../utils/claudeProcess');

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

// Claudeプロセス管理APIエンドポイント

/**
 * 新しいClaude対話型プロセスを開始
 * POST /api/claude/processes
 */
router.post('/claude/processes', async (req, res) => {
  try {
    const { sessionId, workdir } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'セッションIDが必要です'
      });
    }
    
    // 作業ディレクトリのデフォルト値
    const defaultWorkdir = path.join(
      process.cwd(), 
      'claude_workspaces', 
      `session_${sessionId}_${Date.now()}`
    );
    
    const processWorkdir = workdir || defaultWorkdir;
    
    // プロセスを開始
    const processInfo = claudeProcess.startClaudeProcess(sessionId, processWorkdir);
    
    if (!processInfo) {
      return res.status(500).json({
        success: false,
        message: 'Claudeプロセスの起動に失敗しました'
      });
    }
    
    // プロセス情報から安全に返せる情報を抽出
    const safeProcessInfo = {
      sessionId,
      pid: processInfo.pid,
      workdir: processInfo.workdir,
      running: processInfo.running,
      startTime: processInfo.startTime
    };
    
    res.status(201).json({
      success: true,
      data: safeProcessInfo
    });
  } catch (error) {
    logger.error(`プロセス起動APIエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `エラー: ${error.message}`
    });
  }
});

/**
 * Claudeプロセスにコマンドを送信
 * POST /api/claude/processes/:sessionId/command
 */
router.post('/claude/processes/:sessionId/command', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        message: 'コマンドが必要です'
      });
    }
    
    // プロセスにコマンドを送信
    const response = await claudeProcess.sendCommandToProcess(sessionId, command);
    
    res.status(200).json({
      success: true,
      data: {
        sessionId,
        response,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`コマンド送信APIエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `エラー: ${error.message}`
    });
  }
});

/**
 * Claudeプロセスのステータスを取得
 * GET /api/claude/processes/:sessionId
 */
router.get('/claude/processes/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const status = claudeProcess.getProcessStatus(sessionId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: `セッション ${sessionId} のプロセスが見つかりません`
      });
    }
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`ステータス取得APIエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `エラー: ${error.message}`
    });
  }
});

/**
 * すべてのClaude対話型プロセスのステータスを取得
 * GET /api/claude/processes
 */
router.get('/claude/processes', (req, res) => {
  try {
    const allProcesses = claudeProcess.getAllProcessesStatus();
    
    res.status(200).json({
      success: true,
      data: allProcesses
    });
  } catch (error) {
    logger.error(`全プロセスステータス取得APIエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `エラー: ${error.message}`
    });
  }
});

/**
 * Claudeプロセスを停止
 * DELETE /api/claude/processes/:sessionId
 */
router.delete('/claude/processes/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = claudeProcess.stopClaudeProcess(sessionId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `セッション ${sessionId} のプロセスが見つからないか、すでに停止しています`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `セッション ${sessionId} のプロセスを停止しました`
    });
  } catch (error) {
    logger.error(`プロセス停止APIエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `エラー: ${error.message}`
    });
  }
});

module.exports = router;