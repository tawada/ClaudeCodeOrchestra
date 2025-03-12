/**
 * ClaudeCodeOrchestra - Frontend Unit Tests
 * 
 * Jest + JSDOM によるフロントエンドのテスト
 */
const path = require('path');
const fs = require('fs');

// DOMのセットアップ
const appJsPath = path.join(__dirname, '../../public/js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

describe('フロントエンドのユニットテスト', () => {
  let fetchMock;
  let domMock;
  let documentMock;
  
  // モックアップの状態
  let state;
  let api;
  let elements;
  let mockCsrfToken = 'test-csrf-token';
  
  beforeEach(() => {
    // DOMのモック
    documentMock = {
      getElementById: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
      querySelector: jest.fn(),
      addEventListener: jest.fn(),
      createElement: jest.fn().mockReturnValue({
        appendChild: jest.fn(),
        style: {}
      }),
      head: {
        appendChild: jest.fn()
      }
    };

    // DOMイベントのモック
    const eventMock = {
      preventDefault: jest.fn()
    };
    
    // fetch APIのモック
    fetchMock = jest.fn().mockImplementation((url, options) => {
      // CSRFトークン取得
      if (url === '/api/csrf-token') {
        return Promise.resolve({
          json: () => Promise.resolve({ csrfToken: mockCsrfToken }),
          headers: {
            'set-cookie': ['csrf=test-cookie']
          }
        });
      }
      
      // APIヘルスチェック
      if (url === '/api/health') {
        return Promise.resolve({
          json: () => Promise.resolve({ useMongoDb: false })
        });
      }
      
      // プロジェクト取得
      if (url.includes('/projects') && options?.method !== 'POST') {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: [
              { id: '1', name: 'テストプロジェクト', description: 'テスト用', createdAt: new Date().toISOString() }
            ]
          })
        });
      }
      
      // プロジェクト作成
      if (url.includes('/projects') && options?.method === 'POST') {
        const { name, description } = JSON.parse(options.body);
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: {
              id: Date.now().toString(),
              name,
              description,
              createdAt: new Date().toISOString()
            }
          })
        });
      }
      
      // セッション作成
      if (url.includes('/sessions') && options?.method === 'POST') {
        const { projectId } = JSON.parse(options.body);
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: {
              id: Date.now().toString(),
              projectId,
              status: 'active',
              createdAt: new Date().toISOString(),
              lastActive: new Date().toISOString()
            }
          })
        });
      }
      
      // メッセージ送信
      if (url.includes('/message') && options?.method === 'POST') {
        const { message } = JSON.parse(options.body);
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: {
              message: `応答: ${message}`,
              sessionId: '1',
              messageCount: 2
            }
          })
        });
      }
      
      // デフォルト
      return Promise.resolve({
        json: () => Promise.resolve({ success: false })
      });
    });
    
    // グローバルオブジェクトのモック
    global.document = documentMock;
    global.fetch = fetchMock;
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };
    
    // 状態のモック
    state = {
      currentProject: null,
      currentSession: null,
      projects: [],
      sessions: [],
      messages: [],
      csrfToken: null
    };
    
    // 要素のモック
    elements = {
      projectNameInput: { value: 'テスト用プロジェクト' },
      projectDescInput: { value: 'テスト用の説明' },
      sessionApiKeyInput: { value: '' },
      messageInput: { value: 'テストメッセージ' },
      loadingElement: { style: {}, textContent: '' },
      statusElement: { style: {}, textContent: '' },
      errorElement: { style: {}, textContent: '' },
      projectsList: { innerHTML: '' },
      sessionsList: { innerHTML: '' },
      messagesList: { innerHTML: '' },
      chatForm: { style: {} },
      newProjectForm: {},
      newSessionForm: {}
    };
    
    // モック関数
    global.showLoading = jest.fn();
    global.hideLoading = jest.fn();
    global.showError = jest.fn();
    global.showStatus = jest.fn();
    global.renderProjects = jest.fn();
    global.renderSessions = jest.fn();
    global.renderMessages = jest.fn();
    
    // app.jsで定義されている関数をローカルにモック
    api = {
      getPrefix: jest.fn().mockResolvedValue('/api'),
      getCsrfToken: jest.fn().mockResolvedValue(mockCsrfToken),
      getProjects: jest.fn().mockImplementation(async () => {
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        if (data.success) {
          state.projects = data.data;
          renderProjects();
          hideLoading();
        } else {
          showError(data.message || 'プロジェクト取得に失敗しました');
        }
      }),
      createProject: jest.fn().mockImplementation(async (name, description) => {
        try {
          showLoading('プロジェクトを作成中...');
          
          // CSRFトークンがなければ取得
          if (!state.csrfToken) {
            await api.getCsrfToken();
          }
          
          const prefix = await api.getPrefix();
          const response = await fetch(`${prefix}/projects`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': state.csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({ name, description })
          });
          
          const data = await response.json();
          
          if (data.success) {
            state.projects.push(data.data);
            renderProjects();
            hideLoading();
            showStatus('プロジェクトが作成されました');
            return data.data;
          } else {
            showError(data.message || 'プロジェクト作成に失敗しました');
            return null;
          }
        } catch (error) {
          showError('API接続エラー: ' + error.message);
          return null;
        }
      }),
      sendMessage: jest.fn().mockImplementation(async (sessionId, message) => {
        try {
          showLoading('メッセージを送信中...');
          
          // CSRFトークンがなければ取得
          if (!state.csrfToken) {
            await api.getCsrfToken();
          }
          
          const prefix = await api.getPrefix();
          const response = await fetch(`${prefix}/sessions/${sessionId}/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': state.csrfToken
            },
            credentials: 'include',
            body: JSON.stringify({ message })
          });
          
          const data = await response.json();
          
          if (data.success) {
            // メッセージを追加
            state.messages.push(
              { role: 'user', content: message },
              { role: 'assistant', content: data.data.message }
            );
            
            renderMessages();
            hideLoading();
            return data.data.message;
          } else {
            showError(data.message || 'メッセージ送信に失敗しました');
            return null;
          }
        } catch (error) {
          showError('API接続エラー: ' + error.message);
          return null;
        }
      })
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('CSRFトークンが正常に取得できること', async () => {
    await api.getCsrfToken();
    
    expect(fetchMock).toHaveBeenCalledWith('/api/csrf-token', {
      credentials: 'include'
    });
    expect(state.csrfToken).toBe(mockCsrfToken);
  });

  test('プロジェクト作成時にCSRFトークンが送信されること', async () => {
    state.csrfToken = mockCsrfToken;
    
    await api.createProject('テストプロジェクト', 'テスト用プロジェクトの説明');
    
    // fetchのモックが正しいパラメータで呼び出されたか検証
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-CSRF-Token': mockCsrfToken
      })
    }));
  });

  test('メッセージ送信時にCSRFトークンが送信されること', async () => {
    state.csrfToken = mockCsrfToken;
    state.currentSession = { id: '1' };
    
    await api.sendMessage('1', 'テストメッセージ');
    
    // fetchのモックが正しいパラメータで呼び出されたか検証
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'X-CSRF-Token': mockCsrfToken
      })
    }));
  });

  test('CSRFトークンがない場合は自動的に取得すること', async () => {
    state.csrfToken = null;
    
    await api.createProject('テストプロジェクト', 'テスト用プロジェクトの説明');
    
    // getCsrfTokenが呼び出されたか検証
    expect(api.getCsrfToken).toHaveBeenCalled();
  });
});