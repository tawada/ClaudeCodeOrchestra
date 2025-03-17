/**
 * 認証モデル
 * 
 * ユーザー情報とセッション管理のためのMongoDBモデルを定義します。
 * パスワードのハッシュ化やトークン検証などの機能も含みます。
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ユーザースキーマ定義
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'ユーザー名が必要です'],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'メールアドレスが必要です'],
    unique: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      '有効なメールアドレスを入力してください'
    ],
  },
  password: {
    type: String,
    required: [true, 'パスワードが必要です'],
    minlength: [6, 'パスワードは6文字以上である必要があります'],
    select: false, // パスワードはデフォルトでクエリに含まれない
  },
  salt: {
    type: String,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  projects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
}, {
  timestamps: true
});

// パスワードのハッシュ化
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  // ソルトの生成
  this.salt = crypto.randomBytes(16).toString('hex');
  
  // パスワードのハッシュ化
  this.password = crypto
    .pbkdf2Sync(this.password, this.salt, 1000, 64, 'sha512')
    .toString('hex');
    
  next();
});

// パスワード検証メソッド
userSchema.methods.matchPassword = function(enteredPassword) {
  const hash = crypto
    .pbkdf2Sync(enteredPassword, this.salt, 1000, 64, 'sha512')
    .toString('hex');
  return this.password === hash;
};

// JWTトークン生成メソッド
userSchema.methods.getSignedJwtToken = function() {
  // JWTシークレットが環境変数に設定されていない場合にエラーを投げる
  if (!process.env.JWT_SECRET) {
    throw new Error('環境変数JWT_SECRETが設定されていません。サーバーを起動する前に必ず設定してください。');
  }
  
  return jwt.sign(
    { id: this._id, username: this.username, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

const User = mongoose.model('User', userSchema);

module.exports = { User };