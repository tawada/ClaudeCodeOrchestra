/**
 * セッションモデル
 * 
 * ClaudeCodeセッションとプロジェクト管理のためのMongoDBモデルを定義します。
 * セッション状態やメタデータを保存します。
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// プロジェクトスキーマ定義
const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'プロジェクト名が必要です'],
    trim: true,
    maxlength: [100, 'プロジェクト名は100文字以内である必要があります']
  },
  description: {
    type: String,
    maxlength: [500, '説明は500文字以内である必要があります']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  repoUrl: {
    type: String,
    match: [
      /^(https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+|)$/,
      'GitHub URLの形式が正しくありません（空でも可）'
    ]
  },
  deploymentUrl: String,
  isPublic: {
    type: Boolean,
    default: false
  },
  sessions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ClaudeCodeセッションスキーマ定義
const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    default: () => uuidv4(),
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  status: {
    type: String,
    enum: ['idle', 'active', 'error', 'terminated'],
    default: 'idle'
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  anthropicApiKey: {
    type: String,
    select: false // APIキーはデフォルトでクエリに含まれない
  },
  anthropicSessionId: String,
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    browserInfo: String,
    deviceType: String,
    ipAddress: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// セッションがアクティブになった時刻を更新
sessionSchema.methods.updateLastActive = function() {
  this.lastActive = Date.now();
  return this.save();
};

// セッションにメッセージを追加
sessionSchema.methods.addMessage = function(role, content) {
  this.messages.push({
    role,
    content,
    timestamp: Date.now()
  });
  this.lastActive = Date.now();
  return this.save();
};

const Project = mongoose.model('Project', projectSchema);
const Session = mongoose.model('Session', sessionSchema);

module.exports = { Project, Session };