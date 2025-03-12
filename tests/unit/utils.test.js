/**
 * ClaudeCodeOrchestra - Utilities Unit Tests
 */
const path = require('path');
const fs = require('fs');
const logger = require('../../src/utils/logger');

// モック
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// ファイル操作のモック
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// テスト用のインポート
const index = require('../../src/index');

// テスト用のデータ
const testData = {
  memoryStore: {
    projects: [
      { id: '1', name: 'テストプロジェクト', description: 'テスト用' }
    ],
    sessions: [
      { id: '1', projectId: '1', status: 'active' }
    ],
    messages: {
      '1': [
        { role: 'user', content: 'こんにちは' },
        { role: 'assistant', content: 'こんにちは、どうぞ！' }
      ]
    }
  },
  claudeCodeSessions: {
    '1': {
      workdir: '/test/path',
      projectName: 'テストプロジェクト',
      startTime: new Date().toISOString()
    }
  }
};

describe('セッションデータの永続化と復元', () => {
  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
  });

  test('saveSessionsToFile - セッションデータを正常に保存できること', () => {
    // モックの設定
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockImplementation(() => {});

    // セッションの永続化関数をエクスポートしてテスト対象とする
    const saveSessionsToFile = index.__get__('saveSessionsToFile');
    
    // テスト
    const result = saveSessionsToFile();
    
    // 検証
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('loadSessionsFromFile - セッションデータを正常に読み込めること', () => {
    // モックの設定
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(testData));

    // セッションの読み込み関数をエクスポートしてテスト対象とする
    const loadSessionsFromFile = index.__get__('loadSessionsFromFile');
    
    // テスト
    const result = loadSessionsFromFile();
    
    // 検証
    expect(fs.readFileSync).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('loadSessionsFromFile - ファイルが存在しない場合は復元しないこと', () => {
    // モックの設定
    fs.existsSync.mockReturnValue(false);

    // セッションの読み込み関数をエクスポートしてテスト対象とする
    const loadSessionsFromFile = index.__get__('loadSessionsFromFile');
    
    // テスト
    const result = loadSessionsFromFile();
    
    // 検証
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  test('loadSessionsFromFile - ファイル読み込み中にエラーが発生した場合は処理すること', () => {
    // モックの設定
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(() => {
      throw new Error('テストエラー');
    });

    // セッションの読み込み関数をエクスポートしてテスト対象とする
    const loadSessionsFromFile = index.__get__('loadSessionsFromFile');
    
    // テスト
    const result = loadSessionsFromFile();
    
    // 検証
    expect(logger.error).toHaveBeenCalled();
    expect(result).toBe(false);
  });
});