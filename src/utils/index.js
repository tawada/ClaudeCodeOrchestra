/**
 * ユーティリティモジュールのインデックス
 * 
 * 各種ユーティリティ関数・クラスをエクスポートします。
 * 2025-03-06: MongoDB非依存モードを追加
 * 2025-03-08: 実際のAnthropicAPIサポートを追加
 */

// 環境変数を再ロード
require('dotenv').config();

const logger = require('./logger');
const { connectDB, mongoose } = require('./database');
const axios = require('axios');

// .envから設定を読み込む
const useRealAnthropicApi = process.env.USE_REAL_ANTHROPIC_API === 'true';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

// 環境変数の状態をログ出力（デバッグ用）
logger.info(`環境変数: USE_REAL_ANTHROPIC_API = ${process.env.USE_REAL_ANTHROPIC_API}`);
logger.info(`変換後: useRealAnthropicApi = ${useRealAnthropicApi}`);
logger.info(`ANTHROPIC_API_KEY存在: ${anthropicApiKey ? '有り' : '無し'}`);

// 実際のAnthropicAPIを使用するクライアント
const realClaudeCodeClient = {
  test: async ({ apiKey }) => {
    try {
      // APIキーを使って軽いリクエストを送信してテスト
      const apiKeyToUse = apiKey || anthropicApiKey;
      
      logger.info(`Anthropic APIテスト実行中... APIキー: ${apiKeyToUse.substring(0, 10)}...`);
      
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 10,
          messages: [
            { role: 'user', content: 'Hello, this is a test. Please respond with OK.' }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'anthropic-api-key': apiKeyToUse,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      if (response.status === 200) {
        logger.info('Anthropic API接続テスト成功');
        return { success: true, message: 'Anthropic API connection successful' };
      } else {
        return { success: false, message: 'API returned non-200 status code' };
      }
    } catch (error) {
      logger.error(`Anthropic API接続テストエラー: ${error.message}`);
      return { success: false, message: `API Error: ${error.message}` };
    }
  },
  
  sendMessage: async ({ apiKey, sessionId, message, history = [] }) => {
    try {
      // 会話履歴を整形
      const formattedMessages = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // 新しいメッセージを追加
      if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].role !== 'user') {
        formattedMessages.push({ role: 'user', content: message });
      }
      
      const apiKeyToUse = apiKey || anthropicApiKey;
      logger.info(`Anthropic APIメッセージ送信... APIキー: ${apiKeyToUse.substring(0, 10)}...`);
      
      // APIリクエスト
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 4000,
          messages: formattedMessages
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'anthropic-api-key': apiKeyToUse,
            'anthropic-version': '2023-06-01'
          }
        }
      );
      
      // 応答を抽出
      const assistantMessage = response.data.content[0].text;
      return {
        message: assistantMessage,
        sessionId: sessionId
      };
    } catch (error) {
      logger.error(`Anthropic API送信エラー: ${error.message}`);
      throw new Error(`Anthropic API Error: ${error.message}`);
    }
  }
};

// Claude Codeクライアントのダミー実装
// 実際のClaudeCodeAPIと同様のインターフェースを提供します
const mockClaudeCodeClient = {
  test: async ({ apiKey }) => {
    // APIキーの検証をシミュレート
    // 「demo」というキーワードでもテスト成功とする（デモ用）
    if (apiKey === 'demo') {
      return { success: true, message: 'Demo mode activated' };
    }
    // 実際のAPIキーの場合は長さをチェック
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
    
    // デモモードのレスポンス
    if (apiKey === 'demo') {
      // デモモード用の応答を返す
      return {
        message: `[デモモード] これはClaudeCodeのシミュレーション応答です。あなたのメッセージ: "${message}"`,
        sessionId: sessionId
      };
    }
    
    // 実際の実装では、ClaudeCodeAPIを呼び出します
    return {
      message: `これはClaudeCodeのシミュレーション応答です。あなたのメッセージ: "${message}"`,
      sessionId: sessionId
    };
  }
};

// 環境設定に基づいて適切なクライアントを選択
// 明示的に環境変数の値をチェックしてクライアントを決定
const claudeCode = process.env.USE_REAL_ANTHROPIC_API === 'true' ? 
  realClaudeCodeClient : mockClaudeCodeClient;

// 初期化時のログ出力
if (process.env.USE_REAL_ANTHROPIC_API === 'true') {
  logger.info('実際のAnthropic APIを使用します (USE_REAL_ANTHROPIC_API=true)');
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('ANTHROPIC_API_KEYが設定されていません。セッション作成時に提供されたAPIキーが使用されます。');
  } else {
    logger.info(`APIキーが設定されています: ${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...`);
  }
} else {
  logger.info('モックAnthropic APIを使用します (USE_REAL_ANTHROPIC_API=false)');
}

module.exports = {
  logger,
  connectDB,
  mongoose,
  claudeCode
};