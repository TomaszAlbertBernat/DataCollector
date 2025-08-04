import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createUploadRouter } from '../routes/upload';
import winston from 'winston';

// Mock dependencies
jest.mock('fs');
jest.mock('path');

describe('Upload Router', () => {
  let app: express.Application;
  let mockLogger: jest.Mocked<winston.Logger>;
  let mockJobQueue: jest.Mocked<any>;
  let mockStateManager: jest.Mocked<any>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    // Create mocked instances
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockJobQueue = {
      submitJob: jest.fn().mockResolvedValue({
        jobId: 'job123',
        queuePosition: 1,
        estimatedStartTime: new Date(Date.now() + 60000), // 1 minute from now
      }),
    } as any;

    mockStateManager = {
      createJob: jest.fn().mockResolvedValue({
        id: 'job123',
        createdAt: new Date().toISOString(),
      }),
    } as any;

    // Mock fs functions
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.mkdirSync = jest.fn();
    mockFs.unlinkSync = jest.fn();
    // mockFs.statSync = jest.fn().mockReturnValue({
    //   size: 1024,
    //   isFile: () => true,
    // } as any);

    // Create app with router
    app = express();
    app.use(express.json());
    
    const deps = {
      jobQueue: mockJobQueue,
      stateManager: mockStateManager,
      logger: mockLogger,
    };
    
    app.use('/api/upload', createUploadRouter(deps));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/upload/single', () => {
    it('should successfully upload a text file', async () => {
      const testFileContent = 'This is a test document content for upload testing.';
      
      const response = await request(app)
        .post('/api/upload/single')
        .attach('file', Buffer.from(testFileContent), {
          filename: 'test-document.txt',
          contentType: 'text/plain'
        })
        .field('description', 'A test document for upload testing');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          jobId: 'job123',
          status: 'pending',
          fileName: 'test-document.txt',
          fileSize: expect.any(Number),
          estimatedDuration: expect.any(Number),
          queuePosition: 1,
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle PDF file uploads', async () => {
      const testPdfContent = Buffer.from('PDF content simulation');
      
      const response = await request(app)
        .post('/api/upload/single')
        .attach('file', testPdfContent, {
          filename: 'research-paper.pdf',
          contentType: 'application/pdf'
        })
        .field('title', 'Research Paper')
        .field('description', 'Academic research paper');

      expect(response.status).toBe(200);
      expect(response.body.data.fileName).toBe('research-paper.pdf');
    });

    it('should handle multiple file uploads on different endpoint', async () => {
      const testContent1 = 'First document content';
      const testContent2 = 'Second document content';
      
      const response = await request(app)
        .post('/api/upload/multiple')
        .attach('files', Buffer.from(testContent1), {
          filename: 'doc1.txt',
          contentType: 'text/plain'
        })
        .attach('files', Buffer.from(testContent2), {
          filename: 'doc2.txt',
          contentType: 'text/plain'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.fileCount).toBe(2);
      expect(response.body.data.files[0].originalName).toBe('doc1.txt');
      expect(response.body.data.files[1].originalName).toBe('doc2.txt');
    });

    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/upload/single');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'No file uploaded',
        timestamp: expect.any(String),
      });
    });

    it('should return 400 for invalid file types', async () => {
      const testContent = 'Executable content';
      
      const response = await request(app)
        .post('/api/upload/single')
        .attach('file', Buffer.from(testContent), {
          filename: 'malicious.exe',
          contentType: 'application/x-msdownload'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Unsupported file type'),
      });
    });

    it('should return 413 for files that are too large', async () => {
      // Create a large buffer to simulate oversized file
      const largeContent = Buffer.alloc(50 * 1024 * 1024); // 50MB
      
      const response = await request(app)
        .post('/api/upload/single')
        .attach('file', largeContent, {
          filename: 'large-file.txt',
          contentType: 'text/plain'
        });

      expect(response.status).toBe(413);
    });

    it('should validate required fields', async () => {
      const testContent = 'Test content';
      
      const response = await request(app)
        .post('/api/upload/single')
        .attach('file', Buffer.from(testContent), {
          filename: 'test.txt',
          contentType: 'text/plain'
        });
        // Missing other optional fields but should work

      expect(response.status).toBe(200); // Should succeed with minimal fields
    });

    it('should handle file system errors gracefully', async () => {
      // Mock fs.writeFile to throw an error
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const testContent = 'Test content';
      
      const response = await request(app)
        .post('/api/upload/single')
        .attach('file', Buffer.from(testContent), {
          filename: 'test.txt',
          contentType: 'text/plain'
        })
        .field('title', 'Test Document');

      expect(response.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('POST /api/upload/multiple', () => {
    it('should handle multiple file uploads successfully', async () => {
      const testContent1 = 'First document content';
      const testContent2 = 'Second document content';
      
      const response = await request(app)
        .post('/api/upload/multiple')
        .attach('files', Buffer.from(testContent1), {
          filename: 'doc1.txt',
          contentType: 'text/plain'
        })
        .attach('files', Buffer.from(testContent2), {
          filename: 'doc2.txt',
          contentType: 'text/plain'
        })
        .field('description', 'Multiple test documents');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          jobId: 'job123',
          status: 'pending',
          fileCount: 2,
          totalSize: expect.any(Number),
          files: [
            { originalName: 'doc1.txt', fileSize: expect.any(Number) },
            { originalName: 'doc2.txt', fileSize: expect.any(Number) }
          ],
          estimatedDuration: expect.any(Number),
          queuePosition: 1,
        },
        timestamp: expect.any(String),
      });
    });

    it('should return 400 when no files are uploaded', async () => {
      const response = await request(app)
        .post('/api/upload/multiple');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'No files uploaded',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle multer errors gracefully', async () => {
      // Test with invalid content type
      const response = await request(app)
        .post('/api/upload/single')
        .send('invalid data');

      expect(response.status).toBe(400);
    });

    it('should log upload operations appropriately', async () => {
      const testContent = 'Test content';
      
      await request(app)
        .post('/api/upload/single')
        .attach('file', Buffer.from(testContent), {
          filename: 'test.txt',
          contentType: 'text/plain'
        });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating upload processing job',
        expect.objectContaining({
          jobId: expect.any(String),
          fileName: 'test.txt',
          fileSize: expect.any(Number),
        })
      );
    });

    it('should handle job creation errors gracefully', async () => {
      mockStateManager.createJob.mockRejectedValue(new Error('Database error'));

      const testContent = 'Test content';
      const response = await request(app)
        .post('/api/upload/single')
        .attach('file', Buffer.from(testContent), {
          filename: 'test.txt',
          contentType: 'text/plain'
        });

      expect(response.status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Content Type Validation', () => {
    it('should accept valid document file types', async () => {
      const validTypes = [
        { filename: 'test.txt', contentType: 'text/plain' },
        { filename: 'test.pdf', contentType: 'application/pdf' },
        { filename: 'test.doc', contentType: 'application/msword' },
        { filename: 'test.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      ];

      for (const fileType of validTypes) {
        const response = await request(app)
          .post('/api/upload/single')
          .attach('file', Buffer.from('test content'), fileType);

        expect(response.status).toBe(200);
      }
    });

    it('should reject invalid file types', async () => {
      const invalidTypes = [
        { filename: 'test.exe', contentType: 'application/x-msdownload' },
        { filename: 'test.bat', contentType: 'application/x-bat' },
        { filename: 'test.sh', contentType: 'application/x-sh' },
      ];

      for (const fileType of invalidTypes) {
        const response = await request(app)
          .post('/api/upload/single')
          .attach('file', Buffer.from('test content'), fileType);

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/Unsupported file type/);
      }
    });
  });
});