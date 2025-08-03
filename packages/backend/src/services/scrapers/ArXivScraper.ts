import { Page } from 'playwright';
import winston from 'winston';

import { BaseScraper, ScrapingConfig, SearchResult, randomDelay } from './BaseScraper';

export interface ArXivOptions {
  yearFrom?: number;
  yearTo?: number;
  category?: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'date' | 'title';
}

export class ArXivScraper extends BaseScraper {
  private baseUrl = 'https://arxiv.org';

  constructor(config: ScrapingConfig, logger: winston.Logger) {
    super(config, logger);
  }

  /**
   * Search arXiv for academic papers
   */
  async search(query: string, options: ArXivOptions = {}): Promise<SearchResult[]> {
    let page: Page | null = null;
    
    try {
      page = await this.createPage();
      
      this.logger.info('Starting arXiv search', {
        query: query.substring(0, 100),
        options
      });

      // Build search URL
      const searchUrl = this.buildSearchUrl(query, options);
      
      // Navigate to search page
      await this.navigateWithRetry(page, searchUrl);

      // Check for blocking/CAPTCHA
      if (await this.checkForBlocking(page)) {
        await this.handleBlocking(page);
        
        // Try again after handling blocking
        if (await this.checkForBlocking(page)) {
          throw new Error('arXiv access blocked - possible CAPTCHA or rate limiting');
        }
      }

      // Wait for search results to load
      const resultsLoaded = await this.waitForElementSafely(page, '.arxiv-result', 10000);
      if (!resultsLoaded) {
        this.logger.warn('No search results found or page did not load properly');
        return [];
      }

      // Extract search results
      const results = await this.extractSearchResults(page, options.maxResults || 20);

      this.logger.info('arXiv search completed', {
        query: query.substring(0, 50),
        resultsFound: results.length
      });

      return results;

    } catch (error) {
      this.logger.error('arXiv search failed', {
        query: query.substring(0, 100),
        error: (error as Error).message
      });
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Extract document details from arXiv page
   */
  async extractDocument(url: string): Promise<any> {
    let page: Page | null = null;

    try {
      page = await this.createPage();
      
      this.logger.debug('Extracting document details', { url });

      await this.navigateWithRetry(page, url);

      // Wait for content to load
      await randomDelay(1000, 3000);

      const documentData = {
        title: await this.safeTextContent(page, 'h1.title'),
        authors: await this.extractAuthors(page),
        abstract: await this.extractAbstract(page),
        categories: await this.extractCategories(page),
        submissionDate: await this.extractSubmissionDate(page),
        arxivId: await this.extractArxivId(page),
        pdfUrl: await this.extractPdfUrl(page),
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'arXiv',
          originalUrl: url
        }
      };

      return documentData;

    } catch (error) {
      this.logger.error('Document extraction failed', {
        url,
        error: (error as Error).message
      });
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Get scraper information
   */
  getScraperInfo() {
    return {
      name: 'arXiv',
      supportedDomains: ['arxiv.org'],
      maxResultsPerQuery: 100,
      rateLimit: 20 // 20 requests per minute
    };
  }

  /**
   * Build search URL with parameters
   */
  private buildSearchUrl(query: string, options: ArXivOptions): string {
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('searchtype', 'all');
    
    if (options.category) {
      params.set('classification', options.category);
    }

    if (options.sortBy) {
      const sortMap = {
        'relevance': 'relevance',
        'date': 'submittedDate',
        'title': 'title'
      };
      params.set('sortBy', sortMap[options.sortBy] || 'relevance');
      params.set('sortOrder', 'descending');
    }

    return `${this.baseUrl}/search/?${params.toString()}`;
  }

  /**
   * Extract search results from the page
   */
  private async extractSearchResults(page: Page, maxResults: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Get all result containers
      const resultElements = await page.$$('.arxiv-result');
      const resultsToProcess = Math.min(resultElements.length, maxResults);

      for (let i = 0; i < resultsToProcess; i++) {
        const element = resultElements[i];
        
        try {
          const result = await this.extractSingleResult(page, element);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          this.logger.warn('Failed to extract individual result', {
            index: i,
            error: (error as Error).message
          });
        }

        // Small delay between extractions
        await randomDelay(100, 300);
      }

    } catch (error) {
      this.logger.error('Failed to extract search results', {
        error: (error as Error).message
      });
    }

    return results;
  }

  /**
   * Extract a single search result
   */
  private async extractSingleResult(page: Page, element: any): Promise<SearchResult | null> {
    try {
      const titleElement = await element.$('.title a');
      const title = titleElement ? await titleElement.textContent() : '';
      const url = titleElement ? await titleElement.getAttribute('href') : '';

      if (!title || !url) {
        return null;
      }

      const snippet = await this.extractSnippet(element);
      const authors = await this.extractResultAuthors(element);
      const categories = await this.extractResultCategories(element);
      const arxivId = await this.extractResultArxivId(element);
      const submissionDate = await this.extractResultSubmissionDate(element);

      const result: SearchResult = {
        title: title.trim(),
        url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
        snippet: snippet.trim(),
        metadata: {
          source: 'arXiv',
          extractedAt: new Date().toISOString(),
          categories,
          arxivId,
          submissionDate
        }
      };

      // Add optional properties only if they exist
      if (authors.length > 0) result.authors = authors;
      if (submissionDate) result.publicationDate = submissionDate;

      return result;

    } catch (error) {
      this.logger.debug('Failed to extract individual result details', {
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Extract snippet from result element
   */
  private async extractSnippet(element: any): Promise<string> {
    try {
      const snippetElement = await element.$('.abstract');
      return snippetElement ? await snippetElement.textContent() || '' : '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Extract authors from result element
   */
  private async extractResultAuthors(element: any): Promise<string[]> {
    try {
      const authorElements = await element.$$('.authors a');
      const authors: string[] = [];
      
      for (const authorElement of authorElements) {
        const author = await authorElement.textContent();
        if (author) {
          authors.push(author.trim());
        }
      }
      
      return authors;
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract categories from result element
   */
  private async extractResultCategories(element: any): Promise<string[]> {
    try {
      const categoryElements = await element.$$('.categories a');
      const categories: string[] = [];
      
      for (const categoryElement of categoryElements) {
        const category = await categoryElement.textContent();
        if (category) {
          categories.push(category.trim());
        }
      }
      
      return categories;
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract arXiv ID from result element
   */
  private async extractResultArxivId(element: any): Promise<string | undefined> {
    try {
      const idElement = await element.$('.list-title a');
      const idText = idElement ? await idElement.textContent() || '' : '';
      
      const match = idText.match(/arXiv:(\d+\.\d+)/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extract submission date from result element
   */
  private async extractResultSubmissionDate(element: any): Promise<string | undefined> {
    try {
      const dateElement = await element.$('.list-date');
      const dateText = dateElement ? await dateElement.textContent() || '' : '';
      
      const match = dateText.match(/(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Additional extraction methods for detailed document view
  private async extractAuthors(page: Page): Promise<string[]> {
    try {
      const authorElements = await page.$$('.authors a');
      const authors: string[] = [];
      
      for (const element of authorElements) {
        const author = await element.textContent();
        if (author) {
          authors.push(author.trim());
        }
      }
      
      return authors;
    } catch (error) {
      return [];
    }
  }

  private async extractAbstract(page: Page): Promise<string> {
    try {
      const abstractElement = await page.$('.abstract');
      return abstractElement ? await abstractElement.textContent() || '' : '';
    } catch (error) {
      return '';
    }
  }

  private async extractCategories(page: Page): Promise<string[]> {
    try {
      const categoryElements = await page.$$('.categories a');
      const categories: string[] = [];
      
      for (const element of categoryElements) {
        const category = await element.textContent();
        if (category) {
          categories.push(category.trim());
        }
      }
      
      return categories;
    } catch (error) {
      return [];
    }
  }

  private async extractSubmissionDate(page: Page): Promise<string | undefined> {
    try {
      const dateElement = await page.$('.dateline');
      const dateText = dateElement ? await dateElement.textContent() || '' : '';
      
      const match = dateText.match(/Submitted\s+(\d{1,2}\s+\w+\s+\d{4})/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async extractArxivId(page: Page): Promise<string | undefined> {
    try {
      const idElement = await page.$('.arxiv-id');
      const idText = idElement ? await idElement.textContent() || '' : '';
      
      const match = idText.match(/arXiv:(\d+\.\d+)/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async extractPdfUrl(page: Page): Promise<string | undefined> {
    try {
      const pdfElement = await page.$('a[href*=".pdf"]');
      const pdfUrl = pdfElement ? await pdfElement.getAttribute('href') : null;
      
      return pdfUrl ? `${this.baseUrl}${pdfUrl}` : undefined;
    } catch (error) {
      return undefined;
    }
  }
} 