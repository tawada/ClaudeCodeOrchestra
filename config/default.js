/**
 * ÇÕ©ëÈ-šÕ¡¤ë
 * 
 * ¢×ê±ü·çóhSn-š’š©W~Y
 * °ƒ	pg
øMY‹ShLgM~Y
 */

module.exports = {
  // µüĞü-š
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  
  // Çü¿Ùü¹-š
  database: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/claudecodechestra'
  },
  
  // JWT<-š
  jwt: {
    secret: process.env.JWT_SECRET || 'devsecretkey',
    expire: process.env.JWT_EXPIRE || '24h',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE || '24', 10)
  },
  
  // Anthropic API-š
  anthropic: {
    defaultModel: 'claude-3-opus-20240229',
    timeout: 60000,
    maxTokens: 4096
  },
  
  // »Ã·çó¡-š
  sessions: {
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
    sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '120', 10)
  },
  
  // Git#:-š
  git: {
    enabled: process.env.GIT_INTEGRATION_ENABLED === 'true',
    provider: process.env.GIT_PROVIDER || 'github'
  },
  
  // CI/CD#:-š
  cicd: {
    enabled: process.env.CICD_ENABLED === 'true',
    provider: process.env.CICD_PROVIDER || 'github-actions'
  },
  
  // ³ë¹-š
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  // í®ó°-š
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      enabled: process.env.LOG_TO_FILE === 'true',
      path: process.env.LOG_FILE_PATH || 'logs/app.log'
    }
  }
};