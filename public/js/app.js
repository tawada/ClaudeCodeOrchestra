/**
 * ClaudeCodeOrchestra モバイルインターフェース
 * 
 * スマートフォンからのAPI操作と、ClaudeCodeセッション管理のためのフロントエンドです。
 */

// グローバル状態管理
const state = {
  currentProject: null,
  currentSession: null,
  projects: [],
  sessions: [],
  messages: [],
};

// DOM要素の参照
const elements = {
  tabProjects: document.getElementById('tab-projects'),
  tabSessions: document.getElementById('tab-sessions'),
  tabChat: document.getElementById('tab-chat'),
  
  contentProjects: document.getElementById('content-projects'),
  contentSessions: document.getElementById('content-sessions'),
  contentChat: document.getElementById('content-chat'),
  
  projectsList: document.getElementById('projects-list'),
  sessionsList: document.getElementById('sessions-list'),
  messagesList: document.getElementById('messages-list'),
  
  newProjectForm: document.getElementById('new-project-form'),
  newSessionForm: document.getElementById('new-session-form'),
  chatForm: document.getElementById('chat-form'),
  
  projectNameInput: document.getElementById('project-name'),
  projectDescInput: document.getElementById('project-description'),
  sessionApiKeyInput: document.getElementById('session-api-key'),
  messageInput: document.getElementById('message-input'),
  
  statusElement: document.getElementById('status'),
  loadingElement: document.getElementById('loading'),
  errorElement: document.getElementById('error'),
  
  bottomNavProjects: document.getElementById('nav-projects'),
  bottomNavSessions: document.getElementById('nav-sessions'),
  bottomNavChat: document.getElementById('nav-chat'),
};

// API関連の関数
const api = {
  // APIエンドポイントのプレフィックス
  apiPrefix: '/api',
  mockPrefix: '/api/mock',
  
  // 環境に応じたプレフィックスを取得
  getPrefix() {
    // モック環境かどうかを判定
    // サーバー側の環境変数USE_MONGODBがtrueの場合は本物のAPI
    // falseの場合はモック
    return this.mockPrefix;
  },
  
  // プロジェクト関連
  async getProjects() {
    try {
      showLoading('プロジェクト一覧を取得中...');
      const response = await fetch(`${this.getPrefix()}/projects`);
      const data = await response.json();
      
      if (data.success) {
        state.projects = data.data;
        renderProjects();
        hideLoading();
        
        // プロジェクトが0件の場合はガイダンスを表示
        if (state.projects.length === 0) {
          // プロジェクト作成フォームを強調
          const formCard = document.querySelector('#content-projects .card');
          if (formCard) {
            formCard.style.boxShadow = '0 0 10px rgba(123, 31, 162, 0.5)';
            formCard.style.animation = 'pulse 2s infinite';
            
            // スタイルを追加
            const style = document.createElement('style');
            style.textContent = `
              @keyframes pulse {
                0% { box-shadow: 0 0 10px rgba(123, 31, 162, 0.5); }
                50% { box-shadow: 0 0 15px rgba(123, 31, 162, 0.8); }
                100% { box-shadow: 0 0 10px rgba(123, 31, 162, 0.5); }
              }
            `;
            document.head.appendChild(style);
          }
        }
      } else {
        showError(data.message || 'プロジェクト取得に失敗しました');
      }
    } catch (error) {
      showError('API接続エラー: ' + error.message);
    }
  },
  
  async createProject(name, description) {
    try {
      showLoading('プロジェクトを作成中...');
      const response = await fetch(`${this.getPrefix()}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
  },
  
  // セッション関連
  async createSession(projectId, anthropicApiKey) {
    try {
      showLoading('セッションを開始中...');
      const response = await fetch(`${this.getPrefix()}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          projectId, 
          anthropicApiKey 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        state.sessions.push(data.data);
        renderSessions();
        hideLoading();
        showStatus('セッションが開始されました');
        return data.data;
      } else {
        showError(data.message || 'セッション開始に失敗しました');
        return null;
      }
    } catch (error) {
      showError('API接続エラー: ' + error.message);
      return null;
    }
  },
  
  async sendMessage(sessionId, message) {
    try {
      showLoading('メッセージを送信中...');
      const response = await fetch(`${this.getPrefix()}/sessions/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
  }
};

// UI制御関数
function showTab(tabId) {
  // すべてのタブとコンテンツを非アクティブにする
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.querySelectorAll('.bottom-nav a').forEach(item => item.classList.remove('active'));
  
  // 選択したタブとコンテンツをアクティブにする
  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.getElementById(`content-${tabId}`).classList.add('active');
  document.getElementById(`nav-${tabId}`).classList.add('active');
  
  // タブに応じたアクションを実行
  switch (tabId) {
    case 'projects':
      api.getProjects();
      break;
    case 'sessions':
      renderSessions();
      break;
    case 'chat':
      renderMessages();
      break;
  }
}

function showLoading(message = '処理中...') {
  elements.loadingElement.textContent = message;
  elements.loadingElement.style.display = 'block';
  elements.errorElement.style.display = 'none';
}

function hideLoading() {
  elements.loadingElement.style.display = 'none';
}

function showError(message) {
  elements.errorElement.textContent = message;
  elements.errorElement.style.display = 'block';
  elements.loadingElement.style.display = 'none';
  
  // 3秒後に非表示
  setTimeout(() => {
    elements.errorElement.style.display = 'none';
  }, 3000);
}

function showStatus(message) {
  elements.statusElement.textContent = message;
  elements.statusElement.style.display = 'block';
  
  // 3秒後に非表示
  setTimeout(() => {
    elements.statusElement.style.display = 'none';
  }, 3000);
}

// レンダリング関数
function renderProjects() {
  if (!elements.projectsList) return;
  
  elements.projectsList.innerHTML = '';
  
  if (state.projects.length === 0) {
    elements.projectsList.innerHTML = '<div class="card"><p>プロジェクトがありません。新しいプロジェクトを作成してください。</p></div>';
    return;
  }
  
  state.projects.forEach(project => {
    const projectCard = document.createElement('div');
    projectCard.className = 'card';
    projectCard.innerHTML = `
      <h3 class="card-title">${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description || '説明なし')}</p>
      <p><small>作成日: ${new Date(project.createdAt).toLocaleString()}</small></p>
      <button class="btn select-project" data-id="${project.id}">プロジェクトを選択</button>
    `;
    
    projectCard.querySelector('.select-project').addEventListener('click', () => {
      state.currentProject = project;
      showTab('sessions');
    });
    
    elements.projectsList.appendChild(projectCard);
  });
}

function renderSessions() {
  if (!elements.sessionsList) return;
  
  elements.sessionsList.innerHTML = '';
  
  if (!state.currentProject) {
    elements.sessionsList.innerHTML = '<div class="card"><p>プロジェクトが選択されていません。プロジェクトを選択してください。</p></div>';
    return;
  }
  
  // プロジェクト情報表示
  const projectInfo = document.createElement('div');
  projectInfo.className = 'card';
  projectInfo.innerHTML = `
    <h3 class="card-title">現在のプロジェクト: ${escapeHtml(state.currentProject.name)}</h3>
    <p>${escapeHtml(state.currentProject.description || '説明なし')}</p>
  `;
  elements.sessionsList.appendChild(projectInfo);
  
  // このプロジェクトのセッションをフィルタリング
  const projectSessions = state.sessions.filter(
    session => session.projectId === state.currentProject.id
  );
  
  if (projectSessions.length === 0) {
    const noSessions = document.createElement('div');
    noSessions.className = 'card';
    noSessions.innerHTML = '<p>このプロジェクトにはセッションがありません。新しいセッションを開始してください。</p>';
    elements.sessionsList.appendChild(noSessions);
  } else {
    projectSessions.forEach(session => {
      const sessionCard = document.createElement('div');
      sessionCard.className = 'card';
      sessionCard.innerHTML = `
        <h3 class="card-title">セッション ID: ${session.id}</h3>
        <p>ステータス: ${session.status}</p>
        <p><small>最終アクティブ: ${new Date(session.lastActive).toLocaleString()}</small></p>
        <button class="btn select-session" data-id="${session.id}">セッションを選択</button>
      `;
      
      sessionCard.querySelector('.select-session').addEventListener('click', () => {
        state.currentSession = session;
        state.messages = session.messages || [];
        showTab('chat');
      });
      
      elements.sessionsList.appendChild(sessionCard);
    });
  }
}

function renderMessages() {
  if (!elements.messagesList) return;
  
  elements.messagesList.innerHTML = '';
  
  if (!state.currentSession) {
    elements.messagesList.innerHTML = '<div class="card"><p>セッションが選択されていません。セッションを選択してください。</p></div>';
    elements.chatForm.style.display = 'none';
    return;
  }
  
  // セッション情報表示
  const sessionInfo = document.createElement('div');
  sessionInfo.className = 'card';
  sessionInfo.innerHTML = `
    <h3 class="card-title">セッション ID: ${state.currentSession.id}</h3>
    <p>プロジェクト: ${state.currentProject ? escapeHtml(state.currentProject.name) : '不明'}</p>
    <p>ステータス: ${state.currentSession.status}</p>
  `;
  elements.messagesList.appendChild(sessionInfo);
  
  // メッセージ表示
  const messageContainer = document.createElement('div');
  messageContainer.className = 'message-container';
  
  if (state.messages.length === 0) {
    messageContainer.innerHTML = '<p class="text-center">メッセージがありません。会話を開始してください。</p>';
  } else {
    state.messages.forEach(msg => {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${msg.role}`;
      messageElement.textContent = msg.content;
      messageContainer.appendChild(messageElement);
    });
    
    // 最新のメッセージが見えるようにスクロール
    setTimeout(() => {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }, 100);
  }
  
  elements.messagesList.appendChild(messageContainer);
  elements.chatForm.style.display = 'block';
}

// ユーティリティ関数
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// イベントリスナー設定
function setupEventListeners() {
  // タブ切り替え
  elements.tabProjects?.addEventListener('click', () => showTab('projects'));
  elements.tabSessions?.addEventListener('click', () => showTab('sessions'));
  elements.tabChat?.addEventListener('click', () => showTab('chat'));
  
  elements.bottomNavProjects?.addEventListener('click', (e) => {
    e.preventDefault();
    showTab('projects');
  });
  elements.bottomNavSessions?.addEventListener('click', (e) => {
    e.preventDefault();
    showTab('sessions');
  });
  elements.bottomNavChat?.addEventListener('click', (e) => {
    e.preventDefault();
    showTab('chat');
  });
  
  // 新規プロジェクト作成フォーム
  elements.newProjectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = elements.projectNameInput.value.trim();
    const description = elements.projectDescInput.value.trim();
    
    if (name === '') {
      showError('プロジェクト名を入力してください');
      return;
    }
    
    const project = await api.createProject(name, description);
    if (project) {
      elements.projectNameInput.value = '';
      elements.projectDescInput.value = '';
    }
  });
  
  // 新規セッション開始フォーム
  elements.newSessionForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const apiKey = elements.sessionApiKeyInput.value.trim();
    
    if (!state.currentProject) {
      showError('先にプロジェクトを選択してください');
      return;
    }
    
    if (apiKey === '') {
      showError('APIキーを入力してください');
      return;
    }
    
    const session = await api.createSession(state.currentProject.id, apiKey);
    if (session) {
      elements.sessionApiKeyInput.value = '';
      state.currentSession = session;
      state.messages = [];
      showTab('chat');
    }
  });
  
  // チャットフォーム
  elements.chatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = elements.messageInput.value.trim();
    
    if (!state.currentSession) {
      showError('先にセッションを選択してください');
      return;
    }
    
    if (message === '') {
      showError('メッセージを入力してください');
      return;
    }
    
    const response = await api.sendMessage(state.currentSession.id, message);
    if (response) {
      elements.messageInput.value = '';
    }
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // プロジェクト一覧をロード
  api.getProjects();
  
  // 初期タブ表示
  showTab('projects');
});