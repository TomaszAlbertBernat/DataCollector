import { Page } from 'playwright';
import winston from 'winston';

import { BaseScraper, ScrapingConfig, SearchResult, randomDelay } from './BaseScraper';

export interface PubMedOptions {
  yearFrom?: number;
  yearTo?: number;
  publicationType?: string;
  language?: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'date' | 'journal';
}

export class PubMedScraper extends BaseScraper {
  private baseUrl = 'https://pubmed.ncbi.nlm.nih.gov';

  constructor(config: ScrapingConfig, logger: winston.Logger) {
    super(config, logger);
  }

  /**
   * Search PubMed for academic papers
   */
  async search(query: string, options: PubMedOptions = {}): Promise<SearchResult[]> {
    let page: Page | null = null;
    
    try {
      page = await this.createPage();
      
      this.logger.info('Starting PubMed search', {
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
          throw new Error('PubMed access blocked - possible CAPTCHA or rate limiting');
        }
      }

      // Wait for search results to load
      const resultsLoaded = await this.waitForElementSafely(page, '.result-item', 10000);
      if (!resultsLoaded) {
        this.logger.warn('No search results found or page did not load properly');
        return [];
      }

      // Extract search results
      const results = await this.extractSearchResults(page, options.maxResults || 20);

      this.logger.info('PubMed search completed', {
        query: query.substring(0, 50),
        resultsFound: results.length
      });

      return results;

    } catch (error) {
      this.logger.error('PubMed search failed', {
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
   * Extract document details from PubMed page
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
        title: await this.safeTextContent(page, 'h1'),
        authors: await this.extractAuthors(page),
        abstract: await this.extractAbstract(page),
        publicationInfo: await this.extractPublicationInfo(page),
        keywords: await this.extractKeywords(page),
        doi: await this.extractDoi(page),
        pmid: await this.extractPmid(page),
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'PubMed',
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
      name: 'PubMed',
      supportedDomains: ['pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov'],
      maxResultsPerQuery: 100,
      rateLimit: 15 // 15 requests per minute
    };
  }

  /**
   * Build search URL with parameters
   */
  private buildSearchUrl(query: string, options: PubMedOptions): string {
    const params = new URLSearchParams();
    params.set('term', query);
    params.set('format', 'summary');
    
    if (options.yearFrom || options.yearTo) {
      const yearRange = `${options.yearFrom || '1900'}:${options.yearTo || new Date().getFullYear()}[dp]`;
      params.set('filter', yearRange);
    }

    if (options.publicationType) {
      params.set('filter', `${options.publicationType}[pt]`);
    }

    if (options.language) {
      params.set('filter', `${options.language}[lang]`);
    }

    if (options.sortBy) {
      const sortMap = {
        'relevance': 'relevance',
        'date': 'date',
        'journal': 'journal'
      };
      params.set('sort', sortMap[options.sortBy] || 'relevance');
    }

    return `${this.baseUrl}/?${params.toString()}`;
  }

  /**
   * Extract search results from the page
   */
  private async extractSearchResults(page: Page, maxResults: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Get all result containers
      const resultElements = await page.$$('.result-item');
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
      const titleElement = await element.$('.result-title a');
      const title = titleElement ? await titleElement.textContent() : '';
      const url = titleElement ? await titleElement.getAttribute('href') : '';

      if (!title || !url) {
        return null;
      }

      const snippet = await this.extractSnippet(element);
      const authors = await this.extractResultAuthors(element);
      const publicationInfo = await this.extractResultPublicationInfo(element);
      const pmid = await this.extractResultPmid(element);

      const result: SearchResult = {
        title: title.trim(),
        url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
        snippet: snippet.trim(),
        metadata: {
          source: 'PubMed',
          extractedAt: new Date().toISOString(),
          publicationInfo,
          pmid
        }
      };

      // Add optional properties only if they exist
      if (authors.length > 0) result.authors = authors;
      if (publicationInfo.year) result.publicationDate = publicationInfo.year;
      if (publicationInfo.journal) result.journal = publicationInfo.journal;

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
      const snippetElement = await element.$('.result-snippet');
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
      const authorElement = await element.$('.result-authors');
      const authorText = authorElement ? await authorElement.textContent() || '' : '';
      
      // Authors are typically separated by commas
      return authorText.split(',').map((author: string) => author.trim()).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract publication information from result element
   */
  private async extractResultPublicationInfo(element: any): Promise<{ journal?: string; year?: string; publisher?: string }> {
    try {
      const infoElement = await element.$('.result-journal');
      const infoText = infoElement ? await infoElement.textContent() || '' : '';
      
      const info: { journal?: string; year?: string; publisher?: string } = {};
      
      // Extract year
      const yearMatch = infoText.match(/(\d{4})/);
      if (yearMatch) {
        info.year = yearMatch[1];
      }
      
      // Extract journal (simplified extraction)
      const parts = infoText.split('.');
      if (parts.length > 0) {
        info.journal = parts[0].trim();
      }
      
      return info;
    } catch (error) {
      return {};
    }
  }

  /**
   * Extract PMID from result element
   */
  private async extractResultPmid(element: any): Promise<string | undefined> {
    try {
      const pmidElement = await element.$('.result-pmid');
      const pmidText = pmidElement ? await pmidElement.textContent() || '' : '';
      
      const match = pmidText.match(/PMID: (\d+)/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  }

  // Additional extraction methods for detailed document view
  private async extractAuthors(page: Page): Promise<string[]> {
    try {
      const authorElements = await page.$$('.authors-list a');
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
      const abstractElement = await page.$('.abstract-content');
      return abstractElement ? await abstractElement.textContent() || '' : '';
    } catch (error) {
      return '';
    }
  }

  private async extractPublicationInfo(page: Page): Promise<any> {
    try {
      const infoElement = await page.$('.publication-info');
      const infoText = infoElement ? await infoElement.textContent() || '' : '';
      
      const info: any = {};
      
      // Extract year
      const yearMatch = infoText.match(/(\d{4})/);
      if (yearMatch) {
        info.year = yearMatch[1];
      }
      
      // Extract journal
      const journalMatch = infoText.match(/Journal: ([^.]+)/);
      if (journalMatch) {
        info.journal = journalMatch[1].trim();
      }
      
      return info;
    } catch (error) {
      return {};
    }
  }

  private async extractKeywords(page: Page): Promise<string[]> {
    try {
      const keywordElements = await page.$$('.keyword-list a');
      const keywords: string[] = [];
      
      for (const element of keywordElements) {
        const keyword = await element.textContent();
        if (keyword) {
          keywords.push(keyword.trim());
        }
      }
      
      return keywords;
    } catch (error) {
      return [];
    }
  }

  private async extractDoi(page: Page): Promise<string | undefined> {
    try {
      const doiElement = await page.$('.doi-link');
      const doiText = doiElement ? await doiElement.textContent() || '' : '';
      
      const match = doiText.match(/DOI: (.+)/);
      return match ? match[1].trim() : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async extractPmid(page: Page): Promise<string | undefined> {
    try {
      const pmidElement = await page.$('.pmid');
      const pmidText = pmidElement ? await pmidElement.textContent() || '' : '';
      
      const match = pmidText.match(/PMID: (\d+)/);
      return match ? match[1] : undefined;
    } catch (error) {
      return undefined;
    }
  }
} 