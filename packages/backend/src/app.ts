import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { createClient } from 'redis';
import { Pool } from 'pg';
import winston from 'winston';
import rateLimit from 'express-rate-limit';

// Import services
import { createOpenAIService } from './services/ai/OpenAIService';
import { createLangChainService } from './services/ai/LangChainService';
import { createDataCollectionAgent } from './services/agents/DataCollectionAgent';
import { createScraperManager } from './services/scrapers/ScraperManager';
import { JobQueue } from './services/queue/JobQueue';
import { JobStateManager } from './services/queue/JobStateManager';
import { JobProcessor } from './services/queue/JobProcessor';
import { CollectionJob } from './services/jobs/CollectionJob';
import { createJobRouter } from './routes/jobs';
import { createSearchRouter } from './routes/search';
import { createUploadRouter } from './routes/upload';
import { JobType } from './types/job';

// Import types
import { HealthCheckResponse, ServiceHealthStatus } from './types/api';

// Load environment variables from root directory
import path from 'path';
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
console.log('Loading .env from:', envPath);
console.log('.env file exists:', require('fs').existsSync(envPath));
dotenv.config({ path: envPath });
console.log('OPENAI_API_KEY loaded:', !!process.env.OPENAI_API_KEY, 'Length:', process.env.OPENAI_API_KEY?.length || 0);

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Global service instances
let pgPool: Pool;
let redisClient: any;
let openaiService: any = null;
let langchainService: any = null;
let dataCollectionAgent: any = null;
let scraperManager: any = null;
let jobQueue: JobQueue | null = null;
let jobStateManager: JobStateManager | null = null;
let jobProcessor: JobProcessor | null = null;
let searchEngine: any = null;

// Initialize PostgreSQL connection pool
const initializePostgreSQL = async (): Promise<Pool> => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    await pool.query('SELECT NOW()');
    logger.info('PostgreSQL connected successfully');
    return pool;
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    throw error;
  }
};

// Initialize Redis connection
const initializeRedis = async () => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379'
  });

  client.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  await client.connect();
  return client;
};

// Initialize AI services
const initializeAIServices = async () => {
  try {
    // Check if OpenAI API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    logger.info('Debug: OpenAI API Key check', { 
      hasKey: !!openaiApiKey, 
      keyLength: openaiApiKey?.length || 0,
      startsWithSk: openaiApiKey?.startsWith('sk-') || false 
    });
    
    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      logger.warn('OpenAI API key not configured - AI features will be disabled');
      openaiService = null;
      langchainService = null;
      dataCollectionAgent = null;
      return;
    }

    // Initialize OpenAI service
    openaiService = createOpenAIService(logger);
    
    // Test OpenAI connection
    const isOpenAIValid = await openaiService.validateConnection();
    if (!isOpenAIValid) {
      logger.warn('OpenAI service validation failed - some features may not work');
    } else {
      logger.info('OpenAI service initialized successfully');
    }

    // Initialize LangChain service
    langchainService = createLangChainService(openaiService, logger);
    logger.info('LangChain service initialized successfully');

    // Initialize DataCollectionAgent
    dataCollectionAgent = createDataCollectionAgent(openaiService, langchainService, logger);
    logger.info('DataCollectionAgent initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize AI services:', error);
    // Don't throw error, just log it and continue without AI services
    openaiService = null;
    langchainService = null;
    dataCollectionAgent = null;
  }
};

// Initialize scraping services
const initializeScrapingServices = async () => {
  try {
    scraperManager = createScraperManager(logger);
    await scraperManager.initialize();
    logger.info('ScraperManager initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize scraping services:', error);
    // Don't throw error, just log it and continue without scraping services
    scraperManager = null;
  }
};

// Initialize job processing services
const initializeJobServices = async () => {
  try {
    // Initialize job queue
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

    jobQueue = new JobQueue(jobQueueConfig, redisClient, logger);
    await jobQueue.initialize();
    logger.info('JobQueue initialized successfully');

    // Initialize job state manager
    const stateManagerConfig = {
      enableWebSocket: true,
      progressUpdateInterval: 5000,
      jobTimeoutDuration: 3600000 // 1 hour
    };

    jobStateManager = new JobStateManager(pgPool, logger, stateManagerConfig, io);
    logger.info('JobStateManager initialized successfully');

    // Initialize job processor
    const processorConfig = {
      concurrency: {
        [JobType.COLLECTION]: 3,
        [JobType.PROCESSING]: 2,
        [JobType.INDEXING]: 2,
        [JobType.SEARCH]: 1
      },
      timeout: 3600000, // 1 hour
      retryDelay: 5000
    };

    jobProcessor = new JobProcessor(jobQueue, jobStateManager, processorConfig, logger);
    
    // Register job classes
    jobProcessor.registerJobClass(JobType.COLLECTION, CollectionJob);
    
    await jobProcessor.initialize();
    logger.info('JobProcessor initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize job services:', error);
    throw error;
  }
};

// Initialize search services
const initializeSearchServices = async () => {
  try {
    // For now, we'll create a placeholder search engine
    // In a real implementation, you'd initialize OpenSearch and ChromaDB
    logger.info('Search services placeholder - will be implemented with OpenSearch and ChromaDB');
    
    // TODO: Initialize actual search services
    // const openSearchService = createOpenSearchService(openSearchConfig, logger);
    // const chromaDBService = createChromaDBService(chromaDBConfig, logger);
    // searchEngine = createHybridSearchEngine(openSearchService, chromaDBService, searchConfig, logger);
    // await searchEngine.initialize();
    
  } catch (error) {
    logger.error('Failed to initialize search services:', error);
    // Don't throw error, just log it and continue without search services
    searchEngine = null;
  }
};

// Create Express app
const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Make logger available to routes
app.locals.logger = logger;

// Health check endpoints
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const serviceStatuses: ServiceHealthStatus[] = [];

    // Check PostgreSQL
    try {
      const pgStart = Date.now();
      await pgPool.query('SELECT 1');
      serviceStatuses.push({
        name: 'postgresql',
        status: 'healthy',
        responseTime: Date.now() - pgStart
      });
    } catch (error) {
      serviceStatuses.push({
        name: 'postgresql',
        status: 'unhealthy',
        error: (error as Error).message
      });
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await redisClient.ping();
      serviceStatuses.push({
        name: 'redis',
        status: 'healthy',
        responseTime: Date.now() - redisStart
      });
    } catch (error) {
      serviceStatuses.push({
        name: 'redis',
        status: 'unhealthy',
        error: (error as Error).message
      });
    }

    // Check OpenAI
    if (openaiService) {
      try {
        const openaiStart = Date.now();
        const isOpenAIValid = await openaiService.validateConnection();
        serviceStatuses.push({
          name: 'openai',
          status: isOpenAIValid ? 'healthy' : 'degraded',
          responseTime: Date.now() - openaiStart
        });
      } catch (error) {
        serviceStatuses.push({
          name: 'openai',
          status: 'unhealthy',
          error: (error as Error).message
        });
      }
    } else {
      serviceStatuses.push({
        name: 'openai',
        status: 'unhealthy',
        error: 'OpenAI service not configured'
      });
    }

    // Check Job Queue (only if initialized)
    if (jobQueue) {
      try {
        const queueStart = Date.now();
        const queueStats = await jobQueue.getQueueStats();
        serviceStatuses.push({
          name: 'job_queue',
          status: 'healthy',
          responseTime: Date.now() - queueStart
        });
      } catch (error) {
        serviceStatuses.push({
          name: 'job_queue',
          status: 'unhealthy',
          error: (error as Error).message
        });
      }
    } else {
      serviceStatuses.push({
        name: 'job_queue',
        status: 'unhealthy',
        error: 'Job queue not yet initialized'
      });
    }

    const overallStatus = serviceStatuses.every(s => s.status === 'healthy') 
      ? 'healthy' 
      : serviceStatuses.some(s => s.status === 'healthy') 
        ? 'degraded' 
        : 'unhealthy';

    const healthResponse: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: serviceStatuses,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime()
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthResponse);
    
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: [],
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      error: (error as Error).message
    });
  }
});

// Simple readiness check
app.get('/ready', (req, res) => {
  res.status(200).json({ 
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/jobs', (req, res, next) => {
  if (!jobQueue || !jobStateManager || !jobProcessor) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Job processing services are not yet initialized'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  const jobRouter = createJobRouter({
    jobQueue,
    stateManager: jobStateManager,
    processor: jobProcessor,
    logger
  });
  
  return jobRouter(req, res, next);
});

// Search routes
app.use('/api/search', (req, res, next) => {
  if (!searchEngine) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Search services are not yet initialized'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  const searchRouter = createSearchRouter({
    searchEngine,
    logger
  });
  
  return searchRouter(req, res, next);
});

app.use('/api/upload', (req, res, next) => {
  if (!jobQueue || !jobStateManager) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Upload services are not yet initialized'
      },
      timestamp: new Date().toISOString()
    });
  }
  const uploadRouter = createUploadRouter({
    jobQueue,
    stateManager: jobStateManager,
    logger
  });
  return uploadRouter(req, res, next);
});

app.use('/api/documents', (req, res) => {
  res.status(501).json({ 
    error: 'Document routes not implemented yet',
    message: 'Document endpoints will be implemented in Phase 7'
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected to WebSocket', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from WebSocket', { socketId: socket.id });
  });

  // Job subscription handling
  socket.on('subscribe_job', (jobId) => {
    socket.join(`job_${jobId}`);
    logger.debug('Client subscribed to job updates', { socketId: socket.id, jobId });
  });

  socket.on('unsubscribe_job', (jobId) => {
    socket.leave(`job_${jobId}`);
    logger.debug('Client unsubscribed from job updates', { socketId: socket.id, jobId });
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Cleanup services
    if (scraperManager) {
      await scraperManager.cleanup();
      logger.info('ScraperManager cleaned up');
    }

    if (jobProcessor) {
      await jobProcessor.shutdown();
      logger.info('JobProcessor shutdown');
    }

    if (jobQueue) {
      await jobQueue.close();
      logger.info('JobQueue shutdown');
    }

    if (pgPool) {
      await pgPool.end();
      logger.info('PostgreSQL connections closed');
    }
    
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize and start server
const startServer = async () => {
  try {
    logger.info('Starting DataCollector backend server...');

    // Initialize database connections
    pgPool = await initializePostgreSQL();
    redisClient = await initializeRedis();

    // Initialize services
    await initializeAIServices();
    await initializeScrapingServices();
    await initializeJobServices();
    await initializeSearchServices();

    const PORT = process.env.PORT || 3001;
    
    server.listen(PORT, () => {
      logger.info(`DataCollector backend server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Export for testing
export { app, io, pgPool, redisClient, logger };

// Start server if this file is run directly
if (require.main === module) {
  startServer();
} 