/**
 * 認証ミドルウェア
 * 
 * ルートの保護と認証状態の確認を行います。
 * JWTトークンの検証と認可チェックを実装します。
 */

const jwt = require('jsonwebtoken');
const { User } = require('./models');
const logger = require('../utils/logger');

/**
 * 保護されたルートへのアクセスを制限する
 * JWTトークンを検証し、リクエストにユーザー情報を添付します
 */
exports.protect = async (req, res, next) => {
  let token;
  
  // ヘッダーからトークンを取得
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // クッキーからトークンを取得
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // トークンが存在するか確認
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'このルートにアクセスするには認証が必要です'
    });
  }
  
  try {
    // JWT_SECRETが設定されているか確認
    if (!process.env.JWT_SECRET) {
      logger.error('環境変数JWT_SECRETが設定されていません');
      return res.status(500).json({
        success: false,
        message: 'サーバー設定エラー: JWT_SECRETが設定されていません'
      });
    }

    // トークンを検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ユーザーを取得
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'トークンに関連付けられたユーザーが見つかりません'
      });
    }
    
    // リクエストにユーザー情報を添付
    req.user = user;
    next();
    
  } catch (error) {
    logger.error(`認証エラー: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: '認証に失敗しました'
    });
  }
};

/**
 * 特定のロールを持つユーザーのみアクセスを許可
 * @param  {...String} roles - 許可されたロールのリスト
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `ロール「${req.user.role}」にはこのリソースへのアクセス権限がありません`
      });
    }
    next();
  };
};