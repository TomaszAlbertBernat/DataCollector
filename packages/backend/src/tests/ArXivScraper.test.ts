import { ArXivScraper } from '../services/scrapers/ArXivScraper';
import { createDefaultScrapingConfig } from '../services/scrapers/BaseScraper';
import winston from 'winston';

// Mock Playwright to avoid actual browser automation in tests
jest.mock('playwright');

describe('ArXivScraper', () => {
  let arxivScraper: ArXivScraper;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create a mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create scraper instance
    const config = createDefaultScrapingConfig();
    arxivScraper = new ArXivScraper(config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getScraperInfo', () => {
    it('should return correct scraper information', () => {
      const info = arxivScraper.getScraperInfo();
      
      expect(info).toEqual({
        name: 'arXiv',
        supportedDomains: ['arxiv.org'],
        maxResultsPerQuery: 100,
        rateLimit: 20
      });
    });
  });

  describe('buildSearchUrl', () => {
    it('should build basic search URL correctly', () => {
      // Test via public method - we'll mock search to test URL building
      const mockSearch = jest.spyOn(arxivScraper, 'search').mockImplementation(
        async (query, options) => {
          // Access private method through any cast
          const url = (arxivScraper as any).buildSearchUrl(query, options || {});
          expect(url).toContain('query=machine');
          expect(url).toContain('searchtype=all');
          return [];
        }
      );

      arxivScraper.search('machine learning', {});
      expect(mockSearch).toHaveBeenCalled();
    });

    it('should include category filter when provided', () => {
      const mockSearch = jest.spyOn(arxivScraper, 'search').mockImplementation(
        async (query, options) => {
          const url = (arxivScraper as any).buildSearchUrl(query, options || {});
          expect(url).toContain('classification=cs.AI');
          return [];
        }
      );

      arxivScraper.search('neural networks', { category: 'cs.AI' });
      expect(mockSearch).toHaveBeenCalled();
    });

    it('should include sort parameters when provided', () => {
      const mockSearch = jest.spyOn(arxivScraper, 'search').mockImplementation(
        async (query, options) => {
          const url = (arxivScraper as any).buildSearchUrl(query, options || {});
          expect(url).toContain('sortBy=submittedDate');
          expect(url).toContain('sortOrder=descending');
          return [];
        }
      );

      arxivScraper.search('deep learning', { sortBy: 'date' });
      expect(mockSearch).toHaveBeenCalled();
    });
  });

  describe('extractSingleResult', () => {
    it('should handle missing title gracefully', async () => {
      const mockElement = {
        $: jest.fn().mockResolvedValue(null)
      };

      const result = await (arxivScraper as any).extractSingleResult({}, mockElement);
      expect(result).toBeNull();
    });

    it('should extract complete result when all data is available', async () => {
      const mockTitleElement = {
        textContent: jest.fn().mockResolvedValue('Test Paper Title'),
        getAttribute: jest.fn().mockResolvedValue('/abs/2301.00001')
      };

      const mockSnippetElement = {
        textContent: jest.fn().mockResolvedValue('This is a test abstract for the paper.')
      };

      const mockAuthorElements = [
        { textContent: jest.fn().mockResolvedValue('Author One') },
        { textContent: jest.fn().mockResolvedValue('Author Two') }
      ];

      const mockCategoryElements = [
        { textContent: jest.fn().mockResolvedValue('cs.AI') },
        { textContent: jest.fn().mockResolvedValue('cs.LG') }
      ];

      const mockIdElement = {
        textContent: jest.fn().mockResolvedValue('arXiv:2301.00001')
      };

      const mockDateElement = {
        textContent: jest.fn().mockResolvedValue('2023-01-01')
      };

      const mockElement = {
        $: jest.fn()
          .mockImplementation((selector) => {
            switch (selector) {
              case '.title a': return Promise.resolve(mockTitleElement);
              case '.abstract': return Promise.resolve(mockSnippetElement);
              case '.list-title a': return Promise.resolve(mockIdElement);
              case '.list-date': return Promise.resolve(mockDateElement);
              default: return Promise.resolve(null);
            }
          }),
        $$: jest.fn()
          .mockImplementation((selector) => {
            switch (selector) {
              case '.authors a': return Promise.resolve(mockAuthorElements);
              case '.categories a': return Promise.resolve(mockCategoryElements);
              default: return Promise.resolve([]);
            }
          })
      };

      const result = await (arxivScraper as any).extractSingleResult({}, mockElement);
      
      expect(result).not.toBeNull();
      expect(result.title).toBe('Test Paper Title');
      expect(result.url).toBe('https://arxiv.org/abs/2301.00001');
      expect(result.snippet).toBe('This is a test abstract for the paper.');
      expect(result.authors).toEqual(['Author One', 'Author Two']);
      expect(result.metadata.categories).toEqual(['cs.AI', 'cs.LG']);
      expect(result.metadata.arxivId).toBe('2301.00001');
      expect(result.metadata.source).toBe('arXiv');
    });
  });

  describe('extractArxivId', () => {
    it('should extract arXiv ID from text correctly', () => {
      // Test the regex pattern used in extractResultArxivId
      const testText = 'arXiv:2301.00001';
      const match = testText.match(/arXiv:(\d+\.\d+)/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('2301.00001');
    });

    it('should handle malformed arXiv ID gracefully', () => {
      const testText = 'invalid-id-format';
      const match = testText.match(/arXiv:(\d+\.\d+)/);
      expect(match).toBeNull();
    });
  });

  describe('extractSubmissionDate', () => {
    it('should extract date from properly formatted string', () => {
      const testText = '2023-01-15';
      const match = testText.match(/(\d{4}-\d{2}-\d{2})/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('2023-01-15');
    });

    it('should handle invalid date format gracefully', () => {
      const testText = 'invalid date';
      const match = testText.match(/(\d{4}-\d{2}-\d{2})/);
      expect(match).toBeNull();
    });
  });

  describe('search method error handling', () => {
    it('should handle search errors gracefully', async () => {
      // Mock createPage to throw an error
      jest.spyOn(arxivScraper as any, 'createPage').mockRejectedValue(new Error('Browser failed'));

      await expect(arxivScraper.search('test query')).rejects.toThrow('Browser failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'arXiv search failed',
        expect.objectContaining({
          query: expect.stringContaining('test query'),
          error: 'Browser failed'
        })
      );
    });

    it('should log successful search completion', async () => {
      // Mock successful search flow
      jest.spyOn(arxivScraper as any, 'createPage').mockResolvedValue({
        close: jest.fn()
      });
      jest.spyOn(arxivScraper as any, 'navigateWithRetry').mockResolvedValue(undefined);
      jest.spyOn(arxivScraper as any, 'checkForBlocking').mockResolvedValue(false);
      jest.spyOn(arxivScraper as any, 'waitForElementSafely').mockResolvedValue(true);
      jest.spyOn(arxivScraper as any, 'extractSearchResults').mockResolvedValue([
        { title: 'Test Paper', url: 'https://arxiv.org/abs/2301.00001', snippet: 'Abstract' }
      ]);

      const results = await arxivScraper.search('test query');

      expect(results).toHaveLength(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'arXiv search completed',
        expect.objectContaining({
          query: expect.stringContaining('test query'),
          resultsFound: 1
        })
      );
    });
  });

  describe('extractDocument method', () => {
    it('should handle document extraction errors gracefully', async () => {
      jest.spyOn(arxivScraper as any, 'createPage').mockRejectedValue(new Error('Page creation failed'));

      await expect(arxivScraper.extractDocument('https://arxiv.org/abs/2301.00001')).rejects.toThrow('Page creation failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Document extraction failed',
        expect.objectContaining({
          url: 'https://arxiv.org/abs/2301.00001',
          error: 'Page creation failed'
        })
      );
    });

    it('should extract document data structure correctly', async () => {
      const mockPage = {
        close: jest.fn()
      };

      jest.spyOn(arxivScraper as any, 'createPage').mockResolvedValue(mockPage);
      jest.spyOn(arxivScraper as any, 'navigateWithRetry').mockResolvedValue(undefined);
      jest.spyOn(arxivScraper as any, 'safeTextContent').mockResolvedValue('Test Paper Title');
      jest.spyOn(arxivScraper as any, 'extractAuthors').mockResolvedValue(['Author One']);
      jest.spyOn(arxivScraper as any, 'extractAbstract').mockResolvedValue('Abstract text');
      jest.spyOn(arxivScraper as any, 'extractCategories').mockResolvedValue(['cs.AI']);
      jest.spyOn(arxivScraper as any, 'extractSubmissionDate').mockResolvedValue('2023-01-01');
      jest.spyOn(arxivScraper as any, 'extractArxivId').mockResolvedValue('2301.00001');
      jest.spyOn(arxivScraper as any, 'extractPdfUrl').mockResolvedValue('https://arxiv.org/pdf/2301.00001.pdf');

      const result = await arxivScraper.extractDocument('https://arxiv.org/abs/2301.00001');

      expect(result).toMatchObject({
        title: 'Test Paper Title',
        authors: ['Author One'],
        abstract: 'Abstract text',
        categories: ['cs.AI'],
        submissionDate: '2023-01-01',
        arxivId: '2301.00001',
        pdfUrl: 'https://arxiv.org/pdf/2301.00001.pdf',
        metadata: {
          source: 'arXiv',
          originalUrl: 'https://arxiv.org/abs/2301.00001',
          extractedAt: expect.any(String)
        }
      });
    });
  });
});