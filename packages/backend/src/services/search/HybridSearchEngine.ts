import winston from 'winston';
import { OpenSearchService, SearchQuery, SearchResponse } from './OpenSearchService';
import { ChromaDBService, SimilaritySearchQuery, SimilaritySearchResponse } from './ChromaDBService';

export interface HybridSearchQuery {
  query: string;
  searchMode?: 'hybrid' | 'fulltext' | 'semantic';
  filters?: {
    sources?: string[];
    fileTypes?: string[];
    dateRange?: {
      from?: string;
      to?: string;
    };
    authors?: string[];
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
  includeHighlights?: boolean;
  weights?: {
    fulltext?: number;
    semantic?: number;
  };
}

export interface HybridSearchResult {
  id: string;
  title: string;
  content: string;
  url?: string;
  source: string;
  authors?: string[];
  publicationDate?: string;
  fileType: string;
  fileSize?: number;
  relevanceScore: number;
  semanticScore?: number;
  fulltextScore?: number;
  highlights?: {
    field: string;
    fragments: string[];
  }[];
  metadata?: Record<string, any>;
}

export interface HybridSearchResponse {
  results: HybridSearchResult[];
  totalResults: number;
  searchTime: number;
  searchMode: string;
  suggestions?: string[];
  facets?: {
    sources: Array<{ value: string; count: number }>;
    fileTypes: Array<{ value: string; count: number }>;
    authors: Array<{ value: string; count: number }>;
    years: Array<{ value: string; count: number }>;
  };
}

export interface SearchEngineConfig {
  defaultWeights: {
    fulltext: number;
    semantic: number;
  };
  maxResults: number;
  enableCaching: boolean;
  cacheTimeout: number;
}

export class HybridSearchEngine {
  private openSearchService: OpenSearchService;
  private chromaDBService: ChromaDBService;
  private logger: winston.Logger;
  private config: SearchEngineConfig;
  private initialized = false;

  constructor(
    openSearchService: OpenSearchService,
    chromaDBService: ChromaDBService,
    config: SearchEngineConfig,
    logger: winston.Logger
  ) {
    this.openSearchService = openSearchService;
    this.chromaDBService = chromaDBService;
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.openSearchService.initialize();
      await this.chromaDBService.initialize();
      
      this.initialized = true;
      this.logger.info('Hybrid search engine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize hybrid search engine:', error as Error);
      throw error;
    }
  }

  async search(query: HybridSearchQuery): Promise<HybridSearchResponse> {
    if (!this.initialized) {
      throw new Error('Hybrid search engine not initialized');
    }

    const startTime = Date.now();
    const searchMode = query.searchMode || 'hybrid';
    const weights = query.weights || this.config.defaultWeights;

    try {
      let results: HybridSearchResult[] = [];
      let searchTime = 0;

      switch (searchMode) {
        case 'fulltext':
          results = await this.performFulltextSearch(query);
          break;
        case 'semantic':
          results = await this.performSemanticSearch(query);
          break;
        case 'hybrid':
        default:
          const defaultWeights = { fulltext: 0.5, semantic: 0.5 };
          const finalWeights = {
            fulltext: weights?.fulltext ?? defaultWeights.fulltext,
            semantic: weights?.semantic ?? defaultWeights.semantic
          };
          results = await this.performHybridSearch(query, finalWeights);
          break;
      }

      searchTime = Date.now() - startTime;

      return {
        results,
        totalResults: results.length,
        searchTime,
        searchMode,
      };
    } catch (error) {
      this.logger.error('Hybrid search failed:', error as Error);
      throw error;
    }
  }

  private async performFulltextSearch(query: HybridSearchQuery): Promise<HybridSearchResult[]> {
    const searchQuery: SearchQuery = {
      query: query.query,
      filters: query.filters || {},
      ...(query.sort && { sort: query.sort }),
      ...(query.pagination && { pagination: query.pagination }),
      ...(query.includeHighlights !== undefined && { includeHighlights: query.includeHighlights }),
    };

    const response = await this.openSearchService.search(searchQuery);

    return response.results.map(result => ({
      id: result.id,
      title: result.title,
      content: result.content,
      ...(result.url && { url: result.url }),
      source: result.source,
      ...(result.authors && { authors: result.authors }),
      ...(result.publicationDate && { publicationDate: result.publicationDate }),
      fileType: result.fileType,
      ...(result.fileSize && { fileSize: result.fileSize }),
      relevanceScore: result.relevanceScore,
      fulltextScore: result.relevanceScore,
      ...(result.highlights && { highlights: result.highlights }),
      ...(result.metadata && { metadata: result.metadata }),
    }));
  }

  private async performSemanticSearch(query: HybridSearchQuery): Promise<HybridSearchResult[]> {
    const similarityQuery: SimilaritySearchQuery = {
      query: query.query,
      nResults: query.pagination?.limit || this.config.maxResults,
      where: this.buildChromaDBFilters(query.filters),
    };

    const response = await this.chromaDBService.similaritySearch(similarityQuery);

    return response.results.map(result => ({
      id: result.id,
      title: result.metadata.title || '',
      content: result.content,
      url: result.metadata.url,
      source: result.metadata.source || '',
      authors: result.metadata.authors,
      publicationDate: result.metadata.publicationDate,
      fileType: result.metadata.fileType || '',
      fileSize: result.metadata.fileSize,
      relevanceScore: 1 - result.distance, // Convert distance to similarity score
      semanticScore: 1 - result.distance,
      metadata: result.metadata,
    }));
  }

  private async performHybridSearch(
    query: HybridSearchQuery,
    weights: { fulltext: number; semantic: number }
  ): Promise<HybridSearchResult[]> {
    // Perform both searches in parallel
    const [fulltextResponse, semanticResponse] = await Promise.all([
      this.performFulltextSearch(query),
      this.performSemanticSearch(query),
    ]);

    // Combine and rank results using Reciprocal Rank Fusion
    const combinedResults = this.combineResults(
      fulltextResponse,
      semanticResponse,
      weights
    );

    // Sort by combined score
    combinedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply pagination
    if (query.pagination) {
      const start = (query.pagination.page - 1) * query.pagination.limit;
      const end = start + query.pagination.limit;
      return combinedResults.slice(start, end);
    }

    return combinedResults.slice(0, this.config.maxResults);
  }

  private combineResults(
    fulltextResults: HybridSearchResult[],
    semanticResults: HybridSearchResult[],
    weights: { fulltext: number; semantic: number }
  ): HybridSearchResult[] {
    const resultMap = new Map<string, HybridSearchResult>();

    // Add fulltext results
    fulltextResults.forEach((result, index) => {
      const normalizedScore = 1 / (index + 1); // Reciprocal rank
      resultMap.set(result.id, {
        ...result,
        fulltextScore: normalizedScore,
        relevanceScore: normalizedScore * weights.fulltext,
      });
    });

    // Add or update with semantic results
    semanticResults.forEach((result, index) => {
      const normalizedScore = 1 / (index + 1); // Reciprocal rank
      const existing = resultMap.get(result.id);

      if (existing) {
        // Combine scores
        existing.semanticScore = normalizedScore;
        existing.relevanceScore += normalizedScore * weights.semantic;
      } else {
        resultMap.set(result.id, {
          ...result,
          semanticScore: normalizedScore,
          relevanceScore: normalizedScore * weights.semantic,
        });
      }
    });

    return Array.from(resultMap.values());
  }

  private buildChromaDBFilters(filters?: HybridSearchQuery['filters']): Record<string, any> {
    if (!filters) return {};

    const chromaFilters: Record<string, any> = {};

    if (filters.sources?.length) {
      chromaFilters.source = { $in: filters.sources };
    }

    if (filters.fileTypes?.length) {
      chromaFilters.fileType = { $in: filters.fileTypes };
    }

    if (filters.authors?.length) {
      chromaFilters.authors = { $in: filters.authors };
    }

    if (filters.dateRange) {
      const dateFilter: any = {};
      if (filters.dateRange.from) dateFilter.$gte = filters.dateRange.from;
      if (filters.dateRange.to) dateFilter.$lte = filters.dateRange.to;
      if (Object.keys(dateFilter).length > 0) {
        chromaFilters.publicationDate = dateFilter;
      }
    }

    return chromaFilters;
  }

  async indexDocument(document: {
    id: string;
    title: string;
    content: string;
    url?: string;
    source: string;
    authors?: string[];
    publicationDate?: string;
    fileType: string;
    fileSize?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Index in OpenSearch
      await this.openSearchService.indexDocument({
        id: document.id,
        title: document.title,
        content: document.content,
        ...(document.url && { url: document.url }),
        source: document.source,
        ...(document.authors && { authors: document.authors }),
        ...(document.publicationDate && { publicationDate: document.publicationDate }),
        fileType: document.fileType,
        ...(document.fileSize && { fileSize: document.fileSize }),
        ...(document.metadata && { metadata: document.metadata }),
        createdAt: new Date().toISOString(),
      });

      // Index in ChromaDB
      await this.chromaDBService.addDocuments([{
        id: document.id,
        content: document.content,
        metadata: {
          title: document.title,
          url: document.url,
          source: document.source,
          authors: document.authors,
          publicationDate: document.publicationDate,
          fileType: document.fileType,
          fileSize: document.fileSize,
          ...document.metadata,
        },
      }]);

      this.logger.debug(`Indexed document in both search engines: ${document.id}`);
    } catch (error) {
      this.logger.error(`Failed to index document ${document.id}:`, error as Error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      await Promise.all([
        this.openSearchService.deleteDocument(documentId),
        this.chromaDBService.deleteDocument(documentId),
      ]);

      this.logger.debug(`Deleted document from both search engines: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}:`, error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    openSearch: boolean;
    chromaDB: boolean;
    overall: boolean;
  }> {
    const openSearchHealth = await this.openSearchService.healthCheck();
    const chromaDBHealth = await this.chromaDBService.healthCheck();

    return {
      openSearch: openSearchHealth,
      chromaDB: chromaDBHealth,
      overall: openSearchHealth && chromaDBHealth,
    };
  }

  async getStats(): Promise<{
    openSearch: any;
    chromaDB: any;
  }> {
    try {
      const [openSearchStats, chromaDBStats] = await Promise.all([
        this.openSearchService.getIndexStats(),
        this.chromaDBService.getCollectionStats(),
      ]);

      return {
        openSearch: openSearchStats,
        chromaDB: chromaDBStats,
      };
    } catch (error) {
      this.logger.error('Failed to get search engine stats:', error as Error);
      throw error;
    }
  }
}

export const createHybridSearchEngine = (
  openSearchService: OpenSearchService,
  chromaDBService: ChromaDBService,
  config: SearchEngineConfig,
  logger: winston.Logger
): HybridSearchEngine => {
  return new HybridSearchEngine(openSearchService, chromaDBService, config, logger);
}; 