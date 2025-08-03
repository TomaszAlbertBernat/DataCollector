import dotenv from 'dotenv';
import { createClient } from 'redis';
import { Pool } from 'pg';
import winston from 'winston';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function testJobProcessing() {
  console.log('🧪 Testing Job Processing System');
  console.log('================================');

  try {
    // Test Redis connection
    console.log('\n1. Testing Redis connection...');
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379'
    });
    
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    
    // Test PostgreSQL connection
    console.log('\n2. Testing PostgreSQL connection...');
    const pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector'
    });
    
    const dbResult = await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected successfully');
    console.log('   Current time:', dbResult.rows[0].now);
    
    // Check existing jobs
    console.log('\n3. Checking existing jobs...');
    const jobsResult = await pgPool.query('SELECT id, type, status, query, created_at FROM jobs ORDER BY created_at DESC LIMIT 5');
    console.log(`✅ Found ${jobsResult.rows.length} jobs in database`);
    
    jobsResult.rows.forEach((job, index) => {
      console.log(`   Job ${index + 1}: ${job.id} - ${job.status} - "${job.query}"`);
    });
    
    // Test job queue
    console.log('\n4. Testing job queue...');
    const queueResult = await redisClient.sendCommand(['KEYS', '*queue*']) as string[];
    console.log('✅ Job queues found:', queueResult?.length || 0);
    console.log('   Queue keys:', queueResult);
    
    // Check queue stats
    if (queueResult && queueResult.length > 0) {
      for (const queueKey of queueResult) {
        const queueStats = await redisClient.sendCommand(['LLEN', queueKey]) as number;
        console.log(`   ${queueKey}: ${queueStats} jobs`);
      }
    } else {
      console.log('   No job queues found');
    }
    
    console.log('\n✅ Job processing system test completed successfully!');
    
    // Cleanup
    await redisClient.quit();
    await pgPool.end();
    
  } catch (error) {
    console.error('❌ Job processing test failed:', error);
    throw error;
  }
}

// Run the test
testJobProcessing().catch(console.error); 