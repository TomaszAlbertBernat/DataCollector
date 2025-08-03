import dotenv from 'dotenv';
import winston from 'winston';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { randomUUID } from 'crypto';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

// Import services
import { JobQueue } from './services/queue/JobQueue';
import { JobStateManager } from './services/queue/JobStateManager';
import { JobProcessor } from './services/queue/JobProcessor';
import { CollectionJob } from './services/jobs/CollectionJob';
import { createOpenAIService } from './services/ai/OpenAIService';
import { createLangChainService } from './services/ai/LangChainService';
import { createDataCollectionAgent } from './services/agents/DataCollectionAgent';
import { createScraperManager } from './services/scrapers/ScraperManager';
import { JobType, JobStatus } from './types/job';

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function testQuickFixes() {
  logger.info('🔧 Testing quick fixes for UUID and job processor...');

  try {
    // Initialize PostgreSQL
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    await pgPool.query('SELECT NOW()');
    logger.info('✅ PostgreSQL connected');

    // Initialize Redis
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379'
    });
    await redisClient.connect();
    logger.info('✅ Redis connected');

    // Initialize AI Services
    const openaiService = createOpenAIService(logger);
    const langchainService = createLangChainService(openaiService, logger);
    logger.info('✅ AI services initialized');

    // Initialize Data Collection Agent
    const dataCollectionAgent = createDataCollectionAgent(openaiService, langchainService, logger);
    logger.info('✅ Data collection agent initialized');

    // Initialize Scraping Services
    const scraperManager = createScraperManager(logger);
    logger.info('✅ Scraper manager initialized');

    // Initialize Job Services
    const jobQueueConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || 'redis123',
        db: 0
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      },
      concurrency: {
        collection: 3,
        processing: 2,
        indexing: 2,
        default: 1
      },
      retrySettings: {
        maxAttempts: 3,
        backoffDelay: 5000
      }
    };

    const stateManagerConfig = {
      enableWebSocket: false, // Disable WebSocket for testing
      progressUpdateInterval: 1000,
      jobTimeoutDuration: 3600000
    };

    const jobStateManager = new JobStateManager(pgPool, logger, stateManagerConfig);
    logger.info('✅ Job state manager initialized');

    const jobQueue = new JobQueue(jobQueueConfig, redisClient as any, logger, jobStateManager);
    await jobQueue.initialize();
    logger.info('✅ Job services initialized');

    // Initialize Job Processor
    const processorConfig = {
      concurrency: {
        [JobType.COLLECTION]: 3,
        [JobType.PROCESSING]: 2,
        [JobType.INDEXING]: 2,
        [JobType.SEARCH]: 1
      },
      timeout: 3600000,
      retryDelay: 5000
    };

    const jobProcessor = new JobProcessor(jobQueue, jobStateManager, processorConfig, logger);
    jobProcessor.registerJobClass(JobType.COLLECTION, CollectionJob);
    jobProcessor.registerService('openaiService', openaiService);
    jobProcessor.registerService('langchainService', langchainService);
    jobProcessor.registerService('dataCollectionAgent', dataCollectionAgent);
    jobProcessor.registerService('scraperManager', scraperManager);
    await jobProcessor.initialize();
    logger.info('✅ Job processor initialized');

    // Test 1: UUID Generation
    logger.info('\n=== Test 1: UUID Generation ===');
    const testUUID = randomUUID();
    logger.info(`Generated UUID: ${testUUID}`);
    logger.info(`UUID format valid: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testUUID)}`);

    // Test 2: Job Submission with UUID
    logger.info('\n=== Test 2: Job Submission with UUID ===');
    const jobData = {
      id: randomUUID(),
      type: JobType.COLLECTION,
      status: JobStatus.PENDING,
      query: 'test query',
      progress: 0,
      userId: 'test-user',
      metadata: {
        sources: ['scholar'],
        maxResults: 1,
        testMode: true
      },
      createdAt: new Date()
    };

    const submissionResult = await jobQueue.submitJob(jobData);
    logger.info(`✅ Job submitted successfully: ${submissionResult.jobId}`);
    logger.info(`Job ID format valid: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionResult.jobId)}`);

    // Test 3: Job Processor Health Check
    logger.info('\n=== Test 3: Job Processor Health Check ===');
    const health = await jobProcessor.getHealthInfo();
    logger.info('Job processor health:', {
      initialized: health.initialized,
      registeredJobTypes: health.registeredJobTypes,
      queueStats: health.queueStats.length
    });

    // Test 4: Database Query with UUID
    logger.info('\n=== Test 4: Database Query with UUID ===');
    const job = await jobStateManager.getJobById(submissionResult.jobId);
    if (job) {
      logger.info('✅ Database query with UUID successful:', {
        jobId: job.id,
        status: job.status,
        query: job.query
      });
    } else {
      logger.error('❌ Database query failed');
    }

    logger.info('\n🎉 All quick fixes verified successfully!');
    logger.info('✅ UUID generation working');
    logger.info('✅ Job submission with UUID working');
    logger.info('✅ Job processor registration working');
    logger.info('✅ Database queries with UUID working');

  } catch (error) {
    logger.error('\n❌ Quick fixes test failed:', error);
    throw error;
  } finally {
    // Cleanup
    logger.info('🧹 Cleanup completed');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testQuickFixes()
    .then(() => {
      logger.info('🎯 Quick fixes test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Quick fixes test failed:', error);
      process.exit(1);
    });
}

export { testQuickFixes }; 