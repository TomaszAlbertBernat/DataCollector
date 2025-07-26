import { Page } from 'playwright';
import winston from 'winston';

import { BaseScraper, ScrapingConfig, SearchResult, randomDelay } from './BaseScraper';

export interface GoogleScholarOptions {
  yearFrom?: number;
  yearTo?: number;
  includePatents?: boolean;
  includeCitations?: boolean;
  sortBy?: 'relevance' | 'date';
  maxResults?: number;
}

export class GoogleScholarScraper extends BaseScraper {
  private baseUrl = 'https://scholar.google.com';

  constructor(config: ScrapingConfig, logger: winston.Logger) {
    super(config, logger);
  }

  /**
   * Search Google Scholar for academic papers
   */
  async search(query: string, options: GoogleScholarOptions = {}): Promise<SearchResult[]> {
    let page: Page | null = null;
    
    try {
      page = await this.createPage();
      
      this.logger.info('Starting Google Scholar search', {
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
          throw new Error('Google Scholar access blocked - possible CAPTCHA or rate limiting');
        }
      }

      // Wait for search results to load
      const resultsLoaded = await this.waitForElementSafely(page, '[data-lid]', 10000);
      if (!resultsLoaded) {
        this.logger.warn('No search results found or page did not load properly');
        return [];
      }

      // Extract search results
      const results = await this.extractSearchResults(page, options.maxResults || 20);

      this.logger.info('Google Scholar search completed', {
        query: query.substring(0, 50),
        resultsFound: results.length
      });

      return results;

    } catch (error) {
      this.logger.error('Google Scholar search failed', {
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
   * Extract document details from Google Scholar page
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
        title: await this.safeTextContent(page, 'h3'),
        authors: await this.extractAuthors(page),
        abstract: await this.extractAbstract(page),
        citationCount: await this.extractCitationCount(page),
        publicationInfo: await this.extractPublicationInfo(page),
        relatedArticles: await this.extractRelatedArticles(page),
        pdfUrl: await this.extractPdfUrl(page),
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'Google Scholar',
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
      name: 'Google Scholar',
      supportedDomains: ['scholar.google.com', 'scholar.google.co.uk'],
      maxResultsPerQuery: 100,
      rateLimit: 10 // 10 requests per minute
    };
  }

  /**
   * Build search URL with parameters
   */
  private buildSearchUrl(query: string, options: GoogleScholarOptions): string {
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('hl', 'en');
    
    if (options.yearFrom || options.yearTo) {
      const yearRange = `${options.yearFrom || '1900'}-${options.yearTo || new Date().getFullYear()}`;
      params.set('as_ylo', options.yearFrom?.toString() || '1900');
      params.set('as_yhi', options.yearTo?.toString() || new Date().getFullYear().toString());
    }

    if (!options.includePatents) {
      params.set('as_vis', '1'); // Exclude patents
    }

    if (!options.includeCitations) {
      params.set('as_sdt', '1,5'); // Exclude citations
    }

    if (options.sortBy === 'date') {
      params.set('scisbd', '1'); // Sort by date
    }

    return `${this.baseUrl}/scholar?${params.toString()}`;
  }

  /**
   * Extract search results from the page
   */
  private async extractSearchResults(page: Page, maxResults: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Get all result containers
      const resultElements = await page.$$('[data-lid]');
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
      const titleElement = await element.$('h3 a');
      const title = titleElement ? await titleElement.textContent() : '';
      const url = titleElement ? await titleElement.getAttribute('href') : '';

      if (!title || !url) {
        return null;
      }

      const snippet = await this.extractSnippet(element);
      const authors = await this.extractResultAuthors(element);
      const publicationInfo = await this.extractResultPublicationInfo(element);
      const citationCount = await this.extractResultCitationCount(element);
      const pdfUrl = await this.extractResultPdfUrl(element);

      const result: SearchResult = {
        title: title.trim(),
        url: url.startsWith('http') ? url : `https://scholar.google.com${url}`,
        snippet: snippet.trim(),
        metadata: {
          source: 'Google Scholar',
          extractedAt: new Date().toISOString(),
          publicationInfo
        }
      };

      // Add optional properties only if they exist
      if (authors.length > 0) result.authors = authors;
      if (publicationInfo.year) result.publicationDate = publicationInfo.year;
      if (publicationInfo.journal) result.journal = publicationInfo.journal;
      if (citationCount !== undefined) result.citations = citationCount;
      if (pdfUrl) result.pdfUrl = pdfUrl;

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
      const snippetElement = await element.$('.gs_rs');
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
      const authorElement = await element.$('.gs_a');
      const authorText = authorElement ? await authorElement.textContent() || '' : '';
      
      // Authors are typically at the beginning, separated by commas
      const match = authorText.match(/^([^-]+)/);
      if (match) {
        return match[1].split(',').map((author: string) => author.trim()).filter(Boolean);
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract publication information from result element
   */
  private async extractResultPublicationInfo(element: any): Promise<{ journal?: string; year?: string; publisher?: string }> {
    try {
      const infoElement = await element.$('.gs_a');
      const infoText = infoElement ? await infoElement.textContent() || '' : '';
      
      const info: { journal?: string; year?: string; publisher?: string } = {};
      
      // Extract year
      const yearMatch = infoText.match(/(\d{4})/);
      if (yearMatch) {
        info.year = yearMatch[1];
      }
      
      // Extract journal/conference (simplified extraction)
      const parts = infoText.split('-');
      if (parts.length > 1) {
        info.journal = parts[1].trim();
      }
      
      return info;
    } catch (error) {
      return {};
    }
  }

  /**
   * Extract citation count from result element
   */
  private async extractResultCitationCount(element: any): Promise<number | undefined> {
    try {
      const citationElement = await element.$('.gs_fl a[href*="cites"]');
      const citationText = citationElement ? await citationElement.textContent() || '' : '';
      
      const match = citationText.match(/Cited by (\d+)/);
      return match ? parseInt(match[1]) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extract PDF URL from result element
   */
  private async extractResultPdfUrl(element: any): Promise<string | undefined> {
    try {
      const pdfElement = await element.$('.gs_or_ggsm a');
      const pdfUrl = pdfElement ? await pdfElement.getAttribute('href') : null;
      
      return pdfUrl || undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Additional extraction methods for detailed document view
  private async extractAuthors(page: Page): Promise<string[]> {
    // Implementation for detailed author extraction
    return [];
  }

  private async extractAbstract(page: Page): Promise<string> {
    // Implementation for abstract extraction
    return '';
  }

  private async extractCitationCount(page: Page): Promise<number> {
    // Implementation for citation count extraction
    return 0;
  }

  private async extractPublicationInfo(page: Page): Promise<any> {
    // Implementation for detailed publication info extraction
    return {};
  }

  private async extractRelatedArticles(page: Page): Promise<string[]> {
    // Implementation for related articles extraction
    return [];
  }

  private async extractPdfUrl(page: Page): Promise<string | undefined> {
    // Implementation for PDF URL extraction
    return undefined;
  }
} 