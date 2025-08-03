import { BaseScraper, createDefaultScrapingConfig, SearchResult } from '../services/scrapers/BaseScraper';
import winston from 'winston';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn().mockResolvedValue(undefined),
        waitForSelector: jest.fn().mockResolvedValue(undefined),
        $: jest.fn().mockResolvedValue(null),
        $$: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
        textContent: jest.fn().mockResolvedValue(''),
        getAttribute: jest.fn().mockResolvedValue(''),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Create a concrete test implementation of BaseScraper
class TestScraper extends BaseScraper {
  async search(query: string, options?: any): Promise<SearchResult[]> {
    return [];
  }

  async extractDocument(url: string): Promise<any> {
    return { title: 'Test Document', url };
  }

  getScraperInfo() {
    return {
      name: 'Test Scraper',
      supportedDomains: ['test.com'],
      maxResultsPerQuery: 10,
      rateLimit: 5
    };
  }
}

describe('BaseScraper', () => {
  let scraper: TestScraper;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    const config = createDefaultScrapingConfig();
    scraper = new TestScraper(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('configuration', () => {
    it('should create default scraping config', () => {
      const config = createDefaultScrapingConfig();
      
      expect(config).toHaveProperty('userAgent');
      expect(config).toHaveProperty('headless');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('retryAttempts');
      expect(config).toHaveProperty('delayBetweenRequests');
      expect(config).toHaveProperty('maxConcurrentPages');
    });

    it('should initialize with provided config', () => {
      const config = createDefaultScrapingConfig();
      config.userAgent = 'Test User Agent';
      
      const testScraper = new TestScraper(config, mockLogger);
      expect(testScraper).toBeDefined();
    });
  });

  describe('concrete implementation', () => {
    it('should implement search method', async () => {
      const results = await scraper.search('test query');
      expect(results).toEqual([]);
    });

    it('should implement extractDocument method', async () => {
      const result = await scraper.extractDocument('http://test.com');
      expect(result).toEqual({ title: 'Test Document', url: 'http://test.com' });
    });

    it('should implement getScraperInfo method', () => {
      const info = scraper.getScraperInfo();
      expect(info.name).toBe('Test Scraper');
      expect(info.supportedDomains).toContain('test.com');
    });
  });

  describe('error handling', () => {
    it('should handle browser initialization errors', async () => {
      const { chromium } = require('playwright');
      chromium.launch.mockRejectedValue(new Error('Browser launch failed'));

      await expect(scraper.initialize()).rejects.toThrow('Browser launch failed');
    });
  });
}); 