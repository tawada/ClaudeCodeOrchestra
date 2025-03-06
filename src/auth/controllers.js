/**
 * 認証コントローラー
 * 
 * ユーザー登録、ログイン、トークン検証などの認証機能を実装します。
 * 各エンドポイントに対応する処理を定義します。
 */

const { User } = require('./models');
const logger = require('../utils/logger');

/**
 * ユーザー登録
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // 必須フィールドの確認
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'すべてのフィールドが必要です'
      });
    }
    
    // ユーザーが既に存在するか確認
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'ユーザー名またはメールアドレスは既に使用されています'
      });
    }
    
    // 新しいユーザーを作成
    const user = await User.create({
      username,
      email,
      password
    });
    
    // トークンを生成してレスポンスを送信
    sendTokenResponse(user, 201, res);
    
  } catch (error) {
    logger.error(`登録エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * ユーザーログイン
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // メールとパスワードが提供されたか確認
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'メールアドレスとパスワードを入力してください'
      });
    }
    
    // パスワードを含めてユーザーを検索
    const user = await User.findOne({ email }).select('+password +salt');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '無効な認証情報'
      });
    }
    
    // パスワードが一致するか確認
    const isMatch = user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '無効な認証情報'
      });
    }
    
    // トークンを生成してレスポンスを送信
    sendTokenResponse(user, 200, res);
    
  } catch (error) {
    logger.error(`ログインエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * ユーザーログアウト
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  
  res.status(200).json({
    success: true,
    message: 'ログアウトしました'
  });
};

/**
 * 現在のユーザー情報を取得
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('projects');
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`ユーザー情報取得エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * JWTトークンを作成してクッキーとして送信する
 * @param {Object} user - ユーザーオブジェクト
 * @param {Number} statusCode - HTTPステータスコード
 * @param {Object} res - レスポンスオブジェクト
 */
const sendTokenResponse = (user, statusCode, res) => {
  // トークンの生成
  const token = user.getSignedJwtToken();
  
  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 24) * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  
  // 本番環境の場合はセキュアフラグを設定
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }
  
  // ユーザーの基本情報を抽出
  const userData = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role
  };
  
  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: userData
    });
};