/**
 * ClaudeCodeOrchestra - WebSocket通信管理
 * 
 * このモジュールはWebSocketを使用してクライアントとサーバー間でリアルタイム通信を実現します。
 * Claudeプロセスからの出力をリアルタイムでクライアントに送信するために使用されます。
 */

const WebSocket = require('ws');
const logger = require('./logger');

// クライアントのWebSocketコネクションを管理
const clients = new Map();
// セッションとWebSocketクライアントの関連付け
const sessionClients = new Map();

/**
 * WebSocketサーバーを設定する
 * @param {object} server HTTPサーバーインスタンス
 * @return {WebSocket.Server} WebSocketサーバーインスタンス
 */
function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws, req) => {
    const clientId = Date.now().toString();
    
    logger.info(`新しいWebSocket接続: ${clientId}`);
    clients.set(clientId, ws);
    
    // クライアントからの認証メッセージを待機
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        // セッションID認証のメッセージ
        if (data.type === 'auth' && data.sessionId) {
          const sessionId = data.sessionId;
          logger.info(`WebSocketクライアント認証: ${clientId} -> セッション ${sessionId}`);
          
          // このセッションに関連付けられたクライアントのリストを取得または作成
          if (!sessionClients.has(sessionId)) {
            sessionClients.set(sessionId, new Set());
          }
          
          // このクライアントをセッションに関連付け
          sessionClients.get(sessionId).add(clientId);
          
          // 認証成功メッセージを送信
          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'WebSocket接続が確立されました'
          }));
        }
        
        // Claude対話プロセスへのコマンド送信
        if (data.type === 'command' && data.sessionId && data.content) {
          logger.info(`WebSocketからコマンド受信: セッション ${data.sessionId}`);
          
          // コマンドイベントを発行
          if (wsEventHandlers.command && typeof wsEventHandlers.command === 'function') {
            wsEventHandlers.command(data.sessionId, data.content);
          }
        }
      } catch (error) {
        logger.error(`WebSocketメッセージ処理エラー: ${error.message}`);
      }
    });
    
    // 接続が閉じられたときのクリーンアップ
    ws.on('close', () => {
      logger.info(`WebSocket接続終了: ${clientId}`);
      
      // すべてのセッション関連付けからこのクライアントを削除
      for (const [sessionId, clientSet] of sessionClients.entries()) {
        if (clientSet.has(clientId)) {
          clientSet.delete(clientId);
          
          // クライアントがいなくなったセッションのエントリを削除
          if (clientSet.size === 0) {
            sessionClients.delete(sessionId);
          }
        }
      }
      
      // クライアントリストからも削除
      clients.delete(clientId);
    });
    
    // エラーハンドリング
    ws.on('error', (error) => {
      logger.error(`WebSocketエラー: ${error.message}`);
    });
    
    // 初期メッセージ送信
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'WebSocket接続が確立されました。セッションIDで認証してください。'
    }));
  });
  
  logger.info('WebSocketサーバーが設定されました');
  return wss;
}

/**
 * 特定のセッションに関連付けられたすべてのクライアントにメッセージを送信
 * @param {string} sessionId セッションID
 * @param {object} message 送信するメッセージオブジェクト
 */
function sendToSession(sessionId, message) {
  if (!sessionClients.has(sessionId)) {
    return; // このセッションに接続されたクライアントがいない
  }
  
  const clientIds = sessionClients.get(sessionId);
  const messageStr = JSON.stringify(message);
  
  clientIds.forEach(clientId => {
    const client = clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

/**
 * Claudeプロセスからの出力をセッションクライアントに送信
 * @param {string} sessionId セッションID
 * @param {string} output Claudeプロセスからの出力
 */
function sendClaudeOutput(sessionId, output) {
  sendToSession(sessionId, {
    type: 'claude_output',
    sessionId,
    content: output,
    timestamp: new Date().toISOString()
  });
}

/**
 * プロセスのステータス変更をセッションクライアントに通知
 * @param {string} sessionId セッションID
 * @param {object} status プロセスのステータス情報
 */
function sendProcessStatus(sessionId, status) {
  sendToSession(sessionId, {
    type: 'process_status',
    sessionId,
    status,
    timestamp: new Date().toISOString()
  });
}

/**
 * エラーをセッションクライアントに通知
 * @param {string} sessionId セッションID
 * @param {string} errorMessage エラーメッセージ
 */
function sendError(sessionId, errorMessage) {
  sendToSession(sessionId, {
    type: 'error',
    sessionId,
    message: errorMessage,
    timestamp: new Date().toISOString()
  });
}

// WebSocketから受け取ったイベントのハンドラ
const wsEventHandlers = {
  command: null,
};

/**
 * WebSocketイベントハンドラを設定
 * @param {string} eventName イベント名
 * @param {function} handler ハンドラ関数
 */
function setEventHandler(eventName, handler) {
  if (eventName === 'command' && typeof handler === 'function') {
    wsEventHandlers.command = handler;
  }
}

module.exports = {
  setupWebSocketServer,
  sendClaudeOutput,
  sendProcessStatus,
  sendError,
  setEventHandler
};