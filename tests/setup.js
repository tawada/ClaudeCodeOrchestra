/**
 * Jest テスト実行時のグローバルセットアップファイル
 * 
 * このファイルには、すべてのテストファイルで共有されるセットアップコードを含みます。
 */

// Node.jsのPromiseエラーを表示
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// グローバル変数の設定
global.TEST_ENV = true;

// テスト実行前の処理
beforeAll(() => {
  // テスト環境フラグを設定
  process.env.NODE_ENV = 'test';
  
  // WebSocketやその他のモック化が必要なモジュールのモックをセットアップ
  jest.setTimeout(10000); // タイムアウトを10秒に設定
});

// テスト実行後にクリーンアップを行う
afterAll(async () => {
  // Node.js内部の処理やタイマーなどをクリーンアップする猶予を与える
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // もし必要なら、app.jsからstopServer関数をインポートして実行することも可能
  try {
    const { stopServer } = require('../src/index');
    if (typeof stopServer === 'function') {
      await stopServer();
    }
    
    // Claude対話型プロセスのクリーンアップ
    try {
      const claudeProcess = require('../src/utils/claudeProcess');
      if (typeof claudeProcess.cleanupAllProcesses === 'function') {
        claudeProcess.cleanupAllProcesses();
      }
    } catch (error) {
      // claudeProcessモジュールが見つからない場合は無視
    }
  } catch (error) {
    console.error('サーバー停止中にエラーが発生しました:', error);
  }
});