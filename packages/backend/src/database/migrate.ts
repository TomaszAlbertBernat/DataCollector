#!/usr/bin/env tsx

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
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

interface Migration {
  id: string;
  name: string;
  sql: string;
}

async function runMigrations(): Promise<void> {
  console.log('🚀 Starting database migrations...');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Get list of migration files
    const migrationsDir = join(__dirname, 'migrations');
    const migrationFiles = [
      '001_create_jobs_table.sql'
    ];

    // Load and execute migrations
    for (const fileName of migrationFiles) {
      const migrationId = fileName.replace('.sql', '');
      
      // Check if migration already executed
      const { rows } = await pool.query(
        'SELECT id FROM migrations WHERE id = $1',
        [migrationId]
      );

      if (rows.length > 0) {
        console.log(`⏭️  Migration ${migrationId} already executed, skipping...`);
        continue;
      }

      // Load migration SQL
      const migrationPath = join(migrationsDir, fileName);
      const sql = readFileSync(migrationPath, 'utf8');

      console.log(`📝 Executing migration: ${migrationId}`);
      
      // Execute migration
      await pool.query(sql);
      
      // Record migration as executed
      await pool.query(
        'INSERT INTO migrations (id, name) VALUES ($1, $2)',
        [migrationId, fileName]
      );

      console.log(`✅ Migration ${migrationId} completed successfully`);
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🏁 Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}

export { runMigrations }; 