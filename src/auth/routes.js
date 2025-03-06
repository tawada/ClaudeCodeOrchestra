/**
 * 認証ルーター
 * 
 * 認証に関連するエンドポイントを定義し、コントローラーにルーティングします。
 */

const express = require('express');
const router = express.Router();
const controllers = require('./controllers');
const {
  register,
  login,
  logout,
  getMe
} = controllers;
const { protect } = require('./middleware');

// ユーザー登録
router.post('/register', register);

// ログイン
router.post('/login', login);

// ログアウト
router.get('/logout', logout);

// 現在のユーザー情報取得（保護されたルート）
router.get('/me', protect, getMe);

module.exports = router;