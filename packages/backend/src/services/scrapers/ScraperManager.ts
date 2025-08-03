import winston from 'winston';

import { BaseScraper, ScrapingConfig, SearchResult, createDefaultScrapingConfig } from './BaseScraper';
import { GoogleScholarScraper, GoogleScholarOptions } from './GoogleScholarScraper';
import { PubMedScraper } from './PubMedScraper';
import { ArXivScraper } from './ArXivScraper';
import { EnvironmentConfig } from '../../config/environment';

type ScraperName = 'google_scholar' | 'pubmed' | 'arxiv';

export interface ScraperManagerConfig {
  scrapers: {
    googleScholar: ScrapingConfig;
    pubmed: ScrapingConfig;
    arxiv: ScrapingConfig;
  };
  globalRateLimit: number; // Global requests per minute across all scrapers
  maxConcurrentScrapers: number;
  retryFailedSources: boolean;
}

export interface SearchOptions {
  sources?: string[];
  maxResultsPerSource?: number;
  timeout?: number;
  filters?: {
    yearFrom?: number;
    yearTo?: number;
    includePatents?: boolean;
    includeCitations?: boolean;
  };
}

export interface ScraperStats {
  name: string;
  isInitialized: boolean;
  isActive: boolean;
  requestsCount: number;
  successRate: number;
  averageResponseTime: number;
  lastError?: string;
  rateLimit: number;
}

export interface SearchSession {
  id: string;
  query: string;
  startTime: Date;
  endTime?: Date;
  totalResults: number;
  successfulSources: string[];
  failedSources: string[];
  errors: string[];
}

export class ScraperManager {
  private scrapers: Map<string, BaseScraper> = new Map();
  private config: ScraperManagerConfig;
  private logger: winston.Logger;
  private initialized = false;
  private globalRequestCount = 0;
  private lastGlobalRequestTime = 0;
  private activeSessions: Map<string, SearchSession> = new Map();

  // Scraper statistics
  private stats: Map<string, ScraperStats> = new Map();

  constructor(config: ScraperManagerConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize all scrapers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('ScraperManager already initialized');
      return;
    }

    try {
      this.logger.info('Initializing ScraperManager');

      // Initialize Google Scholar scraper
      if (this.config.scrapers.googleScholar) {
        const googleScholar = new GoogleScholarScraper(
          this.config.scrapers.googleScholar,
          this.logger
        );
        await googleScholar.initialize();
        this.scrapers.set('Google Scholar', googleScholar);
        
        this.initializeScraperStats('Google Scholar', googleScholar);
        this.logger.info('Google Scholar scraper initialized');
      }

      // Initialize PubMed scraper
      if (this.config.scrapers.pubmed) {
        const pubmed = new PubMedScraper(
          this.config.scrapers.pubmed,
          this.logger
        );
        await pubmed.initialize();
        this.scrapers.set('PubMed', pubmed);
        
        this.initializeScraperStats('PubMed', pubmed);
        this.logger.info('PubMed scraper initialized');
      }

      // Initialize arXiv scraper
      if (this.config.scrapers.arxiv) {
        const arxiv = new ArXivScraper(
          this.config.scrapers.arxiv,
          this.logger
        );
        await arxiv.initialize();
        this.scrapers.set('arXiv', arxiv);
        
        this.initializeScraperStats('arXiv', arxiv);
        this.logger.info('arXiv scraper initialized');
      }

      this.initialized = true;
      this.logger.info('ScraperManager initialization completed', {
        scrapersCount: this.scrapers.size,
        availableScrapers: Array.from(this.scrapers.keys())
      });

    } catch (error) {
      this.logger.error('ScraperManager initialization failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Cleanup all scrapers
   */
  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up ScraperManager');

      const cleanupPromises = Array.from(this.scrapers.values()).map(scraper => 
        scraper.cleanup().catch(error => 
          this.logger.error('Scraper cleanup failed', { error: error.message })
        )
      );

      await Promise.all(cleanupPromises);
      
      this.scrapers.clear();
      this.stats.clear();
      this.activeSessions.clear();
      this.initialized = false;

      this.logger.info('ScraperManager cleanup completed');

    } catch (error) {
      this.logger.error('ScraperManager cleanup failed', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Search across multiple sources
   */
  async search(
    query: string, 
    options: SearchOptions = {}
  ): Promise<{ results: SearchResult[]; session: SearchSession }> {
    if (!this.initialized) {
      throw new Error('ScraperManager not initialized');
    }

    const sessionId = this.generateSessionId();
    const session: SearchSession = {
      id: sessionId,
      query,
      startTime: new Date(),
      totalResults: 0,
      successfulSources: [],
      failedSources: [],
      errors: []
    };

    this.activeSessions.set(sessionId, session);

    try {
      this.logger.info('Starting multi-source search', {
        sessionId,
        query: query.substring(0, 100),
        sources: options.sources || 'all'
      });

      // Determine which scrapers to use
      const scrapersToUse = this.getScrapersForSearch(options.sources);
      
      if (scrapersToUse.length === 0) {
        throw new Error('No available scrapers for the requested sources');
      }

      // Execute searches in parallel with concurrency control
      const searchPromises = scrapersToUse.map(scraperName => 
        this.executeScraperSearch(scraperName, query, options, session)
      );

      const searchResults = await Promise.allSettled(searchPromises);
      
      // Collect all successful results
      const allResults: SearchResult[] = [];
      
      for (let i = 0; i < searchResults.length; i++) {
        const result = searchResults[i];
        const scraperName = scrapersToUse[i];

        if (!scraperName || !result) continue; // Safety check

        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
          session.successfulSources.push(scraperName);
          this.updateScraperStats(scraperName, true, result.value.length);
        } else if (result.status === 'rejected') {
          session.failedSources.push(scraperName);
          const errorMessage = result.reason?.message || 'Unknown error';
          session.errors.push(`${scraperName}: ${errorMessage}`);
          this.updateScraperStats(scraperName, false, 0);
          
          this.logger.error('Scraper search failed', {
            sessionId,
            scraper: scraperName,
            error: errorMessage
          });
        }
      }

      // Remove duplicates and sort by relevance
      const uniqueResults = this.deduplicateResults(allResults);
      session.totalResults = uniqueResults.length;
      session.endTime = new Date();

      this.logger.info('Multi-source search completed', {
        sessionId,
        totalResults: uniqueResults.length,
        successfulSources: session.successfulSources.length,
        failedSources: session.failedSources.length,
        duration: session.endTime.getTime() - session.startTime.getTime()
      });

      return { results: uniqueResults, session };

    } catch (error) {
      session.endTime = new Date();
      session.errors.push((error as Error).message);
      
      this.logger.error('Multi-source search failed', {
        sessionId,
        error: (error as Error).message
      });
      
      throw error;
    } finally {
      // Clean up session after some time
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Search using a specific scraper
   */
  async searchSpecific(
    scraperName: string,
    query: string,
    options: any = {}
  ): Promise<SearchResult[]> {
    const scraper = this.scrapers.get(scraperName);
    if (!scraper) {
      throw new Error(`Scraper '${scraperName}' not found or not initialized`);
    }

    await this.enforceGlobalRateLimit();

    try {
      const startTime = Date.now();
      const results = await scraper.search(query, options);
      const duration = Date.now() - startTime;

      this.updateScraperStats(scraperName, true, results.length, duration);
      
      return results;

    } catch (error) {
      this.updateScraperStats(scraperName, false, 0);
      throw error;
    }
  }

  /**
   * Get available scrapers
   */
  getAvailableScrapers(): string[] {
    return Array.from(this.scrapers.keys());
  }

  /**
   * Get scraper statistics
   */
  getScraperStats(): ScraperStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get active search sessions
   */
  getActiveSessions(): SearchSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Check if a specific scraper is available
   */
  isScraperAvailable(scraperName: string): boolean {
    const stats = this.stats.get(scraperName);
    return stats ? stats.isInitialized && !stats.lastError : false;
  }

  /**
   * Execute search with a specific scraper
   */
  private async executeScraperSearch(
    scraperName: string,
    query: string,
    options: SearchOptions,
    session: SearchSession
  ): Promise<SearchResult[]> {
    const scraper = this.scrapers.get(scraperName);
    if (!scraper) {
      throw new Error(`Scraper '${scraperName}' not found`);
    }

    // Enforce global rate limiting
    await this.enforceGlobalRateLimit();

    const startTime = Date.now();

    try {
      // Prepare scraper-specific options
      const scraperOptions = this.prepareScraperOptions(scraperName, options);
      
      const results = await scraper.search(query, scraperOptions);
      const duration = Date.now() - startTime;

      this.logger.debug('Scraper search completed', {
        sessionId: session.id,
        scraper: scraperName,
        resultsCount: results.length,
        duration: `${duration}ms`
      });

      return results;

    } catch (error) {
      this.logger.error('Scraper search failed', {
        sessionId: session.id,
        scraper: scraperName,
        error: (error as Error).message,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    }
  }

  /**
   * Prepare scraper-specific options from generic options
   */
  private prepareScraperOptions(scraperName: string, options: SearchOptions): any {
    const baseOptions = {
      maxResults: options.maxResultsPerSource || 20
    };

    switch (scraperName) {
      case 'Google Scholar':
        return {
          ...baseOptions,
          yearFrom: options.filters?.yearFrom,
          yearTo: options.filters?.yearTo,
          includePatents: options.filters?.includePatents,
          includeCitations: options.filters?.includeCitations
        } as GoogleScholarOptions;
      
      case 'PubMed':
        return {
          ...baseOptions,
          sortBy: options.filters?.yearFrom ? 'date' : 'relevance'
        };
      
      case 'arXiv':
        return {
          ...baseOptions,
          sortBy: options.filters?.yearFrom ? 'date' : 'relevance',
          sortOrder: 'descending'
        };
      
      // Add cases for other scrapers as they're implemented
      default:
        return baseOptions;
    }
  }

  /**
   * Get scrapers to use for search based on requested sources
   */
  private getScrapersForSearch(requestedSources?: string[]): string[] {
    const availableScrapers = Array.from(this.scrapers.keys());
    
    if (!requestedSources || requestedSources.length === 0) {
      return availableScrapers.filter(name => this.isScraperAvailable(name));
    }

    return requestedSources.filter(source => {
      const scraperName = this.findScraperBySource(source);
      return scraperName && this.isScraperAvailable(scraperName);
    });
  }

  /**
   * Find scraper by source name or domain
   */
  private findScraperBySource(source: string): string | null {
    const lowerSource = source.toLowerCase();
    
    for (const [scraperName, scraper] of this.scrapers) {
      const info = scraper.getScraperInfo();
      
      if (info.name.toLowerCase() === lowerSource ||
          info.supportedDomains.some(domain => domain.includes(lowerSource) || lowerSource.includes(domain))) {
        return scraperName;
      }
    }
    
    return null;
  }

  /**
   * Remove duplicate results based on URL and title similarity
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const result of results) {
      const key = this.generateDeduplicationKey(result);
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(result);
      }
    }

    // Sort by relevance (prioritize results with more metadata)
    return deduplicated.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a);
      const scoreB = this.calculateRelevanceScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Generate deduplication key for result
   */
  private generateDeduplicationKey(result: SearchResult): string {
    // Normalize URL and title for comparison
    const normalizedUrl = result.url.toLowerCase().replace(/[\/\?#].*$/, '');
    const normalizedTitle = result.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    return `${normalizedUrl}|${normalizedTitle}`;
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(result: SearchResult): number {
    let score = 0;
    
    if (result.authors && result.authors.length > 0) score += 2;
    if (result.publicationDate) score += 2;
    if (result.journal) score += 1;
    if (result.citations && result.citations > 0) score += Math.min(result.citations / 10, 5);
    if (result.pdfUrl) score += 3;
    
    return score;
  }

  /**
   * Initialize scraper statistics
   */
  private initializeScraperStats(name: string, scraper: BaseScraper): void {
    const info = scraper.getScraperInfo();
    
    this.stats.set(name, {
      name,
      isInitialized: true,
      isActive: false,
      requestsCount: 0,
      successRate: 0,
      averageResponseTime: 0,
      rateLimit: info.rateLimit
    });
  }

  /**
   * Update scraper statistics
   */
  private updateScraperStats(
    name: string, 
    success: boolean, 
    resultCount: number, 
    responseTime?: number
  ): void {
    const stats = this.stats.get(name);
    if (!stats) return;

    stats.requestsCount++;
    stats.isActive = true;
    
    if (success) {
      const successCount = Math.round(stats.successRate * (stats.requestsCount - 1)) + 1;
      stats.successRate = successCount / stats.requestsCount;
      delete stats.lastError;
    } else {
      const successCount = Math.round(stats.successRate * (stats.requestsCount - 1));
      stats.successRate = successCount / stats.requestsCount;
    }

    if (responseTime) {
      const totalTime = stats.averageResponseTime * (stats.requestsCount - 1) + responseTime;
      stats.averageResponseTime = totalTime / stats.requestsCount;
    }
  }

  /**
   * Enforce global rate limiting
   */
  private async enforceGlobalRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastGlobalRequestTime;
    const minInterval = 60000 / this.config.globalRateLimit; // Convert rate limit to interval

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastGlobalRequestTime = Date.now();
    this.globalRequestCount++;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Factory function for creating scraper manager
export const createScraperManager = (logger: winston.Logger): ScraperManager => {
  const config: ScraperManagerConfig = {
    scrapers: {
      googleScholar: {
        ...createDefaultScrapingConfig(),
        delayBetweenRequests: 3000, // 3 seconds for Google Scholar
        maxConcurrentPages: 2
      },
      pubmed: {
        ...createDefaultScrapingConfig(),
        delayBetweenRequests: 2000, // 2 seconds for PubMed
        maxConcurrentPages: 3
      },
      arxiv: {
        ...createDefaultScrapingConfig(),
        delayBetweenRequests: 1500, // 1.5 seconds for arXiv
        maxConcurrentPages: 3
      }
    },
    globalRateLimit: 20, // 20 requests per minute globally
    maxConcurrentScrapers: 3,
    retryFailedSources: true
  };

  return new ScraperManager(config, logger);
}; 