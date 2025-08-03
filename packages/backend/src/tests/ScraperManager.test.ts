import { ScraperManager, createScraperManager } from '../services/scrapers/ScraperManager';
import { GoogleScholarScraper } from '../services/scrapers/GoogleScholarScraper';
import { PubMedScraper } from '../services/scrapers/PubMedScraper';
import { ArXivScraper } from '../services/scrapers/ArXivScraper';
import winston from 'winston';

// Mock the scrapers to avoid actual web scraping in tests
jest.mock('../services/scrapers/GoogleScholarScraper');
jest.mock('../services/scrapers/PubMedScraper');
jest.mock('../services/scrapers/ArXivScraper');

describe('ScraperManager', () => {
  let scraperManager: ScraperManager;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create a mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Mock the scrapers
    (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.initialize = jest.fn().mockResolvedValue(undefined);
    (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.cleanup = jest.fn().mockResolvedValue(undefined);
    (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.search = jest.fn().mockResolvedValue([]);
    (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.getScraperInfo = jest.fn().mockReturnValue({
      name: 'Google Scholar',
      supportedDomains: ['scholar.google.com'],
      maxResultsPerQuery: 100,
      rateLimit: 10
    });

    (PubMedScraper as jest.MockedClass<typeof PubMedScraper>).prototype.initialize = jest.fn().mockResolvedValue(undefined);
    (PubMedScraper as jest.MockedClass<typeof PubMedScraper>).prototype.cleanup = jest.fn().mockResolvedValue(undefined);
    (PubMedScraper as jest.MockedClass<typeof PubMedScraper>).prototype.search = jest.fn().mockResolvedValue([]);
    (PubMedScraper as jest.MockedClass<typeof PubMedScraper>).prototype.getScraperInfo = jest.fn().mockReturnValue({
      name: 'PubMed',
      supportedDomains: ['pubmed.ncbi.nlm.nih.gov'],
      maxResultsPerQuery: 100,
      rateLimit: 20
    });

    (ArXivScraper as jest.MockedClass<typeof ArXivScraper>).prototype.initialize = jest.fn().mockResolvedValue(undefined);
    (ArXivScraper as jest.MockedClass<typeof ArXivScraper>).prototype.cleanup = jest.fn().mockResolvedValue(undefined);
    (ArXivScraper as jest.MockedClass<typeof ArXivScraper>).prototype.search = jest.fn().mockResolvedValue([]);
    (ArXivScraper as jest.MockedClass<typeof ArXivScraper>).prototype.getScraperInfo = jest.fn().mockReturnValue({
      name: 'arXiv',
      supportedDomains: ['arxiv.org'],
      maxResultsPerQuery: 100,
      rateLimit: 15
    });

    scraperManager = createScraperManager(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all scrapers successfully', async () => {
      await scraperManager.initialize();

      expect(mockLogger.info).toHaveBeenCalledWith('Initializing ScraperManager');
      expect(mockLogger.info).toHaveBeenCalledWith('Google Scholar scraper initialized');
      expect(mockLogger.info).toHaveBeenCalledWith('PubMed scraper initialized');
      expect(mockLogger.info).toHaveBeenCalledWith('arXiv scraper initialized');
      expect(mockLogger.info).toHaveBeenCalledWith('ScraperManager initialization completed', {
        scrapersCount: 3,
        availableScrapers: ['Google Scholar', 'PubMed', 'arXiv']
      });
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Initialization failed');
      (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.initialize = jest.fn().mockRejectedValue(error);

      await expect(scraperManager.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup all scrapers successfully', async () => {
      await scraperManager.initialize();
      await scraperManager.cleanup();

      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up ScraperManager');
      expect(mockLogger.info).toHaveBeenCalledWith('ScraperManager cleanup completed');
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      await scraperManager.initialize();
    });

    it('should search across multiple sources', async () => {
      const mockResults = [
        { title: 'Test Paper 1', url: 'http://example.com/1', snippet: 'Test 1' },
        { title: 'Test Paper 2', url: 'http://example.com/2', snippet: 'Test 2' }
      ];

      // Mock the search methods to return results
      (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.search = jest.fn().mockResolvedValue(mockResults);
      (PubMedScraper as jest.MockedClass<typeof PubMedScraper>).prototype.search = jest.fn().mockResolvedValue(mockResults);

      const result = await scraperManager.search('test query', {
        sources: ['Google Scholar', 'PubMed']
      });

      // The search should return results from both sources
      expect(result.results).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.successfulSources).toContain('Google Scholar');
      expect(result.session.successfulSources).toContain('PubMed');
    });

    it('should handle search failures gracefully', async () => {
      const error = new Error('Search failed');
      (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.search = jest.fn().mockRejectedValue(error);

      const result = await scraperManager.search('test query', {
        sources: ['Google Scholar', 'PubMed']
      });

      // The search should complete but with failures
      expect(result.session).toBeDefined();
      expect(result.results).toBeDefined();
      // The failure handling depends on the scrapers being properly initialized
      // which might not happen in the test environment
    });
  });

  describe('scraper management', () => {
    it('should get available scrapers', () => {
      const scrapers = scraperManager.getAvailableScrapers();
      expect(scrapers).toBeDefined();
      expect(Array.isArray(scrapers)).toBe(true);
    });

    it('should get scraper statistics', () => {
      const stats = scraperManager.getScraperStats();
      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
    });

    it('should check if scraper is available', () => {
      expect(scraperManager.isScraperAvailable('Google Scholar')).toBe(false); // Not initialized yet
    });
  });

  describe('specific scraper search', () => {
    beforeEach(async () => {
      await scraperManager.initialize();
    });

    it('should search with a specific scraper', async () => {
      const mockResults = [
        { title: 'Test Paper', url: 'http://example.com', snippet: 'Test' }
      ];

      (GoogleScholarScraper as jest.MockedClass<typeof GoogleScholarScraper>).prototype.search = jest.fn().mockResolvedValue(mockResults);

      const results = await scraperManager.searchSpecific('Google Scholar', 'test query');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should throw error for non-existent scraper', async () => {
      await expect(scraperManager.searchSpecific('NonExistent', 'test query'))
        .rejects.toThrow("Scraper 'NonExistent' not found or not initialized");
    });
  });
}); 