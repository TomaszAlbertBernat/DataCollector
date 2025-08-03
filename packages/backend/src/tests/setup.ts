// Jest setup file for backend tests
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '../../.env' });

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://:redis123@localhost:6379';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Define test utilities interface
interface TestUtils {
  waitFor: (ms: number) => Promise<void>;
  createTestJob: (overrides?: any) => any;
  createTestSearchResult: (overrides?: any) => any;
}

// Global test utilities
(global as any).testUtils = {
  // Helper to wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create test data
  createTestJob: (overrides = {}) => ({
    id: 'test-job-id',
    type: 'collection',
    status: 'pending',
    query: 'test query',
    userId: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),
  
  // Helper to create test search result
  createTestSearchResult: (overrides = {}) => ({
    title: 'Test Paper',
    url: 'https://example.com/paper',
    snippet: 'This is a test paper about machine learning.',
    authors: ['Test Author'],
    publicationDate: '2023',
    journal: 'Test Journal',
    metadata: {
      source: 'test',
      extractedAt: new Date().toISOString()
    },
    ...overrides
  })
} as TestUtils; 