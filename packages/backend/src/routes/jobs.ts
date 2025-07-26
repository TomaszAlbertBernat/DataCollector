import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

import { JobQueue } from '../services/queue/JobQueue';
import { JobStateManager } from '../services/queue/JobStateManager';
import { JobProcessor } from '../services/queue/JobProcessor';
import { JobType, JobStatus, JobPriority, JobData, CollectionOptions } from '../types/job';
import { 
  CreateCollectionRequest, 
  CreateJobResponse, 
  JobStatusResponse, 
  ListJobsRequest,
  CancelJobRequest,
  ApiResponse 
} from '../types/api';

export interface JobRouterDependencies {
  jobQueue: JobQueue;
  stateManager: JobStateManager;
  processor: JobProcessor;
  logger: winston.Logger;
}

/**
 * Create job management router
 */
export const createJobRouter = (deps: JobRouterDependencies): Router => {
  const router = Router();
  const { jobQueue, stateManager, processor, logger } = deps;

  // Job classes are registered during app initialization

  /**
   * Create a new collection job
   */
  router.post('/collection',
    [
      body('query')
        .notEmpty()
        .withMessage('Query is required')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Query must be between 1 and 1000 characters'),
      
      body('sources')
        .optional()
        .isArray()
        .withMessage('Sources must be an array'),
      
      body('options.maxResults')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('maxResults must be between 1 and 500'),
      
      body('options.priority')
        .optional()
        .isIn([JobPriority.LOW, JobPriority.NORMAL, JobPriority.HIGH, JobPriority.URGENT])
        .withMessage('Invalid priority value'),
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: errors.array()
            },
            timestamp: new Date().toISOString()
          });
        }

        const request = req.body as CreateCollectionRequest;
        const jobId = uuidv4();

        logger.info('Creating collection job', {
          jobId,
          query: request.query.substring(0, 100),
          userId: req.headers['x-user-id']
        });

        // Create job in database
        const createJobData: any = {
          id: jobId,
          type: JobType.COLLECTION,
          query: request.query,
          userId: req.headers['x-user-id'] as string || 'anonymous',
          metadata: {
            sources: request.sources,
            ...(request.options && { options: request.options })
          }
        };

        const job = await stateManager.createJob(createJobData);

        // Convert API request options to job metadata format
        const jobOptions: CollectionOptions | undefined = request.options ? {
          ...(request.options.maxResults !== undefined && { maxResults: request.options.maxResults }),
          ...(request.options.fileTypes !== undefined && { fileTypes: request.options.fileTypes }),
          ...(request.options.dateRange && {
            dateRange: {
              ...(request.options.dateRange.from && { from: new Date(request.options.dateRange.from) }),
              ...(request.options.dateRange.to && { to: new Date(request.options.dateRange.to) })
            }
          }),
          ...(request.options.language !== undefined && { language: request.options.language }),
          ...(request.options.priority !== undefined && { priority: request.options.priority as JobPriority })
        } : undefined;

        // Create job data for queue
        const jobData: JobData = {
          id: jobId,
          type: JobType.COLLECTION,
          status: JobStatus.PENDING,
          query: request.query,
          progress: 0,
          userId: req.headers['x-user-id'] as string || 'anonymous',
          metadata: {
            ...(request.sources && { sources: request.sources }),
            ...(jobOptions && { options: jobOptions })
          },
          createdAt: job.createdAt
        };

        // Submit to queue
        const submission = await jobQueue.submitJob(jobData);

        const response: CreateJobResponse = {
          jobId: submission.jobId,
          status: JobStatus.PENDING,
          ...(submission.estimatedStartTime && { 
            estimatedDuration: Math.round((submission.estimatedStartTime.getTime() - Date.now()) / 1000) 
          }),
          ...(submission.queuePosition && { queuePosition: submission.queuePosition })
        };

        logger.info('Collection job created successfully', {
          jobId,
          queuePosition: submission.queuePosition
        });

        return res.status(201).json({
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Failed to create collection job', {
          error: (error as Error).message,
          query: req.body.query?.substring(0, 100)
        });
        return next(error);
      }
    }
  );

  /**
   * Get job status by ID
   */
  router.get('/:jobId',
    [
      param('jobId')
        .isUUID()
        .withMessage('Invalid job ID format')
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid job ID',
              details: errors.array()
            },
            timestamp: new Date().toISOString()
          });
        }

        const jobId = req.params.jobId;
        if (!jobId) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_JOB_ID',
              message: 'Job ID is required'
            },
            timestamp: new Date().toISOString()
          });
        }
        const job = await stateManager.getJobById(jobId);

        if (!job) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'JOB_NOT_FOUND',
              message: `Job with ID ${jobId} not found`
            },
            timestamp: new Date().toISOString()
          });
        }

        const response: JobStatusResponse = {
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress,
          query: job.query,
          createdAt: job.createdAt.toISOString(),
          ...(job.userId && { userId: job.userId }),
          ...(job.startedAt && { startedAt: job.startedAt.toISOString() }),
          ...(job.completedAt && { completedAt: job.completedAt.toISOString() }),
          ...(job.getDuration() && { 
            estimatedTimeRemaining: job.isCompleted() ? 0 : Math.max(0, 300 - Math.round(job.getDuration()! / 1000))
          }),
          ...(Object.keys(job.results).length > 0 && { results: job.results })
        };

        return res.json({
          success: true,
          data: response,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Failed to get job status', {
          jobId: req.params.jobId,
          error: (error as Error).message
        });
        return next(error);
      }
    }
  );

  /**
   * List jobs with filtering and pagination
   */
  router.get('/',
    [
      query('status')
        .optional()
        .custom((value) => {
          if (Array.isArray(value)) {
            return value.every(status => Object.values(JobStatus).includes(status));
          }
          return Object.values(JobStatus).includes(value);
        })
        .withMessage('Invalid status value'),
      
      query('type')
        .optional()
        .isIn(Object.values(JobType))
        .withMessage('Invalid job type'),
      
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: errors.array()
            },
            timestamp: new Date().toISOString()
          });
        }

        const userId = req.headers['x-user-id'] as string || 'anonymous';
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const { jobs, total } = await stateManager.getJobsByUserId(userId, limit, offset);

        const jobResponses: JobStatusResponse[] = jobs.map(job => ({
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress,
          query: job.query,
          createdAt: job.createdAt.toISOString(),
          ...(job.userId && { userId: job.userId }),
          ...(job.startedAt && { startedAt: job.startedAt.toISOString() }),
          ...(job.completedAt && { completedAt: job.completedAt.toISOString() }),
          ...(Object.keys(job.results).length > 0 && { results: job.results })
        }));

        res.json({
          success: true,
          data: jobResponses,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Failed to list jobs', {
          userId: req.headers['x-user-id'],
          error: (error as Error).message
        });
        return next(error);
      }
    }
  );

  /**
   * Cancel a job
   */
  router.delete('/:jobId',
    [
      param('jobId')
        .isUUID()
        .withMessage('Invalid job ID format'),
      
      body('reason')
        .optional()
        .isString()
        .isLength({ max: 200 })
        .withMessage('Reason must be a string with max 200 characters')
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: errors.array()
            },
            timestamp: new Date().toISOString()
          });
        }

        const jobId = req.params.jobId;
        if (!jobId) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_JOB_ID',
              message: 'Job ID is required'
            },
            timestamp: new Date().toISOString()
          });
        }

        const { reason } = req.body as CancelJobRequest;

        // Get job to check if it exists and is cancellable
        const job = await stateManager.getJobById(jobId);
        if (!job) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'JOB_NOT_FOUND',
              message: `Job with ID ${jobId} not found`
            },
            timestamp: new Date().toISOString()
          });
        }

        if (!job.isCancellable()) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'JOB_NOT_CANCELLABLE',
              message: `Job with status ${job.status} cannot be cancelled`
            },
            timestamp: new Date().toISOString()
          });
        }

        // Cancel in queue
        const cancelled = await jobQueue.cancelJob(jobId, job.type);
        
        // Update status in database
        if (cancelled) {
          await stateManager.updateJobStatus(jobId, JobStatus.CANCELLED, {
            message: reason || 'Job cancelled by user'
          });
        }

        logger.info('Job cancelled', {
          jobId,
          reason,
          cancelledFromQueue: cancelled
        });

        res.json({
          success: true,
          data: {
            message: 'Job cancelled successfully'
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Failed to cancel job', {
          jobId: req.params.jobId,
          error: (error as Error).message
        });
        return next(error);
      }
    }
  );

  /**
   * Get queue statistics
   */
  router.get('/stats/queues', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queueStats = await jobQueue.getQueueStats();
      const processorStats = processor.getStats();
      const dbStats = await stateManager.getJobStatistics();

      res.json({
        success: true,
        data: {
          queues: queueStats,
          processor: processorStats,
          database: dbStats
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get job statistics', {
        error: (error as Error).message
      });
      return next(error);
    }
  });

  /**
   * Get processor health information
   */
  router.get('/health/processor', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const healthInfo = await processor.getHealthInfo();

      res.json({
        success: true,
        data: healthInfo,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get processor health', {
        error: (error as Error).message
      });
      return next(error);
    }
  });

  return router;
};

/**
 * Error handling middleware for job routes
 */
export const jobErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logger = req.app.locals.logger as winston.Logger;

  logger.error('Job route error', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred while processing the job request',
      ...(isDevelopment && { details: error.message, stack: error.stack })
    },
    timestamp: new Date().toISOString()
  });
}; 