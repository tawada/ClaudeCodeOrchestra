/**
 * セッションルーター
 * 
 * プロジェクトとClaudeCodeセッション管理のためのエンドポイントを定義します。
 */

const express = require('express');
const router = express.Router();
const controllers = require('./controllers');
const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  startSession,
  sendMessage,
  getSessionHistory,
  terminateSession
} = controllers;
const { protect } = require('../auth/middleware');

// すべてのルートを保護
router.use(protect);

// プロジェクト関連ルート
router.route('/projects')
  .get(getProjects)
  .post(createProject);

router.route('/projects/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject);

// セッション関連ルート
router.post('/start', startSession);
router.post('/:id/message', sendMessage);
router.get('/:id/history', getSessionHistory);
router.put('/:id/terminate', terminateSession);

module.exports = router;