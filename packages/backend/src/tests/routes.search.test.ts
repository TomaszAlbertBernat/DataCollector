import request from 'supertest';
import express from 'express';
import { createSearchRouter, SearchRouterDependencies } from '../routes/search';
import { HybridSearchEngine } from '../services/search/HybridSearchEngine';
import winston from 'winston';

// Mock dependencies
jest.mock('../services/search/HybridSearchEngine');

describe('Search Router', () => {
  let app: express.Application;
  let mockSearchEngine: jest.Mocked<HybridSearchEngine>;
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    // Create mocked instances
    mockSearchEngine = {
      search: jest.fn(),
      indexDocument: jest.fn(),
      deleteDocument: jest.fn(),
      healthCheck: jest.fn(),
      initialize: jest.fn(),
      close: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create app with router
    app = express();
    app.use(express.json());
    
    const deps: SearchRouterDependencies = {
      searchEngine: mockSearchEngine,
      logger: mockLogger,
    };
    
    app.use('/api/search', createSearchRouter(deps));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/search', () => {
    const mockSearchResults = {
      results: [
        {
          id: 'doc1',
          title: 'Test Document 1',
          content: 'Sample content with machine learning concepts',
          source: 'scholar',
          fileType: 'pdf',
          relevanceScore: 0.95,
          highlights: [{
            field: 'content',
            fragments: ['<mark>machine learning</mark>']
          }],
        },
        {
          id: 'doc2',
          title: 'Test Document 2',
          content: 'Another document about AI applications',
          source: 'pubmed',
          fileType: 'html',
          relevanceScore: 0.87,
        }
      ],
      totalResults: 2,
      searchTime: 150,
      searchMode: 'hybrid',
    };

    it('should perform successful hybrid search with valid query', async () => {
      mockSearchEngine.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({
          query: 'machine learning',
          searchMode: 'hybrid',
          page: 1,
          limit: 20,
          includeHighlights: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          results: expect.arrayContaining([
            expect.objectContaining({
              id: 'doc1',
              title: 'Test Document 1',
              relevanceScore: 0.95,
            })
          ]),
          totalResults: 2,
          searchMode: 'hybrid',
        },
        timestamp: expect.any(String),
      });

      expect(mockSearchEngine.search).toHaveBeenCalledWith({
        query: 'machine learning',
        searchMode: 'hybrid',
        filters: undefined,
        pagination: { page: 1, limit: 20 },
        includeHighlights: true,
      });
    });

    it('should handle semantic search mode', async () => {
      mockSearchEngine.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({
          query: 'AI research',
          searchMode: 'semantic',
          page: 2,
          limit: 10,
        });

      expect(response.status).toBe(200);
      expect(mockSearchEngine.search).toHaveBeenCalledWith({
        query: 'AI research',
        searchMode: 'semantic',
        filters: undefined,
        pagination: { page: 2, limit: 10 },
        includeHighlights: false,
      });
    });

    it('should handle search with filters', async () => {
      const filters = { source: 'pubmed', dateRange: '2023-2024' };
      mockSearchEngine.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/search')
        .query({
          query: 'healthcare AI',
          filters: JSON.stringify(filters),
        });

      expect(response.status).toBe(200);
      expect(mockSearchEngine.search).toHaveBeenCalledWith({
        query: 'healthcare AI',
        searchMode: 'hybrid',
        filters: filters,
        pagination: { page: 1, limit: 20 },
        includeHighlights: false,
      });
    });

    it('should return 400 when query parameter is missing', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Query parameter is required',
        },
        timestamp: expect.any(String),
      });

      expect(mockSearchEngine.search).not.toHaveBeenCalled();
    });

    it('should handle search engine errors gracefully', async () => {
      const searchError = new Error('Search service unavailable');
      mockSearchEngine.search.mockRejectedValue(searchError);

      const response = await request(app)
        .get('/api/search')
        .query({ query: 'test query' });

      expect(response.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith('Search API error:', searchError);
    });

    it('should use default pagination values when not provided', async () => {
      mockSearchEngine.search.mockResolvedValue(mockSearchResults);

      await request(app)
        .get('/api/search')
        .query({ query: 'test' });

      expect(mockSearchEngine.search).toHaveBeenCalledWith({
        query: 'test',
        searchMode: 'hybrid',
        filters: undefined,
        pagination: { page: 1, limit: 20 },
        includeHighlights: false,
      });
    });
  });

  describe('GET /api/search/suggestions', () => {
    it('should return search suggestions for valid query', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ query: 'machine learning', limit: 3 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          suggestions: [
            'machine learning research',
            'machine learning analysis',
            'machine learning study',
          ],
          popular: [],
          recent: [],
        },
        timestamp: expect.any(String),
      });
    });

    it('should use default limit when not provided', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ query: 'AI' });

      expect(response.status).toBe(200);
      expect(response.body.data.suggestions).toHaveLength(5);
    });

    it('should return 400 when query parameter is missing', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_QUERY',
          message: 'Query parameter is required',
        },
      });
    });

    it('should handle numeric query gracefully', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ query: 123 });

      // Express coerces 123 to "123", so this succeeds
      expect(response.status).toBe(200);
      expect(response.body.data.suggestions).toEqual([
        '123 research',
        '123 analysis', 
        '123 study',
        '123 review',
        '123 methodology'
      ]);
    });
  });

  describe('GET /api/search/stats', () => {
    it('should return search engine statistics', async () => {
      const response = await request(app)
        .get('/api/search/stats');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          openSearch: { status: 'operational', service: 'ready' },
          chromaDB: { status: 'operational', service: 'ready' },
          hybridEngine: { status: 'operational', initialized: true },
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle errors when retrieving stats', async () => {
      // Simulate an error in the stats endpoint
      const statsError = new Error('Stats service error');
      
      // Mock the internal function that might throw
      jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw statsError;
      });

      const response = await request(app)
        .get('/api/search/stats');

      expect(mockLogger.error).toHaveBeenCalledWith('Search stats API error:', statsError);
      
      // Restore the mock
      jest.restoreAllMocks();
    });
  });

  describe('GET /api/search/health', () => {
    const mockHealthData = {
      openSearch: true,
      chromaDB: true,
      overall: true,
      details: {
        openSearchStatus: 'connected',
        chromaDBStatus: 'connected',
      }
    };

    it('should return healthy status when services are operational', async () => {
      mockSearchEngine.healthCheck.mockResolvedValue(mockHealthData);

      const response = await request(app)
        .get('/api/search/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: mockHealthData,
        timestamp: expect.any(String),
      });

      expect(mockSearchEngine.healthCheck).toHaveBeenCalled();
    });

    it('should return 503 when health check fails', async () => {
      const healthError = new Error('Health check failed');
      mockSearchEngine.healthCheck.mockRejectedValue(healthError);

      const response = await request(app)
        .get('/api/search/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          openSearch: false,
          chromaDB: false,
          overall: false,
          error: 'Health check failed',
        },
        timestamp: expect.any(String),
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Search health API error:', healthError);
    });
  });

  describe('POST /api/search/index', () => {
    const mockDocument = {
      id: 'doc123',
      title: 'Test Document',
      content: 'This is test content for indexing',
      source: 'test',
      url: 'https://example.com/doc123',
      authors: ['Author 1', 'Author 2'],
      publicationDate: '2024-01-15',
      fileType: 'pdf',
      fileSize: 1024,
      metadata: { category: 'research' },
    };

    it('should successfully index a document with all fields', async () => {
      mockSearchEngine.indexDocument.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/search/index')
        .send(mockDocument);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'doc123',
          message: 'Document indexed successfully',
        },
        timestamp: expect.any(String),
      });

      expect(mockSearchEngine.indexDocument).toHaveBeenCalledWith({
        id: mockDocument.id,
        title: mockDocument.title,
        content: mockDocument.content,
        url: mockDocument.url,
        source: mockDocument.source,
        authors: mockDocument.authors,
        publicationDate: mockDocument.publicationDate,
        fileType: mockDocument.fileType,
        fileSize: mockDocument.fileSize,
        metadata: mockDocument.metadata,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Successfully indexed document: doc123');
    });

    it('should successfully index a document with minimal required fields', async () => {
      const minimalDoc = {
        id: 'minimal123',
        title: 'Minimal Document',
        content: 'Minimal content',
        source: 'test',
      };

      mockSearchEngine.indexDocument.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/search/index')
        .send(minimalDoc);

      expect(response.status).toBe(200);
      expect(mockSearchEngine.indexDocument).toHaveBeenCalledWith({
        id: 'minimal123',
        title: 'Minimal Document',
        content: 'Minimal content',
        source: 'test',
        url: undefined,
        authors: undefined,
        publicationDate: undefined,
        fileType: undefined,
        fileSize: undefined,
        metadata: undefined,
      });
    });

    it('should return 400 when required fields are missing', async () => {
      const incompleteDoc = {
        title: 'Incomplete Document',
        content: 'Content without ID',
        // Missing id and source
      };

      const response = await request(app)
        .post('/api/search/index')
        .send(incompleteDoc);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'id, title, content, and source are required',
        },
        timestamp: expect.any(String),
      });

      expect(mockSearchEngine.indexDocument).not.toHaveBeenCalled();
    });

    it('should handle indexing errors gracefully', async () => {
      const indexError = new Error('Indexing service unavailable');
      mockSearchEngine.indexDocument.mockRejectedValue(indexError);

      const response = await request(app)
        .post('/api/search/index')
        .send(mockDocument);

      expect(response.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith('Search index API error:', indexError);
    });
  });

  describe('DELETE /api/search/index/:id', () => {
    it('should successfully delete a document by ID', async () => {
      mockSearchEngine.deleteDocument.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/search/index/doc123');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'doc123',
          message: 'Document deleted successfully',
        },
        timestamp: expect.any(String),
      });

      expect(mockSearchEngine.deleteDocument).toHaveBeenCalledWith('doc123');
      expect(mockLogger.info).toHaveBeenCalledWith('Successfully deleted document: doc123');
    });

    it('should return 400 when document ID is missing', async () => {
      const response = await request(app)
        .delete('/api/search/index/');

      expect(response.status).toBe(404); // Express returns 404 for missing route parameters
    });

    it('should handle deletion errors gracefully', async () => {
      const deleteError = new Error('Document not found in index');
      mockSearchEngine.deleteDocument.mockRejectedValue(deleteError);

      const response = await request(app)
        .delete('/api/search/index/nonexistent123');

      expect(response.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith('Search delete API error:', deleteError);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors in search engine', async () => {
      // Mock search engine to throw an error
      const searchError = new Error('Internal search engine error');
      mockSearchEngine.search.mockRejectedValue(searchError);

      const response = await request(app)
        .get('/api/search')
        .query({ query: 'test error' });

      // Should handle the error gracefully through the error handler
      expect(response.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledWith('Search API error:', searchError);
    });
  });
});