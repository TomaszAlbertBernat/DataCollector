import dotenv from 'dotenv';
import { createClient } from 'redis';
import Bull from 'bull';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

async function checkQueueStatus() {
  console.log('🔍 Checking Queue Status');
  console.log('=======================');

  try {
    // Connect to Redis
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379'
    });
    await redisClient.connect();
    console.log('✅ Redis connected');

    // Check collection queue
    const collectionQueue = new Bull('collection-queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || 'redis123'
      }
    });

    // Get queue stats
    const stats = await collectionQueue.getJobCounts();
    console.log('\n📊 Collection Queue Stats:');
    console.log('   Waiting:', stats.waiting);
    console.log('   Active:', stats.active);
    console.log('   Completed:', stats.completed);
    console.log('   Failed:', stats.failed);
    console.log('   Delayed:', stats.delayed);

    // Get recent jobs
    const recentJobs = await collectionQueue.getJobs(['active', 'waiting', 'failed'], 0, 10);
    console.log('\n📋 Recent Jobs:');
    recentJobs.forEach((job, index) => {
      console.log(`   Job ${index + 1}: ID=${job.id}, Status=${job.finishedOn ? 'completed' : job.failedReason ? 'failed' : 'active/waiting'}`);
      if (job.failedReason) {
        console.log(`     Error: ${job.failedReason}`);
      }
    });

    // Check if processor is attached (Bull doesn't expose processors directly)
    console.log(`\n⚙️ Queue name: ${collectionQueue.name}`);
    console.log(`   Queue is ready: ${collectionQueue.isReady()}`);

    await collectionQueue.close();
    await redisClient.quit();
    
    console.log('\n✅ Queue status check completed!');
    
  } catch (error) {
    console.error('❌ Queue status check failed:', error);
    throw error;
  }
}

// Run the check
checkQueueStatus().catch(console.error); 