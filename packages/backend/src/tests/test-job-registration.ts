import dotenv from 'dotenv';
import { createClient } from 'redis';
import { Pool } from 'pg';
import winston from 'winston';
import { JobQueue } from './services/queue/JobQueue';
import { JobStateManager } from './services/queue/JobStateManager';
import { JobProcessor } from './services/queue/JobProcessor';
import { CollectionJob } from './services/jobs/CollectionJob';
import { JobType } from './types/job';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function testJobRegistration() {
  console.log('🧪 Testing Job Class Registration');
  console.log('=================================');

  try {
    // Connect to Redis
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379'
    });
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Connect to PostgreSQL
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector'
    });
    console.log('✅ PostgreSQL connected');

    // Create job queue
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

    const jobQueue = new JobQueue(jobQueueConfig, redisClient as any, logger);
    await jobQueue.initialize();
    console.log('✅ JobQueue initialized');

    // Create job state manager
    const stateManagerConfig = {
      enableWebSocket: false,
      progressUpdateInterval: 5000,
      jobTimeoutDuration: 3600000
    };

    const jobStateManager = new JobStateManager(pgPool, logger, stateManagerConfig);
    console.log('✅ JobStateManager initialized');

    // Create job processor
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
    
    // Test job class registration
    console.log('\n📋 Testing job class registration...');
    console.log('   JobType.COLLECTION:', JobType.COLLECTION);
    console.log('   CollectionJob constructor:', CollectionJob.name);
    
    // Register job class
    jobProcessor.registerJobClass(JobType.COLLECTION, CollectionJob);
    console.log('✅ CollectionJob registered');
    
    // Check if job class is registered
    const health = await jobProcessor.getHealthInfo();
    console.log('📊 Health check after registration:');
    console.log('   Initialized:', health.initialized);
    console.log('   Registered job types:', health.registeredJobTypes);
    
    // Initialize processor
    await jobProcessor.initialize();
    console.log('✅ JobProcessor initialized');
    
    // Check health after initialization
    const healthAfterInit = await jobProcessor.getHealthInfo();
    console.log('📊 Health check after initialization:');
    console.log('   Initialized:', healthAfterInit.initialized);
    console.log('   Registered job types:', healthAfterInit.registeredJobTypes);
    console.log('   Queue stats:', healthAfterInit.queueStats);

    // Cleanup
    await jobQueue.close();
    await redisClient.quit();
    await pgPool.end();
    
    console.log('\n✅ Job registration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Job registration test failed:', error);
    throw error;
  }
}

// Run the test
testJobRegistration().catch(console.error); 