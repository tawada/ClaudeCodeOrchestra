/**
 * �թ��-�ա��
 * 
 * �������hSn-����W~Y
 * ��	pg
�MY�ShLgM~Y
 */

module.exports = {
  // ����-�
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  
  // ������-�
  database: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/claudecodechestra'
  },
  
  // JWT認証設定
  jwt: {
    secret: process.env.JWT_SECRET, // 環境変数から取得、デフォルト値なし
    expire: process.env.JWT_EXPIRE || '24h',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE || '24', 10)
  },
  
  // Anthropic API-�
  anthropic: {
    defaultModel: 'claude-3-opus-20240229',
    timeout: 60000,
    maxTokens: 4096
  },
  
  // �÷��-�
  sessions: {
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '120', 10)
  },
  
  // Git#:-�
  git: {
    enabled: process.env.GIT_INTEGRATION_ENABLED === 'true',
    provider: process.env.GIT_PROVIDER || 'github'
  },
  
  // CI/CD#:-�
  cicd: {
    enabled: process.env.CICD_ENABLED === 'true',
    provider: process.env.CICD_PROVIDER || 'github-actions'
  },
  
  // ��-�
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  // ���-�
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      enabled: process.env.LOG_TO_FILE === 'true',
      path: process.env.LOG_FILE_PATH || 'logs/app.log'
    }
  }
};