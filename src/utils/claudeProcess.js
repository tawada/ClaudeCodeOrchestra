/**
 * ClaudeCodeOrchestra - Claude対話型プロセス管理ユーティリティ
 * 
 * このモジュールは、Claudeコマンドの対話型プロセスを管理するためのユーティリティ関数を提供します。
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// アクティブなClaude対話型プロセスを保存するオブジェクト
const activeProcesses = {};

/**
 * Claude対話型プロセスを開始する
 * @param {string} sessionId セッションID
 * @param {string} workdir 作業ディレクトリ
 * @returns {Object} プロセス情報
 */
function startClaudeProcess(sessionId, workdir) {
  // 実行時のコマンドとプロセス情報をログファイルに記録
  const logDir = path.join(process.cwd(), 'data', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, `claude_process_${Date.now()}.log`);
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] プロセス起動情報:\n`);
  fs.appendFileSync(logFile, `セッションID: ${sessionId}\n`);
  fs.appendFileSync(logFile, `作業ディレクトリ: ${workdir}\n`);
  fs.appendFileSync(logFile, `環境変数 CLAUDE_COMMAND: ${process.env.CLAUDE_COMMAND || 'undefined'}\n`);
  fs.appendFileSync(logFile, `環境変数 CLAUDE_ARGS: ${process.env.CLAUDE_ARGS || 'undefined'}\n`);
  fs.appendFileSync(logFile, `プロセス実行環境: ${JSON.stringify(process.env.PATH)}\n\n`);
  try {
    logger.info(`Claude対話型プロセスを開始します: ${sessionId}`);

    // すでに実行中のプロセスがあればそれを返す
    if (activeProcesses[sessionId] && activeProcesses[sessionId].process) {
      if (!activeProcesses[sessionId].process.killed) {
        logger.info(`既存のプロセスが見つかりました: ${sessionId}`);
        return activeProcesses[sessionId];
      }
    }
    
    // 作業ディレクトリ用のパスを確認
    if (!fs.existsSync(workdir)) {
      fs.mkdirSync(workdir, { recursive: true });
    }
    
    // input.txt, output.txtの初期化
    const inputFilePath = path.join(workdir, 'input.txt');
    const outputFilePath = path.join(workdir, 'output.txt');
    fs.writeFileSync(inputFilePath, '', 'utf8');
    fs.writeFileSync(outputFilePath, '', 'utf8');
    
    // 実際のClaude対話型プロセスを起動
    // コマンドは環境によって異なる可能性があるため、設定または環境変数から取得
    const claudeCommand = process.env.CLAUDE_COMMAND || 'claude';
    const claudeArgs = (process.env.CLAUDE_ARGS || '').split(' ').filter(arg => arg.trim());
    
    // 起動コマンドをログに記録
    logger.info(`Claude対話型プロセスを起動: コマンド=${claudeCommand}, 引数=${claudeArgs.join(' ')}`);
    fs.appendFileSync(logFile, `実行コマンド: ${claudeCommand} ${claudeArgs.join(' ')}\n\n`);
    
    // デバッグのためにwhichコマンドの結果をログに記録
    try {
      const whichOutput = require('child_process').execSync(`which ${claudeCommand}`, { encoding: 'utf8' });
      fs.appendFileSync(logFile, `コマンドパス: ${whichOutput}\n`);
    } catch (e) {
      fs.appendFileSync(logFile, `コマンドパス検索エラー: ${e.message}\n`);
    }
    
    // プロセス起動
    const claudeProcess = spawn(claudeCommand, claudeArgs, {
      cwd: workdir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false, // プロセスをメインプロセスに紐づける
      shell: true,
      env: { ...process.env, TERM: 'xterm-color' } // ターミナル設定を追加
    });
    
    // プロセス情報をログに記録
    fs.appendFileSync(logFile, `プロセスPID: ${claudeProcess.pid || '不明'}\n`);
    fs.appendFileSync(logFile, `起動時刻: ${new Date().toISOString()}\n\n`);
    
    // 標準出力とエラー出力をキャプチャ
    let stdout = '';
    let stderr = '';
    
    claudeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      fs.appendFileSync(outputFilePath, output);
      // より詳細なログ出力（トリミングなし）
      logger.info(`[${sessionId}] Claude出力: ${output}`);
      // 常にログファイルにも出力する
      const logDir = path.join(process.cwd(), 'data', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, `claude_${sessionId}.log`);
      fs.appendFileSync(logFile, `[STDOUT ${new Date().toISOString()}] ${output}`);
    });
    
    claudeProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logger.error(`[${sessionId}] Claudeエラー: ${error}`);
      // 標準エラー出力もログファイルに記録
      const logDir = path.join(process.cwd(), 'data', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, `claude_${sessionId}.log`);
      fs.appendFileSync(logFile, `[STDERR ${new Date().toISOString()}] ${error}`);
    });
    
    // プロセス終了時の処理
    claudeProcess.on('close', (code) => {
      logger.info(`[${sessionId}] Claudeプロセスが終了しました。コード: ${code}`);
      
      if (activeProcesses[sessionId]) {
        activeProcesses[sessionId].running = false;
        activeProcesses[sessionId].exitCode = code;
        activeProcesses[sessionId].exitTime = new Date().toISOString();
      }
    });
    
    // プロセス情報を保存
    activeProcesses[sessionId] = {
      process: claudeProcess,
      pid: claudeProcess.pid,
      workdir: workdir,
      startTime: new Date().toISOString(),
      running: true,
      stdout: stdout,
      stderr: stderr,
      inputFile: inputFilePath,
      outputFile: outputFilePath
    };
    
    logger.info(`Claudeプロセスが起動しました。PID: ${claudeProcess.pid}, セッション: ${sessionId}`);
    return activeProcesses[sessionId];
    
  } catch (error) {
    logger.error(`Claude対話型プロセス起動エラー: ${error.message}`);
    return null;
  }
}

/**
 * 実行中のClaude対話型プロセスにコマンドを送信する
 * @param {string} sessionId セッションID
 * @param {string} input 入力テキスト
 * @returns {Promise<string>} Claudeからの応答
 */
async function sendCommandToProcess(sessionId, input) {
  return new Promise((resolve, reject) => {
    try {
      // セッションプロセスが存在するか確認
      if (!activeProcesses[sessionId] || !activeProcesses[sessionId].process) {
        throw new Error(`セッション ${sessionId} のClaude対話型プロセスが見つかりません`);
      }
      
      const processInfo = activeProcesses[sessionId];
      
      if (!processInfo.running) {
        throw new Error(`セッション ${sessionId} のClaude対話型プロセスはすでに終了しています`);
      }
      
      logger.info(`コマンド送信 (${sessionId}): ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`);
      
      // 入力ファイルに書き込む
      fs.writeFileSync(processInfo.inputFile, input + '\n', 'utf8');
      
      // 出力キャプチャのための変数
      let responseOutput = '';
      let outputComplete = false;
      let lastActivityTime = Date.now();
      
      // 標準出力からの新しいデータをリスニング
      const originalStdoutListener = processInfo.process.stdout.listeners('data')[0];
      const newStdoutListener = (data) => {
        const chunk = data.toString();
        responseOutput += chunk;
        lastActivityTime = Date.now(); // データを受信するたびに最終アクティビティ時間を更新
        
        // 元のリスナーも呼び出し
        if (originalStdoutListener) {
          originalStdoutListener(data);
        }
        
        // プロンプトが含まれているかチェック（応答の終了を示す）
        if (chunk.includes('▌') || chunk.includes('> ') || chunk.includes('$') || 
            chunk.includes('claude>') || chunk.includes('user>') || 
            /\d+:\d+:\d+\s*$/.test(chunk.trim())) {
          outputComplete = true;
          logger.debug(`応答完了マーカーを検出: "${chunk.slice(-20).trim()}"`);
        }
        
        // データ量が十分に多く、一定期間新しいデータが来ていない場合も完了と判断
        if (responseOutput.length > 500 && chunk.trim().endsWith('.') && 
            !chunk.trim().endsWith('...')) {
          const timeWithoutNewData = Date.now() - lastActivityTime;
          if (timeWithoutNewData > 3000) { // 3秒間新しいデータがなければ完了と見なす
            logger.debug(`応答が3秒間停止、完了と判断: ${responseOutput.length}文字`);
            outputComplete = true;
          }
        }
      };
      
      // 既存のリスナーを一時的に削除
      processInfo.process.stdout.removeAllListeners('data');
      // 新しいリスナーを追加
      processInfo.process.stdout.on('data', newStdoutListener);
      
      // 出力ファイルの現在のサイズを記録（新しい出力の開始位置を知るため）
      const startSize = fs.existsSync(processInfo.outputFile) 
        ? fs.statSync(processInfo.outputFile).size 
        : 0;
      
      // コマンド送信をログに記録
      const commandLogFile = path.join(process.cwd(), 'data', 'logs', `command_${sessionId}.log`);
      fs.appendFileSync(commandLogFile, `\n\n[COMMAND ${new Date().toISOString()}] ${input}\n`);
      
      // プロセスに入力を送信
      processInfo.process.stdin.write(input + '\n');
      logger.info(`コマンドを送信しました: ${input.substring(0, 30)}...`);
      
      // 応答タイムアウト（120秒に延長）
      const timeout = setTimeout(() => {
        // リスナーをクリーンアップ
        processInfo.process.stdout.removeListener('data', newStdoutListener);
        if (originalStdoutListener) {
          processInfo.process.stdout.on('data', originalStdoutListener);
        }
        
        // タイムアウト時点で収集した出力があれば返す
        if (responseOutput) {
          logger.warn(`応答が部分的: ${responseOutput.substring(0, 100)}...`);
          resolve(responseOutput + '\n[応答タイムアウト - 部分的な応答を表示]');
        } else {
          // ファイルから直接読む最後の試み
          try {
            if (fs.existsSync(processInfo.outputFile)) {
              const currentSize = fs.statSync(processInfo.outputFile).size;
              if (currentSize > startSize) {
                const buffer = Buffer.alloc(currentSize - startSize);
                const fileHandle = fs.openSync(processInfo.outputFile, 'r');
                fs.readSync(fileHandle, buffer, 0, currentSize - startSize, startSize);
                fs.closeSync(fileHandle);
                
                const fileOutput = buffer.toString('utf8');
                if (fileOutput.trim()) {
                  resolve(fileOutput + '\n[応答タイムアウト - ファイルから読み取った応答]');
                  return;
                }
              }
            }
          } catch (e) {
            logger.error(`出力ファイル読み取りエラー: ${e.message}`);
          }
          
          // プロセスの状態をチェックして再起動が必要か判断
          try {
            if (processInfo.process && !processInfo.process.killed) {
              logger.warn(`タイムアウトだがプロセスは生きています。応答: "${responseOutput}"`);
              resolve(`[Claude応答タイムアウト - プロセスは実行中です。もう一度試してください]`);
            } else {
              logger.error(`プロセスが終了しています。再起動が必要です。`);
              reject(new Error('Claude対話型プロセスが応答しません。プロセスが終了した可能性があります。'));
            }
          } catch (e) {
            logger.error(`プロセス状態チェックエラー: ${e.message}`);
            reject(new Error('Claude対話型プロセスからの応答がタイムアウトしました'));
          }
        }
      }, 120000); // 120秒タイムアウト
      
      // 定期的に応答完了をチェック
      const checkCompletion = () => {
        if (outputComplete) {
          // 応答が完了した
          clearTimeout(timeout);
          
          // リスナーをクリーンアップ
          processInfo.process.stdout.removeListener('data', newStdoutListener);
          if (originalStdoutListener) {
            processInfo.process.stdout.on('data', originalStdoutListener);
          }
          
          logger.info(`応答受信完了 (${sessionId}): ${responseOutput.length} 文字`);
          resolve(responseOutput);
        } else {
          // まだ応答が完了していない
          setTimeout(checkCompletion, 100);
        }
      };
      
      // 応答完了チェックを開始
      checkCompletion();
      
    } catch (error) {
      logger.error(`コマンド送信エラー: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Claude対話型プロセスを停止する
 * @param {string} sessionId セッションID
 * @returns {boolean} 成功したかどうか
 */
function stopClaudeProcess(sessionId) {
  try {
    if (!activeProcesses[sessionId] || !activeProcesses[sessionId].process) {
      logger.warn(`セッション ${sessionId} のClaude対話型プロセスが見つかりません`);
      return false;
    }
    
    const processInfo = activeProcesses[sessionId];
    
    // すでに終了している場合
    if (!processInfo.running) {
      logger.info(`セッション ${sessionId} のClaude対話型プロセスはすでに終了しています`);
      return true;
    }
    
    // 終了コマンドを送信（正常な終了を試みる）
    try {
      processInfo.process.stdin.write('exit\n');
      
      // 猶予を与える
      setTimeout(() => {
        if (processInfo.process && !processInfo.process.killed) {
          // 正常終了しなかった場合、強制終了
          processInfo.process.kill('SIGTERM');
        }
      }, 1000);
    } catch (e) {
      // 入力パイプが閉じられている場合など
      if (processInfo.process && !processInfo.process.killed) {
        processInfo.process.kill('SIGTERM');
      }
    }
    
    logger.info(`セッション ${sessionId} のClaude対話型プロセスを停止しました`);
    
    // ステータスを更新
    processInfo.running = false;
    processInfo.exitTime = new Date().toISOString();
    
    return true;
  } catch (error) {
    logger.error(`Claude対話型プロセス停止エラー: ${error.message}`);
    return false;
  }
}

/**
 * アクティブなプロセスの状態を取得する
 * @param {string} sessionId セッションID
 * @returns {Object|null} プロセス情報またはnull
 */
function getProcessStatus(sessionId) {
  if (!activeProcesses[sessionId]) {
    return null;
  }
  
  const processInfo = activeProcesses[sessionId];
  
  // プロセスが実際に動いているかチェック（PIDのチェックなど）
  const isRunning = processInfo.process && !processInfo.process.killed;
  
  if (processInfo.running !== isRunning) {
    processInfo.running = isRunning;
  }
  
  return {
    sessionId,
    running: processInfo.running,
    pid: processInfo.pid,
    startTime: processInfo.startTime,
    exitTime: processInfo.exitTime || null,
    exitCode: processInfo.exitCode || null,
    workdir: processInfo.workdir
  };
}

/**
 * すべてのプロセスの状態を取得する
 * @returns {Object} セッションIDごとのプロセス情報
 */
function getAllProcessesStatus() {
  const result = {};
  
  Object.keys(activeProcesses).forEach(sessionId => {
    result[sessionId] = getProcessStatus(sessionId);
  });
  
  return result;
}

/**
 * すべてのプロセスをクリーンアップする（アプリケーション終了時など）
 */
function cleanupAllProcesses() {
  logger.info('すべてのClaude対話型プロセスをクリーンアップします');
  
  Object.keys(activeProcesses).forEach(sessionId => {
    try {
      stopClaudeProcess(sessionId);
    } catch (error) {
      logger.error(`プロセスクリーンアップエラー (${sessionId}): ${error.message}`);
    }
  });
}

// プロセス終了時のクリーンアップハンドラを登録
process.on('exit', cleanupAllProcesses);
process.on('SIGINT', () => {
  cleanupAllProcesses();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupAllProcesses();
  process.exit(0);
});

module.exports = {
  startClaudeProcess,
  sendCommandToProcess,
  stopClaudeProcess,
  getProcessStatus,
  getAllProcessesStatus,
  cleanupAllProcesses
};