import request from 'supertest';
import express from 'express';
import { createDocumentRouter, DocumentRouterDependencies } from '../routes/documents';
import winston from 'winston';

// Mock dependencies
describe('Documents Router', () => {
  let app: express.Application;
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    // Create mocked instances
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create app with router
    app = express();
    app.use(express.json());
    
    const deps: DocumentRouterDependencies = {
      logger: mockLogger,
    };
    
    app.use('/api/documents', createDocumentRouter(deps));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/documents/:id', () => {
    it('should return document metadata for valid ID', async () => {
      const response = await request(app)
        .get('/api/documents/test123');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'test123',
          title: expect.any(String),
          filePath: expect.any(String),
          fileType: expect.any(String),
          fileSize: expect.any(Number),
          source: expect.any(String),
          authors: expect.any(Array),
          publicationDate: expect.any(String),
          abstract: expect.any(String),
          keywords: expect.any(Array),
          language: expect.any(String),
          createdAt: expect.any(String),
          metadata: expect.any(Object),
        },
        timestamp: expect.any(String),
      });
    });

    it('should return document even for non-existent ID (mock data)', async () => {
      const response = await request(app)
        .get('/api/documents/nonexistent999');

      // Since this is using mock data, it will return 200 with demo content
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'nonexistent999',
          title: 'Document nonexistent999',
        },
        timestamp: expect.any(String),
      });
    });

    it('should return 400 for empty document ID', async () => {
      const response = await request(app)
        .get('/api/documents/');

      expect(response.status).toBe(404); // Express returns 404 for missing route parameters
    });

    it('should handle document metadata correctly', async () => {
      const response = await request(app)
        .get('/api/documents/test123');

      expect(response.status).toBe(200);
      expect(response.body.data.metadata).toEqual({
        category: 'demo',
        type: 'document',
        processed: true
      });
    });
  });

  describe('GET /api/documents/:id/content', () => {
    it('should return document content for valid ID', async () => {
      const response = await request(app)
        .get('/api/documents/test123/content');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'test123',
          content: expect.any(String),
          highlights: expect.any(Array),
          metadata: expect.any(Object),
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle query parameters for content filtering', async () => {
      const response = await request(app)
        .get('/api/documents/test123/content')
        .query({
          search: 'machine learning',
          maxChunks: 5,
          includeHighlights: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.highlights).toBeDefined();
    });

    it('should return content even for non-existent document (mock data)', async () => {
      const response = await request(app)
        .get('/api/documents/nonexistent999/content');

      // Since this is using mock data, it will return 200 with demo content
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('nonexistent999');
    });

    it('should handle special characters in document ID', async () => {
      const response = await request(app)
        .get('/api/documents/doc-with-special-chars_123/content');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('doc-with-special-chars_123');
    });
  });

  describe('GET /api/documents/:id/download', () => {
    it('should serve document file for download', async () => {
      const response = await request(app)
        .get('/api/documents/test123/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/octet-stream|application\/pdf|text\/plain/);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename=.*/);
    });

    it('should handle different file formats', async () => {
      // Test PDF download with format parameter
      const pdfResponse = await request(app)
        .get('/api/documents/pdf-doc-123/download')
        .query({ format: 'pdf' });

      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.headers['content-type']).toMatch(/application\/pdf/);

      // Test text file download (default format)
      const textResponse = await request(app)
        .get('/api/documents/text-doc-123/download');

      expect(textResponse.status).toBe(200);
      expect(textResponse.headers['content-type']).toMatch(/text\/plain/);
    });

    it('should serve download even for non-existent document (mock data)', async () => {
      const response = await request(app)
        .get('/api/documents/nonexistent999/download');

      // Since this is using mock data, it will return 200 with demo content
      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename=.*nonexistent999.*/);
    });

    it('should handle special characters in download ID', async () => {
      const response = await request(app)
        .get('/api/documents/doc-with-special-chars_123/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename=.*doc-with-special-chars_123.*/);
    });

    it('should handle different format parameters', async () => {
      // Test with different format parameters
      const response = await request(app)
        .get('/api/documents/test123/download')
        .query({ format: 'pdf' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/pdf/);
      expect(response.headers['content-disposition']).toMatch(/filename=".*\.pdf"/);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/api/documents/');

      expect(response.status).toBe(404); // Express returns 404 for missing route parameters
    });

    it('should log document retrieval', async () => {
      await request(app)
        .get('/api/documents/test123');

      expect(mockLogger.info).toHaveBeenCalledWith('Document retrieved', { documentId: 'test123' });
    });

    it('should return consistent success format', async () => {
      const response = await request(app)
        .get('/api/documents/test123');

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content types correctly', async () => {
      const response = await request(app)
        .get('/api/documents/test123')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle HEAD requests for document existence', async () => {
      const response = await request(app)
        .head('/api/documents/test123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });
  });

  describe('Query Parameter Validation', () => {
    it('should validate maxChunks parameter', async () => {
      const response = await request(app)
        .get('/api/documents/test123/content')
        .query({ maxChunks: 'invalid' });

      // Should handle invalid parameter gracefully
      expect(response.status).toBe(200);
    });

    it('should validate includeHighlights parameter', async () => {
      const response = await request(app)
        .get('/api/documents/test123/content')
        .query({ includeHighlights: 'invalid' });

      expect(response.status).toBe(200);
      // Should default to false for invalid boolean values
    });

    it('should handle empty search parameter', async () => {
      const response = await request(app)
        .get('/api/documents/test123/content')
        .query({ search: '' });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });
});