import { Job as BullJob, DoneCallback, Queue } from 'bull';
import winston from 'winston';
import { Server as SocketIOServer } from 'socket.io';

import { JobQueue } from './JobQueue';
import { JobStateManager } from './JobStateManager';
import { BaseJob } from '../jobs/BaseJob';
import { JobData, JobType, JobStatus, ILogger, IStatusNotifier, IServiceContainer, IConfig } from '../../types/job';
import { Job } from '../../models/Job';

export interface JobProcessorConfig {
  concurrency: {
    [JobType.COLLECTION]: number;
    [JobType.PROCESSING]: number;
    [JobType.INDEXING]: number;
    [JobType.SEARCH]: number;
  };
  timeout: number;
  retryDelay: number;
}

export interface ProcessorStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  averageProcessingTime: number;
  activeJobs: number;
}

/**
 * Status notifier implementation for job progress updates
 */
class JobStatusNotifier implements IStatusNotifier {
  constructor(
    private stateManager: JobStateManager,
    private logger: winston.Logger
  ) {}

  async broadcast(jobId: string, status: JobStatus, message?: string, data?: any): Promise<void> {
    try {
      // Update job status in database
      if (status !== JobStatus.RUNNING) {
        const updateData: any = {};
        if (message) updateData.message = message;
        if (data) updateData.results = data;
        
        await this.stateManager.updateJobStatus(jobId, status, updateData);
      }

      // Update progress if provided
      if (data?.progress !== undefined) {
        await this.stateManager.updateJobProgress(
          jobId,
          data.progress,
          message,
          data.stage
        );
      }

    } catch (error) {
      this.logger.error('Failed to broadcast job status', {
        jobId,
        status,
        error: (error as Error).message
      });
    }
  }

  subscribe(jobId: string, callback: (update: any) => void): void {
    // Implementation for subscription if needed
    this.logger.debug('Job subscription requested', { jobId });
  }

  unsubscribe(jobId: string): void {
    // Implementation for unsubscription if needed
    this.logger.debug('Job unsubscription requested', { jobId });
  }
}

/**
 * Simple service container implementation
 */
class ServiceContainer implements IServiceContainer {
  private services: Map<string, any> = new Map();

  get<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }
    return service;
  }

  register<T>(serviceName: string, service: T): void {
    this.services.set(serviceName, service);
  }

  has(serviceName: string): boolean {
    return this.services.has(serviceName);
  }
}

/**
 * Configuration provider implementation
 */
class ConfigProvider implements IConfig {
  get<T>(key: string): T {
    const value = process.env[key];
    if (value === undefined) {
      throw new Error(`Configuration key '${key}' not found`);
    }
    return value as unknown as T;
  }

  getOptional<T>(key: string, defaultValue: T): T {
    const value = process.env[key];
    return value !== undefined ? (value as unknown as T) : defaultValue;
  }
}

export class JobProcessor {
  private jobQueue: JobQueue;
  private stateManager: JobStateManager;
  private logger: winston.Logger;
  private config: JobProcessorConfig;
  private serviceContainer: ServiceContainer;
  private configProvider: ConfigProvider;
  private statusNotifier: JobStatusNotifier;
  private initialized = false;

  // Job type to class mapping (to be populated by specific implementations)
  private jobClasses: Map<JobType, new (...args: any[]) => BaseJob> = new Map();

  // Statistics
  private stats: ProcessorStats = {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    averageProcessingTime: 0,
    activeJobs: 0
  };

  constructor(
    jobQueue: JobQueue,
    stateManager: JobStateManager,
    config: JobProcessorConfig,
    logger: winston.Logger
  ) {
    this.jobQueue = jobQueue;
    this.stateManager = stateManager;
    this.config = config;
    this.logger = logger;

    // Initialize support services
    this.serviceContainer = new ServiceContainer();
    this.configProvider = new ConfigProvider();
    this.statusNotifier = new JobStatusNotifier(stateManager, logger);

    // Register core services
    this.serviceContainer.register('jobStateManager', stateManager);
    this.serviceContainer.register('logger', logger);
    this.serviceContainer.register('config', this.configProvider);
  }

  /**
   * Initialize job processors for all queues
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('JobProcessor already initialized');
      return;
    }

    try {
      this.logger.info('Initializing job processors');

      // Register processors for each job type
      for (const jobType of Object.values(JobType)) {
        const queue = this.jobQueue.getQueue(jobType);
        if (!queue) {
          this.logger.warn(`Queue for job type '${jobType}' not found`);
          continue;
        }

        const concurrency = this.config.concurrency[jobType] || 1;
        
        // Register processor function
        queue.process(concurrency, (job: BullJob, done: DoneCallback) => {
          this.processJob(job, done);
        });

        this.logger.info(`Processor registered for ${jobType}`, { concurrency });
      }

      this.initialized = true;
      this.logger.info('All job processors initialized');

    } catch (error) {
      this.logger.error('Failed to initialize job processors', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Register a job class for a specific job type
   */
  registerJobClass<T extends BaseJob>(
    jobType: JobType,
    JobClass: new (...args: any[]) => T
  ): void {
    this.jobClasses.set(jobType, JobClass);
    this.logger.info(`Job class registered for ${jobType}`, {
      className: JobClass.name
    });
  }

  /**
   * Register additional services
   */
  registerService<T>(serviceName: string, service: T): void {
    this.serviceContainer.register(serviceName, service);
    this.logger.debug(`Service registered: ${serviceName}`);
  }

  /**
   * Process a single job
   */
  private async processJob(bullJob: BullJob, done: DoneCallback): Promise<void> {
    const startTime = Date.now();
    this.stats.activeJobs++;

    try {
      const jobData = bullJob.data as JobData;
      
      this.logger.info('Processing job', {
        jobId: jobData.id,
        type: jobData.type,
        attempt: bullJob.attemptsMade + 1
      });

      // Get the appropriate job class
      const JobClass = this.jobClasses.get(jobData.type);
      if (!JobClass) {
        throw new Error(`No job class registered for type: ${jobData.type}`);
      }

      // Create job instance
      const jobInstance = new JobClass(
        jobData,
        this.logger,
        this.statusNotifier,
        this.serviceContainer,
        this.configProvider
      );

      // Process the job
      await jobInstance.process();

      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      this.logger.info('Job completed successfully', {
        jobId: jobData.id,
        type: jobData.type,
        processingTime: `${processingTime}ms`
      });

      done();

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, processingTime);

      this.logger.error('Job processing failed', {
        jobId: bullJob.data.id,
        type: bullJob.data.type,
        attempt: bullJob.attemptsMade + 1,
        error: (error as Error).message,
        processingTime: `${processingTime}ms`
      });

      done(error as Error);
    } finally {
      this.stats.activeJobs--;
    }
  }

  /**
   * Update processing statistics
   */
  private updateStats(success: boolean, processingTime: number): void {
    this.stats.totalProcessed++;
    
    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.failureCount++;
    }

    // Update average processing time
    const totalTime = this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.totalProcessed;
  }

  /**
   * Get processing statistics
   */
  getStats(): ProcessorStats {
    return { ...this.stats };
  }

  /**
   * Get detailed processor health information
   */
  async getHealthInfo(): Promise<{
    initialized: boolean;
    registeredJobTypes: JobType[];
    queueStats: any[];
    processorStats: ProcessorStats;
  }> {
    return {
      initialized: this.initialized,
      registeredJobTypes: Array.from(this.jobClasses.keys()),
      queueStats: await this.jobQueue.getQueueStats(),
      processorStats: this.getStats()
    };
  }

  /**
   * Shutdown processor gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down job processor');

    try {
      // Wait for active jobs to complete (with timeout)
      const shutdownTimeout = 30000; // 30 seconds
      const startTime = Date.now();

      while (this.stats.activeJobs > 0 && (Date.now() - startTime) < shutdownTimeout) {
        this.logger.info(`Waiting for ${this.stats.activeJobs} active jobs to complete`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (this.stats.activeJobs > 0) {
        this.logger.warn(`Force shutdown with ${this.stats.activeJobs} jobs still active`);
      }

      this.initialized = false;
      this.logger.info('Job processor shutdown completed');

    } catch (error) {
      this.logger.error('Error during processor shutdown', {
        error: (error as Error).message
      });
    }
  }
}

// Factory function
export const createJobProcessor = (
  jobQueue: JobQueue,
  stateManager: JobStateManager,
  logger: winston.Logger
): JobProcessor => {
  const config: JobProcessorConfig = {
    concurrency: {
      [JobType.COLLECTION]: Number(process.env.COLLECTION_CONCURRENCY) || 2,
      [JobType.PROCESSING]: Number(process.env.PROCESSING_CONCURRENCY) || 4,
      [JobType.INDEXING]: Number(process.env.INDEXING_CONCURRENCY) || 3,
      [JobType.SEARCH]: Number(process.env.SEARCH_CONCURRENCY) || 1
    },
    timeout: Number(process.env.JOB_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
    retryDelay: Number(process.env.JOB_RETRY_DELAY) || 5000 // 5 seconds
  };

  return new JobProcessor(jobQueue, stateManager, config, logger);
}; 