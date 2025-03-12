/**
 * ClaudeCodeOrchestra - API Integration Tests
 */
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const csrf = require('csurf');
const path = require('path');
const fs = require('fs');

// モック
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('APIエンドポイントの統合テスト', () => {
  let app;
  let server;
  let csrfToken;
  let cookies;
  
  // テストデータ
  const testProject = {
    name: 'テスト用プロジェクト',
    description: 'API統合テスト用'
  };
  
  let createdProject = null;
  let createdSession = null;

  beforeAll(async () => {
    // モックモードでアプリをインポート
    process.env.NODE_ENV = 'test';
    process.env.USE_MONGODB = 'false';
    
    // テスト用の一時ディレクトリを作成
    const testDataDir = path.join(__dirname, '../../data/test');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    // アプリケーションをインポート
    const appModule = require('../../src/index');
    
    // すでに存在するExpressアプリを使用
    app = appModule.app;
    
    // テスト用サーバーをリスニング
    server = app.listen(3002);
    
    // CSRFトークンを取得
    const response = await request(server)
      .get('/api/csrf-token')
      .expect(200);
    
    csrfToken = response.body.csrfToken;
    cookies = response.headers['set-cookie'];
  });

  afterAll((done) => {
    // テスト用ファイルを削除
    try {
      const testDataDir = path.join(__dirname, '../../data/test');
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('テストデータクリーンアップエラー:', error);
    }
    
    // サーバーをクローズ
    server.close(done);
  });

  test('プロジェクト一覧の取得', async () => {
    const response = await request(server)
      .get('/api/projects')
      .expect(200);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('プロジェクトの作成', async () => {
    const response = await request(server)
      .post('/api/projects')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send(testProject)
      .expect(201);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('name', testProject.name);
    expect(response.body.data).toHaveProperty('description', testProject.description);
    
    // 後続のテストのために保存
    createdProject = response.body.data;
  });

  test('セッションの作成', async () => {
    // プロジェクトが作成されていることを確認
    expect(createdProject).not.toBeNull();
    
    const response = await request(server)
      .post('/api/sessions')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ projectId: createdProject.id })
      .expect(201);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('projectId', createdProject.id);
    expect(response.body.data).toHaveProperty('status', 'active');
    
    // 後続のテストのために保存
    createdSession = response.body.data;
  });

  test('セッション一覧の取得', async () => {
    const response = await request(server)
      .get('/api/sessions')
      .expect(200);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    
    // 先ほど作成したセッションが含まれていることを確認
    const foundSession = response.body.data.find(s => s.id === createdSession.id);
    expect(foundSession).toBeDefined();
  });

  test('個別セッションの取得', async () => {
    // セッションが作成されていることを確認
    expect(createdSession).not.toBeNull();
    
    const response = await request(server)
      .get(`/api/sessions/${createdSession.id}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('id', createdSession.id);
    expect(response.body.data).toHaveProperty('projectId', createdProject.id);
    expect(response.body.data).toHaveProperty('messages');
    expect(Array.isArray(response.body.data.messages)).toBe(true);
  });

  test('セッションへのメッセージ送信', async () => {
    // セッションが作成されていることを確認
    expect(createdSession).not.toBeNull();
    
    const testMessage = 'これはテストメッセージです';
    
    const response = await request(server)
      .post(`/api/sessions/${createdSession.id}/message`)
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ message: testMessage })
      .expect(200);
    
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('message');
    expect(response.body.data).toHaveProperty('sessionId', createdSession.id);
    expect(response.body.data).toHaveProperty('messageCount');
    expect(response.body.data.messageCount).toBeGreaterThan(0);
  });

  test('CSRFトークンなしでプロジェクト作成に失敗すること', async () => {
    await request(server)
      .post('/api/projects')
      .set('Cookie', cookies)
      .send(testProject)
      .expect(403); // CSRF検証エラーで403を期待
  });

  test('CSRFトークンなしでセッション作成に失敗すること', async () => {
    await request(server)
      .post('/api/sessions')
      .set('Cookie', cookies)
      .send({ projectId: createdProject.id })
      .expect(403); // CSRF検証エラーで403を期待
  });

  test('CSRFトークンなしでメッセージ送信に失敗すること', async () => {
    await request(server)
      .post(`/api/sessions/${createdSession.id}/message`)
      .set('Cookie', cookies)
      .send({ message: 'テスト' })
      .expect(403); // CSRF検証エラーで403を期待
  });
});