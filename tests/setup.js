/**
 * Jest テスト実行時のグローバルセットアップファイル
 */

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
  } catch (error) {
    console.error('サーバー停止中にエラーが発生しました:', error);
  }
});