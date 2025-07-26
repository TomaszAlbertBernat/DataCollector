import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

import { OpenAIService } from '../ai/OpenAIService';
import { LangChainService, QueryAnalysisResult, SearchStrategy, ContentAnalysisResult } from '../ai/LangChainService';
import { JobData, JobStatus, JobType, JobMetadata, CollectionOptions } from '../../types/job';

export interface CollectionRequest {
  query: string;
  sources?: string[];
  options?: CollectionOptions;
  userId?: string;
}

export interface CollectionResult {
  documentsFound: number;
  documentsDownloaded: number;
  documentsProcessed: number;
  relevantDocuments: number;
  searchStrategies: SearchStrategy[];
  errors: string[];
  warnings: string[];
}

export interface ContentItem {
  url: string;
  title: string;
  snippet: string;
  source: string;
  metadata: Record<string, any>;
  relevanceScore?: number;
  shouldDownload?: boolean;
  downloadReason?: string;
}

export interface CollectionPlan {
  id: string;
  query: string;
  analysisResult: QueryAnalysisResult;
  searchStrategies: SearchStrategy[];
  estimatedDuration: number; // minutes
  estimatedResults: number;
  priority: number;
}

export class DataCollectionAgent {
  private openaiService: OpenAIService;
  private langchainService: LangChainService;
  private logger: winston.Logger;

  constructor(
    openaiService: OpenAIService,
    langchainService: LangChainService,
    logger: winston.Logger
  ) {
    this.openaiService = openaiService;
    this.langchainService = langchainService;
    this.logger = logger;

    this.logger.info('DataCollectionAgent initialized');
  }

  /**
   * Create a comprehensive collection plan from user request
   */
  async createCollectionPlan(request: CollectionRequest): Promise<CollectionPlan> {
    try {
      this.logger.info('Creating collection plan', {
        query: request.query.substring(0, 100),
        sources: request.sources?.length || 'all',
        userId: request.userId
      });

      // Step 1: Analyze the query using LangChain
      const analysisResult = await this.langchainService.analyzeQuery(request.query);

      // Step 2: Filter strategies based on requested sources
      let searchStrategies = analysisResult.searchStrategies;
      if (request.sources && request.sources.length > 0) {
        searchStrategies = searchStrategies.filter(strategy =>
          request.sources!.some(source =>
            strategy.source.toLowerCase().includes(source.toLowerCase())
          )
        );
      }

      // Step 3: Sort strategies by priority
      searchStrategies.sort((a, b) => b.priority - a.priority);

      // Step 4: Estimate duration and results
      const estimatedDuration = this.estimateCollectionDuration(
        searchStrategies,
        analysisResult.estimatedResults,
        request.options
      );

      const plan: CollectionPlan = {
        id: uuidv4(),
        query: request.query,
        analysisResult,
        searchStrategies,
        estimatedDuration,
        estimatedResults: analysisResult.estimatedResults,
        priority: request.options?.priority || 2
      };

      this.logger.info('Collection plan created', {
        planId: plan.id,
        strategiesCount: searchStrategies.length,
        estimatedDuration: `${estimatedDuration} minutes`,
        confidence: analysisResult.confidence
      });

      return plan;

    } catch (error) {
      this.logger.error('Failed to create collection plan', {
        query: request.query.substring(0, 100),
        error: (error as Error).message
      });
      throw new Error(`Collection plan creation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute collection plan and gather content
   */
  async executeCollection(
    plan: CollectionPlan,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<CollectionResult> {
    try {
      this.logger.info('Starting collection execution', {
        planId: plan.id,
        strategiesCount: plan.searchStrategies.length
      });

      const result: CollectionResult = {
        documentsFound: 0,
        documentsDownloaded: 0,
        documentsProcessed: 0,
        relevantDocuments: 0,
        searchStrategies: plan.searchStrategies,
        errors: [],
        warnings: []
      };

      let allContentItems: ContentItem[] = [];
      const totalStrategies = plan.searchStrategies.length;

      // Execute each search strategy
      for (let i = 0; i < plan.searchStrategies.length; i++) {
        const strategy = plan.searchStrategies[i];
        if (!strategy) {
          this.logger.warn('Skipping undefined search strategy at index', { index: i });
          continue;
        }
        
        const progress = (i / totalStrategies) * 40; // 40% for search phase

        progressCallback?.(progress, `Searching ${strategy.source}: ${strategy.query}`);

        try {
          const contentItems = await this.executeSearchStrategy(strategy, plan.query);
          allContentItems.push(...contentItems);
          result.documentsFound += contentItems.length;

          this.logger.debug('Search strategy completed', {
            source: strategy.source,
            query: strategy.query,
            resultsFound: contentItems.length
          });

        } catch (error) {
          const errorMsg = `Search failed for ${strategy.source}: ${(error as Error).message}`;
          result.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // Remove duplicates based on URL
      allContentItems = this.deduplicateContent(allContentItems);

      progressCallback?.(45, 'Analyzing content relevance...');

      // Step 2: Analyze content relevance
      const relevantContent = await this.analyzeContentRelevance(
        plan.query,
        allContentItems,
        (progress) => progressCallback?.(45 + progress * 0.3, 'Analyzing content relevance...')
      );

      result.relevantDocuments = relevantContent.filter(item => item.shouldDownload).length;

      progressCallback?.(75, 'Filtering and prioritizing content...');

      // Step 3: Filter and prioritize content for download
      const contentToDownload = this.prioritizeContent(relevantContent);

      progressCallback?.(85, `Preparing to download ${contentToDownload.length} documents...`);

      // Step 4: Mark content for download (actual downloading handled by separate service)
      result.documentsDownloaded = contentToDownload.length;
      result.documentsProcessed = contentToDownload.length;

      progressCallback?.(100, 'Collection completed successfully');

      this.logger.info('Collection execution completed', {
        planId: plan.id,
        documentsFound: result.documentsFound,
        relevantDocuments: result.relevantDocuments,
        documentsToDownload: result.documentsDownloaded,
        errorsCount: result.errors.length
      });

      return result;

    } catch (error) {
      this.logger.error('Collection execution failed', {
        planId: plan.id,
        error: (error as Error).message
      });
      throw new Error(`Collection execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a single search strategy (to be implemented with actual scrapers)
   */
  private async executeSearchStrategy(strategy: SearchStrategy, originalQuery: string): Promise<ContentItem[]> {
    // This is a placeholder - actual implementation will use web scrapers
    // For now, return mock data to demonstrate the flow

    this.logger.debug('Executing search strategy', {
      source: strategy.source,
      query: strategy.query
    });

    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock results based on strategy
    const mockResults: ContentItem[] = [];
    const resultCount = Math.floor(Math.random() * 10) + 5; // 5-14 results

    for (let i = 0; i < resultCount; i++) {
      mockResults.push({
        url: `https://${strategy.source.toLowerCase().replace(' ', '')}.com/document/${i + 1}`,
        title: `Research Document ${i + 1}: ${strategy.query}`,
        snippet: `This document discusses aspects of ${originalQuery} and provides insights...`,
        source: strategy.source,
        metadata: {
          authors: [`Author ${i + 1}`, `Researcher ${i + 1}`],
          publicationDate: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
          type: 'research-paper'
        }
      });
    }

    return mockResults;
  }

  /**
   * Analyze content relevance using AI
   */
  private async analyzeContentRelevance(
    query: string,
    contentItems: ContentItem[],
    progressCallback?: (progress: number) => void
  ): Promise<ContentItem[]> {
    const analyzed: ContentItem[] = [];

    for (let i = 0; i < contentItems.length; i++) {
      const item = contentItems[i];
      if (!item) {
        this.logger.warn('Skipping undefined content item at index', { index: i });
        continue;
      }
      
      progressCallback?.((i / contentItems.length));

      try {
        const analysis = await this.langchainService.analyzeContentRelevance(
          query,
          `${item.title}\n\n${item.snippet}`,
          item.metadata
        );

        analyzed.push({
          url: item.url,
          title: item.title,
          snippet: item.snippet,
          source: item.source,
          metadata: item.metadata,
          relevanceScore: analysis.relevanceScore,
          shouldDownload: analysis.shouldDownload,
          downloadReason: analysis.reasoning
        });

      } catch (error) {
        this.logger.warn('Content relevance analysis failed', {
          url: item.url,
          error: (error as Error).message
        });
        
        // Fallback: mark as potentially relevant
        analyzed.push({
          url: item.url,
          title: item.title,
          snippet: item.snippet,
          source: item.source,
          metadata: item.metadata,
          relevanceScore: 0.5,
          shouldDownload: true,
          downloadReason: 'Analysis failed, downloading as precaution'
        });
      }
    }

    return analyzed;
  }

  /**
   * Remove duplicate content based on URL similarity
   */
  private deduplicateContent(contentItems: ContentItem[]): ContentItem[] {
    const uniqueUrls = new Set<string>();
    const deduplicated: ContentItem[] = [];

    for (const item of contentItems) {
      const normalizedUrl = item.url.toLowerCase().replace(/[\/\?#].*$/, '');
      
      if (!uniqueUrls.has(normalizedUrl)) {
        uniqueUrls.add(normalizedUrl);
        deduplicated.push(item);
      }
    }

    this.logger.debug('Content deduplicated', {
      originalCount: contentItems.length,
      uniqueCount: deduplicated.length,
      duplicatesRemoved: contentItems.length - deduplicated.length
    });

    return deduplicated;
  }

  /**
   * Prioritize content for download based on relevance and other factors
   */
  private prioritizeContent(contentItems: ContentItem[]): ContentItem[] {
    return contentItems
      .filter(item => item.shouldDownload && (item.relevanceScore || 0) > 0.3)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 50); // Limit to top 50 most relevant documents
  }

  /**
   * Estimate collection duration based on strategies and options
   */
  private estimateCollectionDuration(
    strategies: SearchStrategy[],
    estimatedResults: number,
    options?: CollectionOptions
  ): number {
    // Base time estimates (in minutes)
    const baseSearchTime = strategies.length * 2; // 2 minutes per strategy
    const analysisTime = Math.min(estimatedResults * 0.1, 30); // Max 30 minutes for analysis
    const downloadTime = Math.min(estimatedResults * 0.05, 20); // Max 20 minutes for downloads
    
    let totalTime = baseSearchTime + analysisTime + downloadTime;
    
    // Adjust based on options
    if (options?.maxResults && options.maxResults < estimatedResults) {
      totalTime *= (options.maxResults / estimatedResults);
    }
    
    return Math.ceil(totalTime);
  }

  /**
   * Generate collection summary
   */
  async generateCollectionSummary(
    plan: CollectionPlan,
    result: CollectionResult
  ): Promise<string> {
    try {
      const documents = [
        {
          title: 'Collection Plan',
          content: `Query: ${plan.query}\nStrategies: ${plan.searchStrategies.map(s => s.source).join(', ')}`
        },
        {
          title: 'Collection Results',
          content: `Found: ${result.documentsFound}, Downloaded: ${result.documentsDownloaded}, Relevant: ${result.relevantDocuments}`
        }
      ];

      return await this.langchainService.generateDocumentSummary(documents);

    } catch (error) {
      this.logger.error('Summary generation failed', {
        error: (error as Error).message
      });
      return `Collection completed for query: "${plan.query}". Found ${result.documentsFound} documents, downloaded ${result.documentsDownloaded} relevant items.`;
    }
  }
}

// Factory function
export const createDataCollectionAgent = (
  openaiService: OpenAIService,
  langchainService: LangChainService,
  logger: winston.Logger
): DataCollectionAgent => {
  return new DataCollectionAgent(openaiService, langchainService, logger);
}; 