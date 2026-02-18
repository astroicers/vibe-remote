// Test setup file
// Set environment variables BEFORE any imports
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-long';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_PATH = ':memory:';
