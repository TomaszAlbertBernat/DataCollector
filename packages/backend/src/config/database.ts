import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import winston from 'winston';

export interface DatabaseConfig {
  postgresql: {
    connectionString: string;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  redis: {
    url: string;
  };
}

export class DatabaseManager {
  private pgPool: Pool | null = null;
  private redisClient: RedisClientType | null = null;
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  async initializePostgreSQL(config: DatabaseConfig['postgresql']): Promise<Pool> {
    if (this.pgPool) {
      return this.pgPool;
    }

    this.pgPool = new Pool({
      connectionString: config.connectionString,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
    });

    try {
      // Test connection
      await this.pgPool.query('SELECT NOW()');
      this.logger.info('PostgreSQL connected successfully');
      
      // Set up connection error handling
      this.pgPool.on('error', (err) => {
        this.logger.error('PostgreSQL pool error:', err);
      });

      return this.pgPool;
    } catch (error) {
      this.logger.error('PostgreSQL connection failed:', error);
      throw error;
    }
  }

  async initializeRedis(config: DatabaseConfig['redis']): Promise<RedisClientType> {
    if (this.redisClient) {
      return this.redisClient;
    }

    this.redisClient = createClient({
      url: config.url
    }) as RedisClientType;

    this.redisClient.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
    });

    this.redisClient.on('connect', () => {
      this.logger.info('Redis connected successfully');
    });

    this.redisClient.on('ready', () => {
      this.logger.info('Redis ready for commands');
    });

    this.redisClient.on('end', () => {
      this.logger.info('Redis connection ended');
    });

    await this.redisClient.connect();
    return this.redisClient;
  }

  getPostgreSQLPool(): Pool {
    if (!this.pgPool) {
      throw new Error('PostgreSQL not initialized. Call initializePostgreSQL first.');
    }
    return this.pgPool;
  }

  getRedisClient(): RedisClientType {
    if (!this.redisClient) {
      throw new Error('Redis not initialized. Call initializeRedis first.');
    }
    return this.redisClient;
  }

  async closeConnections(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.pgPool) {
      promises.push(this.pgPool.end().then(() => {
        this.logger.info('PostgreSQL connections closed');
        this.pgPool = null;
      }));
    }

    if (this.redisClient) {
      promises.push(this.redisClient.quit().then(() => {
        this.logger.info('Redis connection closed');
        this.redisClient = null;
      }));
    }

    await Promise.all(promises);
  }

  async healthCheck(): Promise<{ postgresql: boolean; redis: boolean }> {
    const health = { postgresql: false, redis: false };

    try {
      if (this.pgPool) {
        await this.pgPool.query('SELECT 1');
        health.postgresql = true;
      }
    } catch (error) {
      this.logger.error('PostgreSQL health check failed:', error);
    }

    try {
      if (this.redisClient) {
        await this.redisClient.ping();
        health.redis = true;
      }
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
    }

    return health;
  }
}

// Default configuration factory
export const createDatabaseConfig = (): DatabaseConfig => ({
  postgresql: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector',
    max: Number(process.env.PG_POOL_MAX) || 20,
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT) || 2000,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379'
  }
});

// Create global database manager instance
let databaseManager: DatabaseManager | null = null;

export const getDatabaseManager = (logger: winston.Logger): DatabaseManager => {
  if (!databaseManager) {
    databaseManager = new DatabaseManager(logger);
  }
  return databaseManager;
}; 