import dotenv from 'dotenv';
import { createClient } from 'redis';
import { Pool } from 'pg';
import winston from 'winston';
import Bull from 'bull';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function testManualJobProcessing() {
  console.log('🧪 Testing Manual Job Processing');
  console.log('================================');

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

    // Create a test job queue
    const testQueue = new Bull('test-queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || 'redis123'
      }
    });

    // Add a test job
    console.log('\n📋 Adding test job to queue...');
    const testJob = await testQueue.add('test-job', {
      query: 'test query',
      sources: ['scholar'],
      userId: 'test-user'
    });
    console.log('✅ Test job added:', testJob.id);

    // Process the job
    console.log('\n⚙️ Processing test job...');
    testQueue.process('test-job', async (job) => {
      console.log('🔄 Processing job:', job.id);
      console.log('   Data:', job.data);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Job completed successfully');
      return { success: true, processed: true };
    });

    // Wait for job to complete
    console.log('\n⏳ Waiting for job to complete...');
    const completedJob = await testJob.finished();
    console.log('✅ Job finished:', completedJob);

    // Check job status
    const jobStatus = await testJob.getState();
    console.log('📊 Job status:', jobStatus);

    // Cleanup
    await testQueue.close();
    await redisClient.quit();
    await pgPool.end();
    
    console.log('\n✅ Manual job processing test completed successfully!');
    
  } catch (error) {
    console.error('❌ Manual job processing test failed:', error);
    throw error;
  }
}

// Run the test
testManualJobProcessing().catch(console.error); 