import { Client } from '@opensearch-project/opensearch';
import winston from 'winston';

export interface OpenSearchConfig {
  node: string;
  auth: {
    username: string;
    password: string;
  };
  ssl?: {
    rejectUnauthorized: boolean;
  };
  timeout: number;
}

export interface DocumentIndexData {
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
  createdAt: string;
}

export interface SearchQuery {
  query: string;
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
}

export interface SearchResult {
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
  highlights?: {
    field: string;
    fragments: string[];
  }[];
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  suggestions?: string[];
  facets?: {
    sources: Array<{ value: string; count: number }>;
    fileTypes: Array<{ value: string; count: number }>;
    authors: Array<{ value: string; count: number }>;
    years: Array<{ value: string; count: number }>;
  };
}

export class OpenSearchService {
  private client: Client;
  private logger: winston.Logger;
  private config: OpenSearchConfig;
  private indexName = 'documents';
  private initialized = false;

  constructor(config: OpenSearchConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    
    this.client = new Client({
      node: config.node,
      auth: config.auth,
      ...(config.ssl && { ssl: config.ssl }),
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if index exists, create if not
      const indexExists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!indexExists.body) {
        await this.createIndex();
      }

      this.initialized = true;
      this.logger.info('OpenSearch service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenSearch service:', error);
      throw error;
    }
  }

  private async createIndex(): Promise<void> {
    const indexMapping = {
      mappings: {
        properties: {
          title: {
            type: 'text',
            analyzer: 'standard',
            fields: {
              keyword: { type: 'keyword' },
              suggest: { type: 'completion' },
            },
          },
          content: {
            type: 'text',
            analyzer: 'standard',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          url: { type: 'keyword' },
          source: { type: 'keyword' },
          authors: { type: 'keyword' },
          publicationDate: { type: 'date' },
          fileType: { type: 'keyword' },
          fileSize: { type: 'long' },
          metadata: { type: 'object' },
          createdAt: { type: 'date' },
        },
      },
      settings: {
        analysis: {
          analyzer: {
            content_analyzer: {
              type: 'standard',
              stopwords: '_english_',
            },
          },
        },
      },
    };

    await this.client.indices.create({
      index: this.indexName,
      body: indexMapping,
    });

    this.logger.info(`Created OpenSearch index: ${this.indexName}`);
  }

  async indexDocument(document: DocumentIndexData): Promise<void> {
    try {
      await this.client.index({
        index: this.indexName,
        id: document.id,
        body: {
          title: document.title,
          content: document.content,
          url: document.url,
          source: document.source,
          authors: document.authors,
          publicationDate: document.publicationDate,
          fileType: document.fileType,
          fileSize: document.fileSize,
          metadata: document.metadata,
          createdAt: document.createdAt,
        },
      });

      this.logger.debug(`Indexed document: ${document.id}`);
    } catch (error) {
      this.logger.error(`Failed to index document ${document.id}:`, error);
      throw error;
    }
  }

  async indexDocuments(documents: DocumentIndexData[]): Promise<void> {
    if (documents.length === 0) return;

    const operations = documents.flatMap(doc => [
      { index: { _index: this.indexName, _id: doc.id } },
      {
        title: doc.title,
        content: doc.content,
        url: doc.url,
        source: doc.source,
        authors: doc.authors,
        publicationDate: doc.publicationDate,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
      },
    ]);

    try {
      const response = await this.client.bulk({ body: operations });
      
      if (response.body.errors) {
        const errors = response.body.items
          .filter((item: any) => item.index?.error)
          .map((item: any) => item.index.error);
        
        this.logger.error('Bulk indexing errors:', errors);
        throw new Error(`Bulk indexing failed: ${errors.length} errors`);
      }

      this.logger.info(`Bulk indexed ${documents.length} documents`);
    } catch (error) {
      this.logger.error('Failed to bulk index documents:', error);
      throw error;
    }
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      const searchBody = this.buildSearchQuery(query);
      
      const response = await this.client.search({
        index: this.indexName,
        body: searchBody,
      });

      const hits = response.body.hits.hits;
      const totalResults = response.body.hits.total.value;
      const searchTime = Date.now() - startTime;

      const results: SearchResult[] = hits.map((hit: any) => ({
        id: hit._id,
        title: hit._source.title,
        content: hit._source.content,
        url: hit._source.url,
        source: hit._source.source,
        authors: hit._source.authors,
        publicationDate: hit._source.publicationDate,
        fileType: hit._source.fileType,
        fileSize: hit._source.fileSize,
        relevanceScore: hit._score,
        highlights: hit.highlight ? this.formatHighlights(hit.highlight) : [],
        metadata: hit._source.metadata,
      }));

      const facets = this.extractFacets(response.body.aggregations);

      return {
        results,
        totalResults,
        searchTime,
        ...(facets && { facets }),
      };
    } catch (error) {
      this.logger.error('Search failed:', error);
      throw error;
    }
  }

  private buildSearchQuery(query: SearchQuery): any {
    const must: any[] = [];
    const filter: any[] = [];
    const highlight: any = {};

    // Main query
    if (query.query.trim()) {
      must.push({
        multi_match: {
          query: query.query,
          fields: ['title^3', 'content^1', 'authors^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    } else {
      must.push({ match_all: {} });
    }

    // Filters
    if (query.filters?.sources?.length) {
      filter.push({ terms: { source: query.filters.sources } });
    }

    if (query.filters?.fileTypes?.length) {
      filter.push({ terms: { fileType: query.filters.fileTypes } });
    }

    if (query.filters?.authors?.length) {
      filter.push({ terms: { authors: query.filters.authors } });
    }

    if (query.filters?.dateRange) {
      const range: any = {};
      if (query.filters.dateRange.from) range.gte = query.filters.dateRange.from;
      if (query.filters.dateRange.to) range.lte = query.filters.dateRange.to;
      if (Object.keys(range).length > 0) {
        filter.push({ range: { publicationDate: range } });
      }
    }

    // Highlights
    if (query.includeHighlights) {
      highlight.fields = {
        title: {},
        content: { fragment_size: 150, number_of_fragments: 3 },
        authors: {},
      };
      highlight.pre_tags = ['<mark>'];
      highlight.post_tags = ['</mark>'];
    }

    // Aggregations for facets
    const aggs = {
      sources: { terms: { field: 'source', size: 50 } },
      fileTypes: { terms: { field: 'fileType', size: 20 } },
      authors: { terms: { field: 'authors', size: 100 } },
      years: {
        date_histogram: {
          field: 'publicationDate',
          calendar_interval: 'year',
          format: 'yyyy',
        },
      },
    };

    const searchBody: any = {
      query: {
        bool: {
          must,
          filter,
        },
      },
      aggs,
      highlight,
    };

    // Sorting
    if (query.sort) {
      searchBody.sort = [{ [query.sort.field]: { order: query.sort.order } }];
    } else {
      searchBody.sort = [{ _score: { order: 'desc' } }];
    }

    // Pagination
    if (query.pagination) {
      searchBody.from = (query.pagination.page - 1) * query.pagination.limit;
      searchBody.size = query.pagination.limit;
    } else {
      searchBody.size = 20;
    }

    return searchBody;
  }

  private formatHighlights(highlight: any): Array<{ field: string; fragments: string[] }> {
    const highlights: Array<{ field: string; fragments: string[] }> = [];
    
    for (const [field, fragments] of Object.entries(highlight)) {
      highlights.push({
        field,
        fragments: fragments as string[],
      });
    }

    return highlights;
  }

  private extractFacets(aggregations: any): SearchResponse['facets'] {
    if (!aggregations) return undefined;

    return {
      sources: aggregations.sources?.buckets?.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })) || [],
      fileTypes: aggregations.fileTypes?.buckets?.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })) || [],
      authors: aggregations.authors?.buckets?.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count,
      })) || [],
      years: aggregations.years?.buckets?.map((bucket: any) => ({
        value: bucket.key_as_string,
        count: bucket.doc_count,
      })) || [],
    };
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: documentId,
      });

      this.logger.debug(`Deleted document: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  async updateDocument(documentId: string, updates: Partial<DocumentIndexData>): Promise<void> {
    try {
      await this.client.update({
        index: this.indexName,
        id: documentId,
        body: {
          doc: updates,
        },
      });

      this.logger.debug(`Updated document: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to update document ${documentId}:`, error);
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<DocumentIndexData | null> {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: documentId,
      });

      return response.body._source as DocumentIndexData;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return null;
      }
      this.logger.error(`Failed to get document ${documentId}:`, error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      const response = await this.client.indices.stats({
        index: this.indexName,
      });

      return response.body;
    } catch (error) {
      this.logger.error('Failed to get index stats:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.cluster.health();
      return response.body.status !== 'red';
    } catch (error) {
      this.logger.error('OpenSearch health check failed:', error as Error);
      return false;
    }
  }
}

export const createOpenSearchService = (
  config: OpenSearchConfig,
  logger: winston.Logger
): OpenSearchService => {
  return new OpenSearchService(config, logger);
}; 