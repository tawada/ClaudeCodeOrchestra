/**
 * Claude対話ターミナルインターフェースのテスト
 */

// テストファイルのパス
const fs = require('fs');
const path = require('path');
const claudeTerminalPath = path.join(__dirname, '../../../public/claude-terminal.html');

describe('Claude対話ターミナルインターフェース', () => {
  test('HTMLファイルが存在すること', () => {
    expect(fs.existsSync(claudeTerminalPath)).toBe(true);
  });
  
  describe('HTML構造の確認', () => {
    let htmlContent;
    
    beforeAll(() => {
      // HTMLファイルの内容を読み込む
      htmlContent = fs.readFileSync(claudeTerminalPath, 'utf8');
    });
    
    test('必要なUI要素が含まれていること', () => {
      // ヘッダーセクション
      expect(htmlContent).toMatch(/<div class="header">/);
      expect(htmlContent).toMatch(/Claude Terminal/);
      expect(htmlContent).toMatch(/connection-status/);
      
      // ターミナル出力エリア
      expect(htmlContent).toMatch(/<div id="terminal"><\/div>/);
      
      // コントロールパネル
      expect(htmlContent).toMatch(/<div class="control-panel">/);
      expect(htmlContent).toMatch(/<input type="text" id="command-input"/);
      
      // ボタン
      expect(htmlContent).toMatch(/id="connect-btn"/);
      expect(htmlContent).toMatch(/id="clear-btn"/);
      expect(htmlContent).toMatch(/id="stop-btn"/);
    });
    
    test('必要なJavaScript関数が含まれていること', () => {
      // WebSocket関連関数
      expect(htmlContent).toMatch(/function connect\(\)/);
      expect(htmlContent).toMatch(/function disconnect\(\)/);
      expect(htmlContent).toMatch(/function sendCommand\(/);
      
      // UI関連関数
      expect(htmlContent).toMatch(/function appendToTerminal\(/);
      expect(htmlContent).toMatch(/function showSystemMessage\(/);
      expect(htmlContent).toMatch(/function showUserInput\(/);
      expect(htmlContent).toMatch(/function showClaudeOutput\(/);
      expect(htmlContent).toMatch(/function updateConnectionStatus\(/);
      
      // イベントリスナー
      expect(htmlContent).toMatch(/addEventListener\('click', connect\)/);
      expect(htmlContent).toMatch(/addEventListener\('keypress'/);
    });
    
    test('WebSocketの初期化とイベントハンドラが適切に実装されていること', () => {
      // WebSocket接続作成
      expect(htmlContent).toMatch(/socket = new WebSocket\(wsUrl\)/);
      
      // WebSocketイベントハンドラ
      expect(htmlContent).toMatch(/socket\.onopen =/);
      expect(htmlContent).toMatch(/socket\.onmessage =/);
      expect(htmlContent).toMatch(/socket\.onerror =/);
      expect(htmlContent).toMatch(/socket\.onclose =/);
      
      // 認証メッセージの送信
      expect(htmlContent).toMatch(/type: 'auth',/);
      expect(htmlContent).toMatch(/sessionId: sessionId/);
      
      // コマンドメッセージの送信
      expect(htmlContent).toMatch(/type: 'command',/);
    });
    
    test('セッションIDの取得と自動接続機能が実装されていること', () => {
      // URLからセッションIDを取得
      expect(htmlContent).toMatch(/function getSessionIdFromUrl\(\)/);
      expect(htmlContent).toMatch(/URLSearchParams\(window\.location\.search\)/);
      
      // 自動接続機能
      expect(htmlContent).toMatch(/if \(getSessionIdFromUrl\(\)\)/);
      expect(htmlContent).toMatch(/setTimeout\(connect,/);
    });
    
    test('エラーハンドリングが適切に実装されていること', () => {
      // エラーメッセージ表示
      expect(htmlContent).toMatch(/function showErrorMessage\(/);
      
      // WebSocketエラーハンドリング
      expect(htmlContent).toMatch(/socket\.onerror =/);
      
      // APIリクエストエラーハンドリング
      expect(htmlContent).toMatch(/\.catch\(error =>/);
    });
    
    test('レスポンシブデザイン用のCSSが含まれていること', () => {
      // メディアクエリ
      expect(htmlContent).toMatch(/@media \(max-width: 768px\)/);
      
      // フレックスボックスレイアウト
      expect(htmlContent).toMatch(/display: flex/);
      
      // モバイル最適化
      expect(htmlContent).toMatch(/flex-wrap: wrap/);
    });
  });
});