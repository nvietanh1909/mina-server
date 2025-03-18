// Set environment variables for testing
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 