import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';
import winston from 'winston';
import { ApiResponse, DocumentResponse } from '../types/api';

export interface DocumentRouterDependencies {
  logger: winston.Logger;
}

export const createDocumentRouter = (deps: DocumentRouterDependencies): Router => {
  const router = Router();
  const { logger } = deps;

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

        const documentId = req.params.id;
        
        // For now, return mock data for demo purposes
        // In a real implementation, this would query the database
        const mockDocument: DocumentResponse = {
          id: documentId || 'demo-document',
          title: `Document ${documentId}`,
          filePath: `/uploads/demo-${documentId}.txt`,
          fileType: 'txt',
          fileSize: 45680,
          source: 'Demo Source',
          authors: ['Demo Author'],
          publicationDate: '2024-01-15',
          abstract: 'This is a demo document abstract. The full content would be retrieved from the database or file system.',
          keywords: ['demo', 'document', 'test'],
          language: 'en',
          createdAt: new Date().toISOString(),
          metadata: {
            category: 'demo',
            type: 'document',
            processed: true
          }
        };

        logger.info('Document retrieved', { documentId });

        res.json({
          success: true,
          data: mockDocument,
          timestamp: new Date().toISOString(),
        } as ApiResponse);

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

        const documentId = req.params.id;
        const format = req.query.format as string || 'original';

        // For demo purposes, create a mock file
        const mockContent = `This is a demo document with ID: ${documentId}
        
Content would be retrieved from the actual file system or database.
This is just a placeholder for demonstration purposes.

Document metadata:
- ID: ${documentId}
- Format: ${format}
- Generated: ${new Date().toISOString()}

In a real implementation, this would serve the actual document file.`;

        const fileName = `demo-${documentId}.${format === 'pdf' ? 'pdf' : 'txt'}`;
        
        res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', Buffer.byteLength(mockContent, 'utf8'));
        
        res.send(mockContent);

        logger.info('Document downloaded', { documentId, format });

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

        const documentId = req.params.id;
        
        // Mock content for demo
        const mockContent = {
          id: documentId,
          content: `This is the full content of document ${documentId}.

This document contains information about mental health and wellness practices.
The content would be retrieved from the actual document processing pipeline.

Key topics covered:
- Meditation techniques
- Stress management
- Cognitive behavioral therapy
- Mindfulness practices
- Digital wellness

This is a placeholder for the actual processed document content.`,
          highlights: [
            {
              field: 'content',
              fragments: [
                'This document contains information about <mark>mental health</mark>',
                'Key topics covered: <mark>Meditation</mark> techniques'
              ]
            }
          ],
          metadata: {
            wordCount: 150,
            readingTime: '2 minutes',
            processedAt: new Date().toISOString()
          }
        };

        logger.info('Document content retrieved', { documentId });

        res.json({
          success: true,
          data: mockContent,
          timestamp: new Date().toISOString(),
        } as ApiResponse);

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