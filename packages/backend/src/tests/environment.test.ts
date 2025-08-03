import { getEnvironmentInfo } from '../config/environment';

// Mock dotenv to avoid file system dependencies
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Environment Configuration', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.OPENAI_API_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.PORT;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnvironmentInfo', () => {
    it('should return environment information', () => {
      const envInfo = getEnvironmentInfo();
      
      expect(envInfo).toHaveProperty('hasOpenAIKey');
      expect(envInfo).toHaveProperty('envFileFound');
      expect(envInfo).toHaveProperty('nodeEnv');
      expect(envInfo).toHaveProperty('servicesConfigured');
      expect(envInfo.servicesConfigured).toHaveProperty('database');
      expect(envInfo.servicesConfigured).toHaveProperty('redis');
      expect(envInfo.servicesConfigured).toHaveProperty('openSearch');
      expect(envInfo.servicesConfigured).toHaveProperty('chromaDB');
    });

    it('should detect missing OpenAI API key', () => {
      const envInfo = getEnvironmentInfo();
      expect(envInfo.hasOpenAIKey).toBe(false);
    });

    it('should detect present OpenAI API key', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const envInfo = getEnvironmentInfo();
      expect(envInfo.hasOpenAIKey).toBe(true);
    });

    it('should return node environment', () => {
      process.env.NODE_ENV = 'test';
      const envInfo = getEnvironmentInfo();
      expect(envInfo.nodeEnv).toBe('test');
    });

    it('should return default node environment when not specified', () => {
      delete process.env.NODE_ENV;
      const envInfo = getEnvironmentInfo();
      expect(envInfo.nodeEnv).toBe('development');
    });

    it('should indicate environment file status', () => {
      const envInfo = getEnvironmentInfo();
      expect(typeof envInfo.envFileFound).toBe('boolean');
    });

    it('should return services configuration status', () => {
      const envInfo = getEnvironmentInfo();
      expect(typeof envInfo.servicesConfigured.database).toBe('boolean');
      expect(typeof envInfo.servicesConfigured.redis).toBe('boolean');
      expect(typeof envInfo.servicesConfigured.openSearch).toBe('boolean');
      expect(typeof envInfo.servicesConfigured.chromaDB).toBe('boolean');
    });
  });
}); 