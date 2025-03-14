/**
 * Claude対話型APIエンドポイントの統合テスト
 */
const request = require('supertest');
const express = require('express');
const path = require('path');

// Claude対話型プロセス管理ユーティリティのモック
jest.mock('../../../src/utils/claudeProcess', () => ({
  startClaudeProcess: jest.fn((sessionId, workdir) => ({
    pid: 12345,
    workdir: workdir || `/test/workdir/${sessionId}`,
    running: true,
    startTime: new Date().toISOString()
  })),
  sendCommandToProcess: jest.fn(async (sessionId, command) => {
    return `Response to command: ${command}`;
  }),
  getProcessStatus: jest.fn((sessionId) => {
    if (sessionId === 'non-existent') {
      return null;
    }
    return {
      sessionId,
      pid: 12345,
      running: true,
      workdir: `/test/workdir/${sessionId}`,
      startTime: new Date().toISOString()
    };
  }),
  getAllProcessesStatus: jest.fn(() => ({
    'session-1': {
      sessionId: 'session-1',
      pid: 12345,
      running: true,
      workdir: '/test/workdir/session-1',
      startTime: new Date().toISOString()
    },
    'session-2': {
      sessionId: 'session-2',
      pid: 12346,
      running: false,
      workdir: '/test/workdir/session-2',
      startTime: new Date().toISOString(),
      exitTime: new Date().toISOString(),
      exitCode: 0
    }
  })),
  stopClaudeProcess: jest.fn((sessionId) => {
    if (sessionId === 'non-existent') {
      return false;
    }
    return true;
  })
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

describe('Claude対話型APIエンドポイント', () => {
  let app;
  
  beforeAll(() => {
    // アプリケーションをインポート
    const apiRoutes = require('../../../src/api/routes');
    
    // テスト用Expressアプリを作成
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });
  
  beforeEach(() => {
    // 各テスト前にモックをリセット
    jest.clearAllMocks();
  });

  describe('POST /api/claude/processes', () => {
    test('新しいプロセスを正常に開始できること', async () => {
      const sessionId = 'test-session-123';
      
      const response = await request(app)
        .post('/api/claude/processes')
        .send({ sessionId })
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.pid).toBe(12345);
      expect(response.body.data.running).toBe(true);
    });
    
    test('セッションIDなしでリクエストするとエラーになること', async () => {
      const response = await request(app)
        .post('/api/claude/processes')
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/claude/processes/:sessionId/command', () => {
    test('コマンドを正常に送信できること', async () => {
      const sessionId = 'test-session-123';
      const command = 'test command';
      
      const response = await request(app)
        .post(`/api/claude/processes/${sessionId}/command`)
        .send({ command })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.response).toBe(`Response to command: ${command}`);
    });
    
    test('コマンドなしでリクエストするとエラーになること', async () => {
      const sessionId = 'test-session-123';
      
      const response = await request(app)
        .post(`/api/claude/processes/${sessionId}/command`)
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/claude/processes/:sessionId', () => {
    test('プロセスのステータスを正常に取得できること', async () => {
      const sessionId = 'test-session-123';
      
      const response = await request(app)
        .get(`/api/claude/processes/${sessionId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.pid).toBe(12345);
      expect(response.body.data.running).toBe(true);
    });
    
    test('存在しないセッションIDでリクエストすると404エラーになること', async () => {
      const sessionId = 'non-existent';
      
      const response = await request(app)
        .get(`/api/claude/processes/${sessionId}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/claude/processes', () => {
    test('すべてのプロセスのステータスを取得できること', async () => {
      const response = await request(app)
        .get('/api/claude/processes')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeTruthy();
      expect(Object.keys(response.body.data).length).toBe(2);
      expect(response.body.data['session-1']).toBeTruthy();
      expect(response.body.data['session-2']).toBeTruthy();
    });
  });

  describe('DELETE /api/claude/processes/:sessionId', () => {
    test('プロセスを正常に停止できること', async () => {
      const sessionId = 'test-session-123';
      
      const response = await request(app)
        .delete(`/api/claude/processes/${sessionId}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain(sessionId);
    });
    
    test('存在しないセッションIDでリクエストすると404エラーになること', async () => {
      const sessionId = 'non-existent';
      
      const response = await request(app)
        .delete(`/api/claude/processes/${sessionId}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
});