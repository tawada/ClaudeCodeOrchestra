module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.js',
    'public/js/**/*.js'
  ],
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js'
  },
  // テスト実行後に未完了の処理を検出してタイムアウト
  testTimeout: 10000,
  // テスト完了時に残っているタイマーやハンドルを強制クローズ
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};