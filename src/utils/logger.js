/**
 * ロガーユーティリティ
 * 
 * アプリケーション全体で一貫したログ出力を提供します。
 * 開発環境ではコンソールに詳細なログを出力し、本番環境では
 * ファイルにログを保存します。
 */

const winston = require('winston');
const path = require('path');

// ログレベルの定義
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 環境に応じたログレベルを選択
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// ログのフォーマット設定
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// トランスポーターの設定
const transports = [
  // コンソールへの出力
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      format
    ),
  }),
  
  // エラーログをファイルに保存
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
  }),
  
  // 全てのログをファイルに保存
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
  }),
];

// ロガーインスタンスの作成
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

module.exports = logger;