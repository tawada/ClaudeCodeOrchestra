/**
 * WebSocket通信管理のテスト
 */
const WebSocket = require('ws');

// WebSocketサーバーのモック
jest.mock('ws', () => {
  const EventEmitter = require('events');
  
  // モックWebSocketコネクション
  class MockWebSocket extends EventEmitter {
    constructor() {
      super();
      this.readyState = 1; // OPEN
      this.send = jest.fn();
    }
    
    close() {
      this.readyState = 3; // CLOSED
      this.emit('close');
    }
  }
  
  // モックWebSocketサーバー
  class MockServer extends EventEmitter {
    constructor() {
      super();
      this.clients = new Set();
    }
    
    handleConnection(socket) {
      this.clients.add(socket);
      this.emit('connection', socket);
    }
    
    close(callback) {
      this.clients.forEach(client => client.close());
      this.clients.clear();
      if (callback) callback();
    }
  }
  
  // モックWebSocketサーバー作成関数
  const mockServer = jest.fn(() => {
    const server = new MockServer();
    return server;
  });
  
  return {
    Server: mockServer,
    OPEN: 1,
    CLOSED: 3,
    MockWebSocket
  };
});

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// テスト対象のモジュールをインポート
const websocket = require('../../../src/utils/websocket');

describe('WebSocket通信管理', () => {
  let mockServer;
  let mockHttpServer;
  
  beforeEach(() => {
    // モックHTTPサーバー
    mockHttpServer = {};
    
    // WebSocketサーバーをセットアップ
    mockServer = websocket.setupWebSocketServer(mockHttpServer);
    
    // モックをリセット
    jest.clearAllMocks();
  });

  describe('setupWebSocketServer', () => {
    test('WebSocketサーバーを正しく設定できること', () => {
      expect(mockServer).toBeTruthy();
      expect(WebSocket.Server).toHaveBeenCalledWith({ server: mockHttpServer });
    });
    
    test('接続イベントが正しく処理されること', () => {
      // モックWebSocketを作成
      const mockSocket = new WebSocket.MockWebSocket();
      
      // 接続イベントをシミュレート
      mockServer.handleConnection(mockSocket);
      
      // 初期メッセージが送信されることを確認
      expect(mockSocket.send).toHaveBeenCalled();
      const welcomeMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
      expect(welcomeMessage.type).toBe('welcome');
    });
  });

  describe('クライアント認証と関連付け', () => {
    test('クライアントが正しく認証されセッションに関連付けられること', () => {
      // モックWebSocketを作成
      const mockSocket = new WebSocket.MockWebSocket();
      
      // 接続イベントをシミュレート
      mockServer.handleConnection(mockSocket);
      
      // 認証メッセージをシミュレート
      const authMessage = JSON.stringify({
        type: 'auth',
        sessionId: 'test-session-123'
      });
      
      mockSocket.emit('message', authMessage);
      
      // 認証成功メッセージが送信されることを確認
      expect(mockSocket.send).toHaveBeenCalledTimes(2); // welcomeとauth_success
      const messages = mockSocket.send.mock.calls.map(call => JSON.parse(call[0]));
      const authSuccessMessage = messages.find(msg => msg.type === 'auth_success');
      expect(authSuccessMessage).toBeTruthy();
    });
  });

  describe('sendToSessionとメッセージ送信', () => {
    test('セッションに関連付けられたクライアントにメッセージを送信できること', () => {
      // モックWebSocketを作成して認証
      const mockSocket1 = new WebSocket.MockWebSocket();
      const mockSocket2 = new WebSocket.MockWebSocket();
      const sessionId = 'test-session-123';
      
      // 接続と認証をシミュレート
      mockServer.handleConnection(mockSocket1);
      mockServer.handleConnection(mockSocket2);
      
      mockSocket1.emit('message', JSON.stringify({
        type: 'auth',
        sessionId: sessionId
      }));
      
      mockSocket2.emit('message', JSON.stringify({
        type: 'auth',
        sessionId: sessionId
      }));
      
      // 送信前にモックをクリア
      mockSocket1.send.mockClear();
      mockSocket2.send.mockClear();
      
      // セッションにメッセージを送信
      websocket.sendClaudeOutput(sessionId, 'Test output');
      
      // 両方のクライアントにメッセージが送信されることを確認
      expect(mockSocket1.send).toHaveBeenCalled();
      expect(mockSocket2.send).toHaveBeenCalled();
      
      // 送信されたメッセージの内容を確認
      const message1 = JSON.parse(mockSocket1.send.mock.calls[0][0]);
      expect(message1.type).toBe('claude_output');
      expect(message1.sessionId).toBe(sessionId);
      expect(message1.content).toBe('Test output');
    });
    
    test('送信関数が適切なメッセージフォーマットを生成すること', () => {
      // モックWebSocketを作成して認証
      const mockSocket = new WebSocket.MockWebSocket();
      const sessionId = 'test-session-123';
      
      // 接続と認証をシミュレート
      mockServer.handleConnection(mockSocket);
      mockSocket.emit('message', JSON.stringify({
        type: 'auth',
        sessionId: sessionId
      }));
      
      mockSocket.send.mockClear();
      
      // 各種メッセージ送信をテスト
      websocket.sendClaudeOutput(sessionId, 'Output text');
      websocket.sendProcessStatus(sessionId, { running: true, pid: 12345 });
      websocket.sendError(sessionId, 'Error message');
      
      // 送信されたメッセージを検証
      const messages = mockSocket.send.mock.calls.map(call => JSON.parse(call[0]));
      
      // claude_output メッセージ
      const outputMsg = messages.find(msg => msg.type === 'claude_output');
      expect(outputMsg).toBeTruthy();
      expect(outputMsg.content).toBe('Output text');
      
      // process_status メッセージ
      const statusMsg = messages.find(msg => msg.type === 'process_status');
      expect(statusMsg).toBeTruthy();
      expect(statusMsg.status.running).toBe(true);
      expect(statusMsg.status.pid).toBe(12345);
      
      // error メッセージ
      const errorMsg = messages.find(msg => msg.type === 'error');
      expect(errorMsg).toBeTruthy();
      expect(errorMsg.message).toBe('Error message');
    });
  });

  describe('コマンド処理', () => {
    test('コマンドイベントが正しく処理されること', () => {
      // コマンドハンドラーのモック
      const commandHandler = jest.fn();
      
      // コマンドハンドラーを設定
      websocket.setEventHandler('command', commandHandler);
      
      // モックWebSocketを作成して認証
      const mockSocket = new WebSocket.MockWebSocket();
      const sessionId = 'test-session-123';
      
      // 接続と認証をシミュレート
      mockServer.handleConnection(mockSocket);
      mockSocket.emit('message', JSON.stringify({
        type: 'auth',
        sessionId: sessionId
      }));
      
      // コマンドメッセージをシミュレート
      mockSocket.emit('message', JSON.stringify({
        type: 'command',
        sessionId: sessionId,
        content: 'test command'
      }));
      
      // コマンドハンドラーが呼ばれることを確認
      expect(commandHandler).toHaveBeenCalledWith(sessionId, 'test command');
    });
  });

  describe('接続クローズ処理', () => {
    test('接続が閉じられたときにクライアントが正しく削除されること', () => {
      // モックWebSocketを作成して認証
      const mockSocket = new WebSocket.MockWebSocket();
      const sessionId = 'test-session-123';
      
      // 接続と認証をシミュレート
      mockServer.handleConnection(mockSocket);
      mockSocket.emit('message', JSON.stringify({
        type: 'auth',
        sessionId: sessionId
      }));
      
      // メッセージ送信可能なことを確認
      websocket.sendClaudeOutput(sessionId, 'Test before close');
      expect(mockSocket.send).toHaveBeenCalled();
      
      // 接続を閉じる
      mockSocket.close();
      
      // モックをクリア
      mockSocket.send.mockClear();
      
      // 閉じた後にメッセージを送信しても送られないことを確認
      websocket.sendClaudeOutput(sessionId, 'Test after close');
      expect(mockSocket.send).not.toHaveBeenCalled();
    });
  });
});