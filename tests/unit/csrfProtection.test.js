/**
 * ClaudeCodeOrchestra - CSRF Protection Tests
 */
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');

describe('CSRF保護機能のテスト', () => {
  let app;
  let server;
  let csrfToken;
  let cookies;

  beforeAll(() => {
    // テスト用のExpressアプリを作成
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // CSRF保護設定
    const csrfProtection = csrf({ 
      cookie: { 
        httpOnly: true,
        secure: false,
        sameSite: 'strict' 
      } 
    });

    // CSRFトークン取得エンドポイント
    app.get('/api/csrf-token', csrfProtection, (req, res) => {
      res.json({ csrfToken: req.csrfToken() });
    });

    // CSRF保護付きのPOSTエンドポイント
    app.post('/api/protected', csrfProtection, (req, res) => {
      res.json({ success: true, data: req.body });
    });

    // CSRF保護なしのPOSTエンドポイント（比較用）
    app.post('/api/unprotected', (req, res) => {
      res.json({ success: true, data: req.body });
    });

    // サーバーをリスニング
    server = app.listen(3001);
  });

  afterAll(async () => {
    return new Promise((resolve) => {
      // テスト後にサーバーをクローズ
      server.close(() => {
        resolve();
      });
    });
  });

  test('CSRFトークンが取得できること', async () => {
    const response = await request(app)
      .get('/api/csrf-token')
      .expect(200);
    
    // トークンとクッキーの存在を確認
    expect(response.body).toHaveProperty('csrfToken');
    expect(response.headers['set-cookie']).toBeDefined();
    
    // 以降のテストのために保存
    csrfToken = response.body.csrfToken;
    cookies = response.headers['set-cookie'];
  });

  test('CSRFトークンを含むリクエストが保護されたエンドポイントにアクセスできること', async () => {
    // テストデータ
    const testData = { name: 'テスト' };
    
    // トークンを含めたリクエスト
    const response = await request(app)
      .post('/api/protected')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send(testData)
      .expect(200);
    
    // レスポンスを検証
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toEqual(testData);
  });

  test('CSRFトークンなしのリクエストが保護されたエンドポイントにアクセスできないこと', async () => {
    // テストデータ
    const testData = { name: 'トークンなし' };
    
    // トークンなしのリクエスト
    await request(app)
      .post('/api/protected')
      .set('Cookie', cookies)
      .send(testData)
      .expect(403); // CSRF検証エラーで403を期待
  });

  test('無効なCSRFトークンでは保護されたエンドポイントにアクセスできないこと', async () => {
    // テストデータ
    const testData = { name: '無効なトークン' };
    
    // 無効なトークンを含めたリクエスト
    await request(app)
      .post('/api/protected')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', 'invalid-token')
      .send(testData)
      .expect(403); // CSRF検証エラーで403を期待
  });

  test('CSRFトークンなしのリクエストでも非保護エンドポイントにはアクセスできること', async () => {
    // テストデータ
    const testData = { name: '非保護' };
    
    // 非保護エンドポイントへのリクエスト
    const response = await request(app)
      .post('/api/unprotected')
      .send(testData)
      .expect(200);
    
    // レスポンスを検証
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toEqual(testData);
  });
});