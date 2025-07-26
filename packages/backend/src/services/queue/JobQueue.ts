import Bull, { Queue, Job as BullJob, JobOptions, QueueOptions } from 'bull';
import { RedisClientType } from 'redis';
import winston from 'winston';

import { JobData, JobStatus, JobType, JobPriority } from '../../types/job';
import { Job } from '../../models/Job';

export interface JobQueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions: JobOptions;
  concurrency: {
    collection: number;
    processing: number;
    indexing: number;
    default: number;
  };
  retrySettings: {
    maxAttempts: number;
    backoffDelay: number;
  };
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobSubmissionResult {
  jobId: string;
  queuePosition?: number;
  estimatedStartTime?: Date;
}

export class JobQueue {
  private queues: Map<JobType, Queue> = new Map();
  private config: JobQueueConfig;
  private logger: winston.Logger;
  private redisClient: RedisClientType;
  private initialized = false;

  constructor(config: JobQueueConfig, redisClient: RedisClientType, logger: winston.Logger) {
    this.config = config;
    this.redisClient = redisClient;
    this.logger = logger;
  }

  /**
   * Initialize all job queues
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('JobQueue already initialized');
      return;
    }

    try {
      this.logger.info('Initializing job queues');

      const queueOptions: QueueOptions = {
        redis: this.config.redis,
        defaultJobOptions: this.config.defaultJobOptions
      };

      // Create queues for each job type
      for (const jobType of Object.values(JobType)) {
        const queueName = `${jobType}-queue`;
        const queue = new Bull(queueName, queueOptions);

        // Set up queue event handlers
        this.setupQueueEventHandlers(queue, jobType);

        // Configure concurrency for this queue
        const concurrency = this.getConcurrencyForJobType(jobType);
        
        this.queues.set(jobType, queue);
        this.logger.info(`Queue initialized: ${queueName} (concurrency: ${concurrency})`);
      }

      this.initialized = true;
      this.logger.info('All job queues initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize job queues', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Submit a job to the appropriate queue
   */
  async submitJob(jobData: JobData, options?: Partial<JobOptions>): Promise<JobSubmissionResult> {
    if (!this.initialized) {
      throw new Error('JobQueue not initialized');
    }

    const queue = this.queues.get(jobData.type);
    if (!queue) {
      throw new Error(`Queue for job type '${jobData.type}' not found`);
    }

    try {
      // Prepare job options
      const jobOptions: JobOptions = {
        ...this.config.defaultJobOptions,
        ...options,
        priority: this.mapPriorityToNumber(jobData.metadata.options?.priority),
        attempts: this.config.retrySettings.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: this.config.retrySettings.backoffDelay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50 // Keep last 50 failed jobs
      };

      // Submit job to queue
      const bullJob = await queue.add(jobData.type, jobData, jobOptions);

      // Get queue position
      const queuePosition = await this.getJobPosition(bullJob);
      const estimatedStartTime = this.estimateStartTime(jobData.type, queuePosition);

      const result: JobSubmissionResult = {
        jobId: bullJob.id.toString(),
        ...(queuePosition !== undefined && { queuePosition }),
        ...(estimatedStartTime && { estimatedStartTime })
      };

      this.logger.info('Job submitted to queue', {
        jobId: jobData.id,
        jobType: jobData.type,
        queuePosition,
        priority: jobData.metadata.options?.priority
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to submit job', {
        jobId: jobData.id,
        jobType: jobData.type,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, jobType: JobType): Promise<boolean> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue for job type '${jobType}' not found`);
    }

    try {
      const bullJob = await queue.getJob(jobId);
      if (!bullJob) {
        this.logger.warn('Job not found in queue', { jobId, jobType });
        return false;
      }

      await bullJob.remove();
      
      this.logger.info('Job cancelled', { jobId, jobType });
      return true;

    } catch (error) {
      this.logger.error('Failed to cancel job', {
        jobId,
        jobType,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Get job details from queue
   */
  async getJobDetails(jobId: string, jobType: JobType): Promise<BullJob | null> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      return null;
    }

    try {
      return await queue.getJob(jobId);
    } catch (error) {
      this.logger.error('Failed to get job details', {
        jobId,
        jobType,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];

    for (const [jobType, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);

        stats.push({
          name: jobType,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused()
        });

      } catch (error) {
        this.logger.error('Failed to get queue stats', {
          jobType,
          error: (error as Error).message
        });
      }
    }

    return stats;
  }

  /**
   * Pause a specific queue
   */
  async pauseQueue(jobType: JobType): Promise<void> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue for job type '${jobType}' not found`);
    }

    await queue.pause();
    this.logger.info('Queue paused', { jobType });
  }

  /**
   * Resume a specific queue
   */
  async resumeQueue(jobType: JobType): Promise<void> {
    const queue = this.queues.get(jobType);
    if (!queue) {
      throw new Error(`Queue for job type '${jobType}' not found`);
    }

    await queue.resume();
    this.logger.info('Queue resumed', { jobType });
  }

  /**
   * Clean up completed and failed jobs
   */
  async cleanQueues(): Promise<void> {
    for (const [jobType, queue] of this.queues) {
      try {
        // Clean completed jobs older than 24 hours
        await queue.clean(24 * 60 * 60 * 1000, 'completed');
        
        // Clean failed jobs older than 7 days
        await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

        this.logger.debug('Queue cleaned', { jobType });

      } catch (error) {
        this.logger.error('Failed to clean queue', {
          jobType,
          error: (error as Error).message
        });
      }
    }
  }

  /**
   * Get a specific queue for external processor registration
   */
  getQueue(jobType: JobType): Queue | undefined {
    return this.queues.get(jobType);
  }

  /**
   * Close all queues
   */
  async close(): Promise<void> {
    this.logger.info('Closing job queues');

    const closePromises = Array.from(this.queues.values()).map(queue => 
      queue.close().catch(error => 
        this.logger.error('Error closing queue', { error: error.message })
      )
    );

    await Promise.all(closePromises);
    
    this.queues.clear();
    this.initialized = false;
    this.logger.info('All job queues closed');
  }

  /**
   * Set up event handlers for a queue
   */
  private setupQueueEventHandlers(queue: Queue, jobType: JobType): void {
    // Job started
    queue.on('active', (job: BullJob) => {
      this.logger.info('Job started', {
        jobId: job.id,
        jobType,
        attempts: job.attemptsMade + 1
      });
    });

    // Job completed successfully
    queue.on('completed', (job: BullJob, result: any) => {
      this.logger.info('Job completed', {
        jobId: job.id,
        jobType,
        duration: Date.now() - job.processedOn!,
        attempts: job.attemptsMade + 1
      });
    });

    // Job failed
    queue.on('failed', (job: BullJob, error: Error) => {
      this.logger.error('Job failed', {
        jobId: job.id,
        jobType,
        error: error.message,
        attempts: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts
      });
    });

    // Job stalled (taking too long)
    queue.on('stalled', (job: BullJob) => {
      this.logger.warn('Job stalled', {
        jobId: job.id,
        jobType,
        attempts: job.attemptsMade + 1
      });
    });

    // Queue error
    queue.on('error', (error: Error) => {
      this.logger.error('Queue error', {
        jobType,
        error: error.message
      });
    });
  }

  /**
   * Get concurrency setting for job type
   */
  private getConcurrencyForJobType(jobType: JobType): number {
    switch (jobType) {
      case JobType.COLLECTION:
        return this.config.concurrency.collection;
      case JobType.PROCESSING:
        return this.config.concurrency.processing;
      case JobType.INDEXING:
        return this.config.concurrency.indexing;
      default:
        return this.config.concurrency.default;
    }
  }

  /**
   * Map priority enum to number for Bull.js
   */
  private mapPriorityToNumber(priority?: JobPriority): number {
    if (!priority) return 0;
    
    switch (priority) {
      case JobPriority.LOW: return -10;
      case JobPriority.NORMAL: return 0;
      case JobPriority.HIGH: return 10;
      case JobPriority.URGENT: return 20;
      default: return 0;
    }
  }

  /**
   * Get job position in queue
   */
  private async getJobPosition(bullJob: BullJob): Promise<number | undefined> {
    try {
      const waiting = await bullJob.queue.getWaiting();
      const position = waiting.findIndex(job => job.id === bullJob.id);
      return position >= 0 ? position + 1 : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Estimate job start time based on queue position
   */
  private estimateStartTime(jobType: JobType, queuePosition?: number): Date | undefined {
    if (!queuePosition || queuePosition <= 0) return undefined;

    // Rough estimation: 2 minutes per job on average
    const avgJobDuration = 2 * 60 * 1000; // 2 minutes in milliseconds
    const concurrency = this.getConcurrencyForJobType(jobType);
    
    const estimatedWaitTime = Math.ceil(queuePosition / concurrency) * avgJobDuration;
    
    return new Date(Date.now() + estimatedWaitTime);
  }
}

// Factory function for creating job queue
export const createJobQueue = (
  redisClient: RedisClientType,
  logger: winston.Logger
): JobQueue => {
  const config: JobQueueConfig = {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      db: Number(process.env.REDIS_DB) || 0
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      delay: 0,
      timeout: 30 * 60 * 1000, // 30 minutes
    },
    concurrency: {
      collection: Number(process.env.COLLECTION_CONCURRENCY) || 2,
      processing: Number(process.env.PROCESSING_CONCURRENCY) || 4,
      indexing: Number(process.env.INDEXING_CONCURRENCY) || 3,
      default: 1
    },
    retrySettings: {
      maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS) || 3,
      backoffDelay: Number(process.env.JOB_BACKOFF_DELAY) || 5000
    }
  };

  return new JobQueue(config, redisClient, logger);
}; 