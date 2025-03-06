/**
 * ユーティリティモジュールのインデックス
 * 
 * 各種ユーティリティ関数・クラスをエクスポートします。
 */

const logger = require('./logger');
const { connectDB, mongoose } = require('./database');

// Claude Codeクライアントのダミー実装
// 実際のClaudeCodeAPIと同様のインターフェースを提供します
const claudeCode = {
  test: async ({ apiKey }) => {
    // APIキーの検証をシミュレート
    if (!apiKey || apiKey.length < 10) {
      return { success: false, message: 'Invalid API key' };
    }
    return { success: true, message: 'API connection successful' };
  },
  
  sendMessage: async ({ apiKey, sessionId, message, history }) => {
    // メッセージ送信をシミュレート
    if (!apiKey || !sessionId || !message) {
      throw new Error('Required parameters missing');
    }
    
    // 実際の実装では、ClaudeCodeAPIを呼び出します
    return {
      message: `これはClaudeCodeのシミュレーション応答です。あなたのメッセージ: "${message}"`,
      sessionId: sessionId
    };
  }
};

module.exports = {
  logger,
  connectDB,
  mongoose,
  claudeCode
};