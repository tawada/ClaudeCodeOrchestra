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
    const claudeProcess = spawn('claude', [], {
      cwd: workdir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false, // プロセスをメインプロセスに紐づける
      shell: true
    });
    
    // 標準出力とエラー出力をキャプチャ
    let stdout = '';
    let stderr = '';
    
    claudeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      fs.appendFileSync(outputFilePath, output);
      logger.debug(`[${sessionId}] Claude出力: ${output.trim()}`);
    });
    
    claudeProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      logger.error(`[${sessionId}] Claudeエラー: ${error.trim()}`);
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
      
      // 入力ファイルに書き込む
      fs.writeFileSync(processInfo.inputFile, input + '\n', 'utf8');
      
      // 出力ファイルの現在のサイズを記録（新しい出力の開始位置を知るため）
      const startSize = fs.existsSync(processInfo.outputFile) 
        ? fs.statSync(processInfo.outputFile).size 
        : 0;
      
      // プロセスに入力を送信
      processInfo.process.stdin.write(input + '\n');
      
      // 応答タイムアウト
      const timeout = setTimeout(() => {
        reject(new Error('Claude対話型プロセスからの応答がタイムアウトしました'));
      }, 30000); // 30秒タイムアウト
      
      // 応答を待機（ポーリング方式）
      const checkOutput = () => {
        if (!fs.existsSync(processInfo.outputFile)) {
          setTimeout(checkOutput, 100);
          return;
        }
        
        const currentSize = fs.statSync(processInfo.outputFile).size;
        
        // 出力ファイルに新しいデータがあるか確認
        if (currentSize > startSize) {
          // 新しい出力を読み取る
          const buffer = Buffer.alloc(currentSize - startSize);
          const fileHandle = fs.openSync(processInfo.outputFile, 'r');
          fs.readSync(fileHandle, buffer, 0, currentSize - startSize, startSize);
          fs.closeSync(fileHandle);
          
          const newOutput = buffer.toString('utf8');
          
          // 応答の終了を確認するための条件（例: プロンプト文字や特定のパターン）
          if (newOutput.includes('▌') || newOutput.includes('> ')) {
            clearTimeout(timeout);
            resolve(newOutput);
          } else {
            // まだ応答が終わっていないので、再度確認
            setTimeout(checkOutput, 100);
          }
        } else {
          // まだ新しい出力がないので、再度確認
          setTimeout(checkOutput, 100);
        }
      };
      
      // 出力の確認を開始
      checkOutput();
      
    } catch (error) {
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