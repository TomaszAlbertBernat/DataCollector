import { JobProcessor } from '../services/queue/JobProcessor';
import { JobQueue } from '../services/queue/JobQueue';
import { JobStateManager } from '../services/queue/JobStateManager';
import { CollectionJob } from '../services/jobs/CollectionJob';
import { JobType, JobStatus } from '../types/job';
import winston from 'winston';

// Mock dependencies
jest.mock('../services/queue/JobQueue');
jest.mock('../services/queue/JobStateManager');
jest.mock('../services/jobs/CollectionJob');

describe('JobProcessor', () => {
  let jobProcessor: JobProcessor;
  let mockJobQueue: jest.Mocked<JobQueue>;
  let mockJobStateManager: jest.Mocked<JobStateManager>;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock job queue
    mockJobQueue = {
      addJob: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      removeJob: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      close: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      getQueueStats: jest.fn().mockReturnValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      }),
      getQueue: jest.fn().mockReturnValue({
        process: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      })
    } as any;

    // Create mock job state manager
    mockJobStateManager = {
      updateJobStatus: jest.fn(),
      getJobById: jest.fn(),
      getJobProgress: jest.fn(),
      updateJobProgress: jest.fn(),
      getJobHistory: jest.fn(),
      cleanup: jest.fn()
    } as any;

    // Create job processor
    const config = {
      concurrency: {
        [JobType.COLLECTION]: 3,
        [JobType.PROCESSING]: 2,
        [JobType.INDEXING]: 2,
        [JobType.SEARCH]: 1
      },
      timeout: 3600000,
      retryDelay: 5000
    };

    jobProcessor = new JobProcessor(mockJobQueue, mockJobStateManager, config, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await jobProcessor.initialize();

      expect(mockJobQueue.getQueue).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('All job processors initialized');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      mockJobQueue.getQueue.mockImplementation(() => {
        throw error;
      });

      await expect(jobProcessor.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('job registration', () => {
    it('should register job classes successfully', () => {
      jobProcessor.registerJobClass(JobType.COLLECTION, CollectionJob);

      expect(mockLogger.info).toHaveBeenCalledWith('Job class registered for collection', { className: 'CollectionJob' });
    });

    it('should register services successfully', () => {
      const mockService = { name: 'testService' };
      jobProcessor.registerService('testService', mockService);

      // The registerService method doesn't log anything, so we just verify it doesn't throw
      expect(jobProcessor).toBeDefined();
    });
  });

  describe('health monitoring', () => {
    it('should return health information', async () => {
      await jobProcessor.initialize();
      jobProcessor.registerJobClass(JobType.COLLECTION, CollectionJob);

      const health = await jobProcessor.getHealthInfo();

      expect(health).toHaveProperty('initialized');
      expect(health).toHaveProperty('registeredJobTypes');
      expect(health).toHaveProperty('queueStats');
      expect(health.initialized).toBe(true);
      expect(health.registeredJobTypes).toContain(JobType.COLLECTION);
    });
  });

  describe('stats', () => {
    it('should return processor stats', () => {
      const stats = jobProcessor.getStats();
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('activeJobs');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await jobProcessor.shutdown();
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down job processor');
    });
  });
}); 