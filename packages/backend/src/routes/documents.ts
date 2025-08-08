import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';
import winston from 'winston';
import mime from 'mime-types';
import { ApiResponse, DocumentResponse } from '../types/api';
import { FileProcessor } from '../services/processing/FileProcessor';

export interface DocumentRouterDependencies {
  logger: winston.Logger;
}

export const createDocumentRouter = (deps: DocumentRouterDependencies): Router => {
  const router = Router();
  const { logger } = deps;

  const uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
  const testDownloadsDir = path.resolve(process.cwd(), 'packages/backend/test-downloads');

  const findDocumentFile = (documentId: string): { filePath: string; fileName: string } | null => {
    // Try exact file in uploads
    const tryPaths: string[] = [];

    // If the id looks like a file name with extension, try directly
    if (path.extname(documentId)) {
      tryPaths.push(path.resolve(uploadDir, documentId));
      tryPaths.push(path.resolve(testDownloadsDir, documentId));
    }

    // Try common extensions
    const candidateNames = [
      `${documentId}.pdf`,
      `${documentId}.txt`,
      `${documentId}.docx`,
      `${documentId}.csv`,
      `${documentId}.json`,
      `${documentId}.html`,
    ];
    for (const name of candidateNames) {
      tryPaths.push(path.resolve(uploadDir, name));
      tryPaths.push(path.resolve(testDownloadsDir, name));
    }

    for (const p of tryPaths) {
      try {
        const stat = fs.statSync(p);
        if (stat.isFile()) {
          return { filePath: p, fileName: path.basename(p) };
        }
      } catch {
        // ignore ENOENT
      }
    }

    return null;
  };

  // GET /api/documents/:id - Get document metadata and content
  router.get('/:id',
    [
      param('id')
        .notEmpty()
        .withMessage('Document ID is required')
    ],
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: errors.array()
            },
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        const documentId = req.params.id as string;

        // Demo IDs still return mock content for compatibility
        if (documentId.startsWith('demo-')) {
          const mockDocument: DocumentResponse = {
            id: documentId,
            title: `Document ${documentId}`,
            filePath: `/uploads/${documentId}.txt`,
            fileType: 'txt',
            fileSize: 45680,
            source: 'Demo Source',
            authors: ['Demo Author'],
            publicationDate: '2024-01-15',
            abstract: 'Demo document abstract. Real documents are served from the filesystem when available.',
            keywords: ['demo', 'document', 'test'],
            language: 'en',
            createdAt: new Date().toISOString(),
            metadata: { category: 'demo', type: 'document', processed: true }
          };
          res.json({ success: true, data: mockDocument, timestamp: new Date().toISOString() } as ApiResponse);
          return;
        }

        const found = findDocumentFile(documentId);
        if (!found) {
          res.status(404).json({
            success: false,
            error: { code: 'DOCUMENT_NOT_FOUND', message: `Document ${documentId} not found` },
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        const fileStat = fs.statSync(found.filePath);
        const ext = path.extname(found.filePath).replace('.', '').toLowerCase();
        const doc: DocumentResponse = {
          id: documentId,
          title: path.basename(found.filePath, path.extname(found.filePath)),
          filePath: found.filePath,
          fileType: ext,
          fileSize: fileStat.size,
          source: 'local',
          authors: [],
          language: 'en',
          createdAt: new Date(fileStat.ctime).toISOString(),
          metadata: {
            directory: path.dirname(found.filePath),
            fileName: found.fileName,
          }
        };

        logger.info('Document metadata retrieved', { documentId, filePath: found.filePath });

        res.json({ success: true, data: doc, timestamp: new Date().toISOString() } as ApiResponse);

      } catch (error) {
        logger.error('Document API error:', error as Error);
        next(error);
      }
    }
  );

  // GET /api/documents/:id/download - Download document file
  router.get('/:id/download',
    [
      param('id')
        .notEmpty()
        .withMessage('Document ID is required'),
      
      query('format')
        .optional()
        .isIn(['original', 'pdf', 'txt'])
        .withMessage('Invalid format parameter')
    ],
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request parameters',
              details: errors.array()
            },
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        const documentId = req.params.id as string;
        const format = (req.query.format as string) || 'original';

        if (documentId.startsWith('demo-')) {
          const mockContent = `Demo document with ID: ${documentId}\nGenerated: ${new Date().toISOString()}`;
          const fileName = `${documentId}.${format === 'pdf' ? 'pdf' : 'txt'}`;
          res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'text/plain');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.setHeader('Content-Length', Buffer.byteLength(mockContent, 'utf8'));
          res.send(mockContent);
          return;
        }

        const found = findDocumentFile(documentId);
        if (!found) {
          res.status(404).json({
            success: false,
            error: { code: 'DOCUMENT_NOT_FOUND', message: `Document ${documentId} not found` },
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        // Serve original file
        const ext = path.extname(found.filePath).toLowerCase();
        const mimeType = mime.lookup(ext) || 'application/octet-stream';
        const fileName = path.basename(found.filePath);
        res.setHeader('Content-Type', String(mimeType));
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        const stream = fs.createReadStream(found.filePath);
        stream.pipe(res);

      } catch (error) {
        logger.error('Document download API error:', error as Error);
        next(error);
      }
    }
  );

  // GET /api/documents/:id/content - Get document content for preview
  router.get('/:id/content',
    [
      param('id')
        .notEmpty()
        .withMessage('Document ID is required')
    ],
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid document ID',
              details: errors.array()
            },
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        const documentId = req.params.id as string;

        if (documentId.startsWith('demo-')) {
          const mockContent = {
            id: documentId,
            content: `This is the full content of demo document ${documentId}.`,
            highlights: [],
            metadata: {
              wordCount: 10,
              readingTime: '1 second',
              processedAt: new Date().toISOString()
            }
          };
          res.json({ success: true, data: mockContent, timestamp: new Date().toISOString() } as ApiResponse);
          return;
        }

        const found = findDocumentFile(documentId);
        if (!found) {
          res.status(404).json({
            success: false,
            error: { code: 'DOCUMENT_NOT_FOUND', message: `Document ${documentId} not found` },
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        // Use FileProcessor to extract text content
        const processor = new FileProcessor();
        const result = await processor.processFile(found.filePath);
        if (!result.success) {
          res.status(500).json({
            success: false,
            error: { code: 'PROCESSING_ERROR', message: result.error || 'Failed to process file' },
            timestamp: new Date().toISOString(),
          } as ApiResponse);
          return;
        }

        const contentResponse = {
          id: documentId,
          content: result.text || '',
          highlights: [],
          metadata: {
            ...(result.metadata || {}),
            chunkCount: result.chunks?.length || 0,
            processedAt: new Date().toISOString(),
          }
        };

        logger.info('Document content retrieved', { documentId, filePath: found.filePath });

        res.json({ success: true, data: contentResponse, timestamp: new Date().toISOString() } as ApiResponse);

      } catch (error) {
        logger.error('Document content API error:', error as Error);
        next(error);
      }
    }
  );

  return router;
};

export const documentErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiError = {
    code: 'DOCUMENT_ERROR',
    message: error.message,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };

  res.status(500).json({
    success: false,
    error: apiError,
    timestamp: new Date().toISOString(),
  } as ApiResponse);
}; 