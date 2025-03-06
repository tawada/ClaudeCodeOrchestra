/**
 * セッションコントローラー
 * 
 * プロジェクトとClaudeCodeセッション管理のためのコントローラーを実装します。
 * プロジェクトの作成・取得・更新、セッションの開始・終了などの機能を提供します。
 */

const { Project, Session } = require('./models');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { claudeCode } = require('../utils');

/**
 * 新しいプロジェクトを作成
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.createProject = async (req, res) => {
  try {
    const { name, description, repoUrl, isPublic } = req.body;
    
    // プロジェクト名が提供されたか確認
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'プロジェクト名が必要です'
      });
    }
    
    // プロジェクトを作成
    const project = await Project.create({
      name,
      description,
      repoUrl,
      isPublic: isPublic || false,
      owner: req.user.id
    });
    
    // ユーザーのプロジェクト配列に追加
    req.user.projects.push(project._id);
    await req.user.save();
    
    res.status(201).json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logger.error(`プロジェクト作成エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * すべてのプロジェクトを取得（ユーザーに関連するもののみ）
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.getProjects = async (req, res) => {
  try {
    // ユーザーが所有または共同作業者であるプロジェクトを取得
    const projects = await Project.find({
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id }
      ]
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
    
  } catch (error) {
    logger.error(`プロジェクト取得エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * 特定のプロジェクトを取得
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('sessions')
      .populate('owner', 'username email')
      .populate('collaborators', 'username email');
    
    // プロジェクトが存在するか確認
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'プロジェクトが見つかりません'
      });
    }
    
    // アクセス権があるか確認
    if (
      project.owner.toString() !== req.user.id &&
      !project.collaborators.some(collab => collab._id.toString() === req.user.id) &&
      !project.isPublic
    ) {
      return res.status(403).json({
        success: false,
        message: 'このプロジェクトへのアクセス権限がありません'
      });
    }
    
    res.status(200).json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logger.error(`プロジェクト取得エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * プロジェクトを更新
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.updateProject = async (req, res) => {
  try {
    let project = await Project.findById(req.params.id);
    
    // プロジェクトが存在するか確認
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'プロジェクトが見つかりません'
      });
    }
    
    // 所有者であるか確認
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'このプロジェクトを更新する権限がありません'
      });
    }
    
    // フィールドを更新
    project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    res.status(200).json({
      success: true,
      data: project
    });
    
  } catch (error) {
    logger.error(`プロジェクト更新エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * プロジェクトを削除
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    // プロジェクトが存在するか確認
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'プロジェクトが見つかりません'
      });
    }
    
    // 所有者であるか確認
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'このプロジェクトを削除する権限がありません'
      });
    }
    
    // まず関連するすべてのセッションを削除
    if (project.sessions && project.sessions.length > 0) {
      await Session.deleteMany({ _id: { $in: project.sessions } });
    }
    
    // プロジェクトを削除
    await Project.deleteOne({ _id: project._id });
    
    res.status(200).json({
      success: true,
      data: {}
    });
    
  } catch (error) {
    logger.error(`プロジェクト削除エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * 新しいClaudeCodeセッションを開始
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.startSession = async (req, res) => {
  try {
    const { projectId, anthropicApiKey } = req.body;
    
    // プロジェクトIDが提供されたか確認
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'プロジェクトIDが必要です'
      });
    }
    
    // APIキーが提供されたか確認
    if (!anthropicApiKey) {
      return res.status(400).json({
        success: false,
        message: 'Anthropic APIキーが必要です'
      });
    }
    
    // プロジェクトを検索
    const project = await Project.findById(projectId);
    
    // プロジェクトが存在するか確認
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'プロジェクトが見つかりません'
      });
    }
    
    // アクセス権があるか確認
    if (
      project.owner.toString() !== req.user.id &&
      !project.collaborators.some(collab => collab.toString() === req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'このプロジェクトへのアクセス権限がありません'
      });
    }
    
    // Claude Code APIに接続して初期化
    try {
      // Claude Codeセッションが有効かテスト
      const testResponse = await claudeCode.test({
        apiKey: anthropicApiKey
      });
      
      
      if (!testResponse || !testResponse.success) {
        throw new Error('Claude Code APIからの応答がありません');
      }
      
      // 新しいセッションを作成
      const session = await Session.create({
        project: projectId,
        status: 'idle',
        anthropicApiKey: anthropicApiKey,
        anthropicSessionId: uuidv4(),
        metadata: {
          browserInfo: req.headers['user-agent'],
          deviceType: 'mobile', // スマートフォンからの利用を前提
          ipAddress: req.ip
        },
        createdBy: req.user.id
      });
      
      // プロジェクトのセッション配列に追加
      project.sessions.push(session._id);
      await project.save();
      
      // APIキーを除外してレスポンスを返す
      const sessionResponse = session.toObject();
      delete sessionResponse.anthropicApiKey;
      
      res.status(201).json({
        success: true,
        data: sessionResponse
      });
      
    } catch (claudeCodeError) {
      logger.error(`Claude Code API接続エラー: ${claudeCodeError.message}`);
      return res.status(400).json({
        success: false,
        message: 'Claude Code APIへの接続に失敗しました。APIキーを確認してください。'
      });
    }
    
  } catch (error) {
    logger.error(`セッション開始エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * メッセージをClaudeCodeセッションに送信
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const sessionId = req.params.id;
    
    // メッセージが提供されたか確認
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'メッセージが必要です'
      });
    }
    
    // セッションを検索（APIキーを含む）
    const session = await Session.findById(sessionId).select('+anthropicApiKey');
    
    // セッションが存在するか確認
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'セッションが見つかりません'
      });
    }
    
    // プロジェクトを検索してアクセス権を確認
    const project = await Project.findById(session.project);
    if (
      project.owner.toString() !== req.user.id &&
      !project.collaborators.some(collab => collab.toString() === req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'このセッションへのアクセス権限がありません'
      });
    }
    
    // セッションがアクティブか確認
    if (session.status === 'terminated') {
      return res.status(400).json({
        success: false,
        message: 'このセッションは終了しています'
      });
    }
    
    try {
      // ユーザーのメッセージをセッションに追加
      await session.addMessage('user', message);
      
      // セッションのステータスを更新
      session.status = 'active';
      await session.save();
      
      // Claude Code APIにメッセージを送信
      const response = await claudeCode.sendMessage({
        apiKey: session.anthropicApiKey,
        sessionId: session.anthropicSessionId,
        message: message,
        history: session.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      });
      
      // レスポンスをセッションに追加
      const assistantMessage = response.message;
      await session.addMessage('assistant', assistantMessage);
      
      res.status(200).json({
        success: true,
        data: {
          message: assistantMessage,
          sessionId: session._id
        }
      });
      
    } catch (claudeCodeError) {
      logger.error(`Claude Code API送信エラー: ${claudeCodeError.message}`);
      
      // セッションのステータスを更新
      session.status = 'error';
      await session.save();
      
      return res.status(500).json({
        success: false,
        message: 'Claude Code APIへのメッセージ送信に失敗しました'
      });
    }
    
  } catch (error) {
    logger.error(`メッセージ送信エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * セッションの会話履歴を取得
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.getSessionHistory = async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // セッションを検索
    const session = await Session.findById(sessionId);
    
    // セッションが存在するか確認
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'セッションが見つかりません'
      });
    }
    
    // プロジェクトを検索してアクセス権を確認
    const project = await Project.findById(session.project);
    if (
      project.owner.toString() !== req.user.id &&
      !project.collaborators.some(collab => collab.toString() === req.user.id) &&
      !project.isPublic
    ) {
      return res.status(403).json({
        success: false,
        message: 'このセッションへのアクセス権限がありません'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        messages: session.messages,
        status: session.status,
        lastActive: session.lastActive
      }
    });
    
  } catch (error) {
    logger.error(`セッション履歴取得エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};

/**
 * セッションを終了
 * @param {Object} req - リクエストオブジェクト
 * @param {Object} res - レスポンスオブジェクト
 */
exports.terminateSession = async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // セッションを検索
    const session = await Session.findById(sessionId);
    
    // セッションが存在するか確認
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'セッションが見つかりません'
      });
    }
    
    // プロジェクトを検索してアクセス権を確認
    const project = await Project.findById(session.project);
    if (
      project.owner.toString() !== req.user.id &&
      !project.collaborators.some(collab => collab.toString() === req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'このセッションへのアクセス権限がありません'
      });
    }
    
    // セッションのステータスを更新
    session.status = 'terminated';
    await session.save();
    
    res.status(200).json({
      success: true,
      data: {
        message: 'セッションが正常に終了しました',
        sessionId: session._id
      }
    });
    
  } catch (error) {
    logger.error(`セッション終了エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました'
    });
  }
};