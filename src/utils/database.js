/**
 * データベース接続ユーティリティ
 * 
 * MongoDBデータベースへの接続を管理し、接続状態を監視します。
 * アプリケーション全体で一貫したデータベース接続を提供します。
 */

const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * データベースに接続する
 * @returns {Promise} 接続結果を返すPromise
 */
const connectDB = async () => {
  try {
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/claudecodechestra';
    
    logger.info(`MongoDB接続を試みます: ${connectionString}`);
    mongoose.set('strictQuery', false);
    
    const conn = await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info(`MongoDBに接続しました: ${conn.connection.host}`);
    
    // 接続エラーのイベントリスナー
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDBエラー: ${err.message}`);
    });
    
    // 接続断のイベントリスナー
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDBから切断されました');
    });
    
    // プロセス終了時にクリーンアップ
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDBとの接続を終了しました');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    logger.error(`MongoDB接続エラー: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB, mongoose };