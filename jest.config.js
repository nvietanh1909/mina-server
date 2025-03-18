module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 60000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1,
  maxConcurrency: 1,
  bail: true
}; 