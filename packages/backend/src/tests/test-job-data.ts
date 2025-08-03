import dotenv from 'dotenv';
import { createClient } from 'redis';
import { Pool } from 'pg';
import winston from 'winston';
import { JobQueue } from './services/queue/JobQueue';
import { JobStateManager } from './services/queue/JobStateManager';
import { JobType, JobStatus } from './types/job';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function testJobData() {
  console.log('🧪 Testing Job Data Submission');
  console.log('==============================');

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

    // Create test job data
    const testJobData = {
      id: 'test-job-123',
      type: JobType.COLLECTION,
      status: JobStatus.PENDING,
      query: 'test job data',
      progress: 0,
      userId: 'test-user',
      metadata: {
        sources: ['scholar'],
        options: {
          maxResults: 10
        }
      },
      createdAt: new Date()
    };

    console.log('\n📋 Test job data:');
    console.log('   ID:', testJobData.id);
    console.log('   Type:', testJobData.type);
    console.log('   Status:', testJobData.status);
    console.log('   Query:', testJobData.query);

    // Submit job
    console.log('\n📤 Submitting job to queue...');
    const result = await jobQueue.submitJob(testJobData);
    console.log('✅ Job submitted:', result);

    // Get queue stats
    const stats = await jobQueue.getQueueStats();
    console.log('\n📊 Queue stats after submission:');
    stats.forEach(stat => {
      console.log(`   ${stat.name}: waiting=${stat.waiting}, active=${stat.active}, completed=${stat.completed}, failed=${stat.failed}`);
    });

    // Cleanup
    await jobQueue.close();
    await redisClient.quit();
    await pgPool.end();
    
    console.log('\n✅ Job data test completed successfully!');
    
  } catch (error) {
    console.error('❌ Job data test failed:', error);
    throw error;
  }
}

// Run the test
testJobData().catch(console.error); 