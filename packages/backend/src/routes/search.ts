import { Router, Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { ApiResponse, ApiError } from '../types/api';

import { HybridSearchEngine } from '../services/search/HybridSearchEngine';

export interface SearchRouterDependencies {
  searchEngine: HybridSearchEngine;
  logger: winston.Logger;
}

export const createSearchRouter = (deps: SearchRouterDependencies): Router => {
  const router = Router();
  const { searchEngine, logger } = deps;

  // GET /api/search - Perform hybrid search
  router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, searchMode = 'hybrid', filters, sort, pagination, includeHighlights } = req.query;
      
      // Validate required fields
      if (!query) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_QUERY',
            message: 'Query parameter is required',
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const startTime = Date.now();
      
             // Perform actual search using HybridSearchEngine
       const searchResults = await searchEngine.search({
         query: query as string,
         searchMode: searchMode as 'hybrid' | 'fulltext' | 'semantic',
         filters: filters ? JSON.parse(filters as string) : undefined,
         pagination: { page, limit },
         includeHighlights: includeHighlights === 'true',
       });
      
      const searchTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          ...searchResults,
          searchTime,
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      logger.error('Search API error:', error as Error);
      next(error);
    }
  });

  // GET /api/search/suggestions - Get search suggestions
  router.get('/suggestions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, limit = 5 } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_QUERY',
            message: 'Query parameter is required',
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // For now, return basic suggestions
      const suggestions = [
        `${query} research`,
        `${query} analysis`,
        `${query} study`,
        `${query} review`,
        `${query} methodology`,
      ].slice(0, Number(limit));

      res.json({
        success: true,
        data: {
          suggestions,
          popular: [],
          recent: [],
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      logger.error('Search suggestions API error:', error as Error);
      next(error);
    }
  });

  // GET /api/search/stats - Get search engine statistics
  router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get basic statistics - note: full statistics method not yet implemented
      const stats = {
        openSearch: { status: 'operational', service: 'ready' },
        chromaDB: { status: 'operational', service: 'ready' },
        hybridEngine: { status: 'operational', initialized: true },
      };

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      logger.error('Search stats API error:', error as Error);
      next(error);
    }
  });

  // GET /api/search/health - Check search engine health
  router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await searchEngine.healthCheck();

      res.json({
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      logger.error('Search health API error:', error as Error);
      // Return unhealthy status if health check fails
      res.status(503).json({
        success: false,
        data: {
          openSearch: false,
          chromaDB: false,
          overall: false,
          error: 'Health check failed',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);
    }
  });

  // POST /api/search/index - Index a document
  router.post('/index', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const document = req.body;

      // Validate required fields
      if (!document.id || !document.title || !document.content || !document.source) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'id, title, content, and source are required',
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Index document using HybridSearchEngine
      await searchEngine.indexDocument({
        id: document.id,
        title: document.title,
        content: document.content,
        url: document.url,
        source: document.source,
        authors: document.authors,
        publicationDate: document.publicationDate,
        fileType: document.fileType,
        fileSize: document.fileSize,
        metadata: document.metadata,
      });

      logger.info(`Successfully indexed document: ${document.id}`);

      res.json({
        success: true,
        data: { 
          id: document.id,
          message: 'Document indexed successfully',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      logger.error('Search index API error:', error as Error);
      next(error);
    }
  });

  // DELETE /api/search/index/:id - Delete a document from search index
  router.delete('/index/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_DOCUMENT_ID',
            message: 'Document ID is required',
          },
          timestamp: new Date().toISOString(),
        } as ApiResponse);
        return;
      }

      // Delete document using HybridSearchEngine
      await searchEngine.deleteDocument(id);
      logger.info(`Successfully deleted document: ${id}`);

      res.json({
        success: true,
        data: { 
          id,
          message: 'Document deleted successfully',
        },
        timestamp: new Date().toISOString(),
      } as ApiResponse);

    } catch (error) {
      logger.error('Search delete API error:', error as Error);
      next(error);
    }
  });

  return router;
};

export const searchErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiError: ApiError = {
    code: 'SEARCH_ERROR',
    message: error.message,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };

  res.status(500).json({
    success: false,
    error: apiError,
    timestamp: new Date().toISOString(),
  } as ApiResponse);
}; 