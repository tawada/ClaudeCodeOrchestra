/**
 * Claude対話型プロセス管理ユーティリティのテスト
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// モックの準備
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: { 
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          // テスト用の出力データをコールバックに渡す
          setTimeout(() => callback(Buffer.from('Claude> ')), 10);
        }
      })
    },
    stderr: { on: jest.fn() },
    stdin: { write: jest.fn() },
    pid: 12345,
    killed: false
  }))
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('Claude> '),
  appendFileSync: jest.fn(),
  openSync: jest.fn(),
  closeSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 100 }),
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// テスト対象のモジュールをインポート
const claudeProcess = require('../../../src/utils/claudeProcess');

describe('Claude対話型プロセス管理ユーティリティ', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    jest.clearAllMocks();
  });

  describe('startClaudeProcess', () => {
    test('新しいClaude対話型プロセスを正常に開始できること', () => {
      const sessionId = 'test-session-123';
      const workdir = '/test/workdir';
      
      const result = claudeProcess.startClaudeProcess(sessionId, workdir);
      
      // 関数が正しい戻り値を返すことを確認
      expect(result).toBeTruthy();
      expect(result.pid).toBe(12345);
      expect(result.workdir).toBe(workdir);
      expect(result.running).toBe(true);
      
      // 必要なメソッドが呼ばれたことを確認
      expect(fs.existsSync).toHaveBeenCalledWith(workdir);
      expect(spawn).toHaveBeenCalled();
    });
    
    test('既存のプロセスが存在する場合は新しく作成しないこと', () => {
      // 一度目のプロセス作成
      const sessionId = 'test-session-123';
      const workdir = '/test/workdir';
      claudeProcess.startClaudeProcess(sessionId, workdir);
      
      // モックをリセット
      jest.clearAllMocks();
      
      // 同じセッションIDで再度プロセス作成を試みる
      const result = claudeProcess.startClaudeProcess(sessionId, workdir);
      
      // spawnが呼ばれていないことを確認 (新しいプロセスが作成されていない)
      expect(spawn).not.toHaveBeenCalled();
      
      // 既存のプロセス情報が返されていること
      expect(result).toBeTruthy();
      expect(result.pid).toBe(12345);
    });
  });

  describe('sendCommandToProcess', () => {
    test('コマンドをプロセスに送信できること', async () => {
      // 事前にプロセスを開始
      const sessionId = 'test-session-123';
      const workdir = '/test/workdir';
      claudeProcess.startClaudeProcess(sessionId, workdir);
      
      // テスト用の出力ファイルのサイズを設定
      fs.statSync.mockReturnValueOnce({ size: 0 }).mockReturnValueOnce({ size: 100 });
      
      // コマンドを送信
      const command = 'test command';
      const response = await claudeProcess.sendCommandToProcess(sessionId, command);
      
      // 応答が返されることを確認
      expect(response).toBeTruthy();
      
      // コマンドが正しく送信されたことを確認
      const processInfo = claudeProcess.getProcessStatus(sessionId);
      expect(processInfo).toBeTruthy();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
    
    test('存在しないセッションIDでコマンドを送信するとエラーになること', async () => {
      const sessionId = 'non-existent-session';
      const command = 'test command';
      
      // エラーになることを確認
      await expect(claudeProcess.sendCommandToProcess(sessionId, command))
        .rejects.toThrow();
    });
  });

  describe('stopClaudeProcess', () => {
    test('プロセスを正常に停止できること', () => {
      // 事前にプロセスを開始
      const sessionId = 'test-session-123';
      const workdir = '/test/workdir';
      
      const processInfo = claudeProcess.startClaudeProcess(sessionId, workdir);
      processInfo.process.stdin.write.mockClear();
      
      // プロセスを停止
      const result = claudeProcess.stopClaudeProcess(sessionId);
      
      // 終了コマンドが送信されたことを確認
      expect(result).toBe(true);
      expect(processInfo.process.stdin.write).toHaveBeenCalledWith('exit\n');
      
      // プロセス情報が更新されていることを確認
      const updatedStatus = claudeProcess.getProcessStatus(sessionId);
      expect(updatedStatus.running).toBe(false);
    });
    
    test('存在しないセッションIDでプロセスを停止しようとするとfalseを返すこと', () => {
      const sessionId = 'non-existent-session';
      
      // 存在しないセッションIDで停止を試みる
      const result = claudeProcess.stopClaudeProcess(sessionId);
      
      // falseが返されることを確認
      expect(result).toBe(false);
    });
  });

  describe('getProcessStatus & getAllProcessesStatus', () => {
    test('プロセスのステータスを正しく取得できること', () => {
      // 事前にプロセスを開始
      const sessionId = 'test-session-123';
      const workdir = '/test/workdir';
      claudeProcess.startClaudeProcess(sessionId, workdir);
      
      // プロセスのステータスを取得
      const status = claudeProcess.getProcessStatus(sessionId);
      
      // ステータス情報が正しいことを確認
      expect(status).toBeTruthy();
      expect(status.sessionId).toBe(sessionId);
      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);
      expect(status.workdir).toBe(workdir);
    });
    
    test('存在しないセッションIDでステータスを取得するとnullを返すこと', () => {
      const sessionId = 'non-existent-session';
      
      // 存在しないセッションIDでステータスを取得
      const status = claudeProcess.getProcessStatus(sessionId);
      
      // nullが返されることを確認
      expect(status).toBeNull();
    });
    
    test('すべてのプロセスのステータスを取得できること', () => {
      // 複数のプロセスを開始
      claudeProcess.startClaudeProcess('session-1', '/test/workdir-1');
      claudeProcess.startClaudeProcess('session-2', '/test/workdir-2');
      
      // すべてのプロセスのステータスを取得
      const allProcesses = claudeProcess.getAllProcessesStatus();
      
      // ステータス情報が正しいことを確認
      expect(allProcesses).toBeTruthy();
      expect(Object.keys(allProcesses).length).toBeGreaterThanOrEqual(2);
      expect(allProcesses['session-1']).toBeTruthy();
      expect(allProcesses['session-2']).toBeTruthy();
    });
  });

  describe('cleanupAllProcesses', () => {
    test('すべてのプロセスがクリーンアップされること', () => {
      // 複数のプロセスを開始
      claudeProcess.startClaudeProcess('session-1', '/test/workdir-1');
      claudeProcess.startClaudeProcess('session-2', '/test/workdir-2');
      
      // すべてのプロセスをクリーンアップ
      claudeProcess.cleanupAllProcesses();
      
      // すべてのプロセスが停止していることを確認
      const allProcesses = claudeProcess.getAllProcessesStatus();
      Object.values(allProcesses).forEach(process => {
        expect(process.running).toBe(false);
      });
    });
  });
});