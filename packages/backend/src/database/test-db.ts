#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function testDatabase(): Promise<void> {
  console.log('🔍 Testing database connection and jobs table...');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Check if jobs table exists
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      );
    `);
    
    if (tableResult.rows[0].exists) {
      console.log('✅ Jobs table exists');
    } else {
      console.log('❌ Jobs table does not exist');
      return;
    }

    // Count total jobs
    const countResult = await pool.query('SELECT COUNT(*) FROM jobs');
    const totalJobs = parseInt(countResult.rows[0].count);
    console.log(`📊 Total jobs in database: ${totalJobs}`);

    // Get recent jobs
    const jobsResult = await pool.query(`
      SELECT id, type, status, query, user_id, created_at 
      FROM jobs 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    if (jobsResult.rows.length > 0) {
      console.log('📋 Recent jobs:');
      jobsResult.rows.forEach((job, index) => {
        console.log(`  ${index + 1}. ID: ${job.id}`);
        console.log(`     Type: ${job.type}`);
        console.log(`     Status: ${job.status}`);
        console.log(`     Query: ${job.query.substring(0, 50)}...`);
        console.log(`     User ID: ${job.user_id}`);
        console.log(`     Created: ${job.created_at}`);
        console.log('');
      });
    } else {
      console.log('📭 No jobs found in database');
    }

    // Check migrations table
    const migrationsResult = await pool.query('SELECT * FROM migrations ORDER BY executed_at DESC');
    console.log(`📝 Migrations executed: ${migrationsResult.rows.length}`);
    migrationsResult.rows.forEach(migration => {
      console.log(`  - ${migration.id}: ${migration.name} (${migration.executed_at})`);
    });

  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDatabase()
    .then(() => {
      console.log('🏁 Database test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database test failed:', error);
      process.exit(1);
    });
}

export { testDatabase }; 