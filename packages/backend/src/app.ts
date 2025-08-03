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
import { EmbeddingGenerator } from './services/ai/EmbeddingGenerator';
import { createDataCollectionAgent } from './services/agents/DataCollectionAgent';
import { createScraperManager } from './services/scrapers/ScraperManager';
import { JobQueue } from './services/queue/JobQueue';
import { JobStateManager } from './services/queue/JobStateManager';
import { JobProcessor } from './services/queue/JobProcessor';
import { createOpenSearchService } from './services/search/OpenSearchService';
import { createChromaDBService } from './services/search/ChromaDBService';
import { createHybridSearchEngine } from './services/search/HybridSearchEngine';
import { CollectionJob } from './services/jobs/CollectionJob';
import { createJobRouter } from './routes/jobs';
import { createSearchRouter } from './routes/search';
import { createUploadRouter } from './routes/upload';
import { createDocumentRouter } from './routes/documents';
import { JobType } from './types/job';
import { MetricsService } from './services/MetricsService';

// Import types
import { HealthCheckResponse, ServiceHealthStatus } from './types/api';

// Load environment configuration using our safe environment module
import { ENV_CONFIG, ENV_STATUS, getEnvironmentInfo } from './config/environment';

// Initialize logger using environment configuration
const logger = winston.createLogger({
  level: ENV_CONFIG.LOG_LEVEL,
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
let embeddingGenerator: EmbeddingGenerator | null = null;
let dataCollectionAgent: any = null;
let scraperManager: any = null;
let jobQueue: JobQueue | null = null;
let jobStateManager: JobStateManager | null = null;
let jobProcessor: JobProcessor | null = null;
let searchEngine: any = null;
let metricsService: MetricsService | null = null;

// Initialize PostgreSQL connection pool
const initializePostgreSQL = async (): Promise<Pool> => {
  const pool = new Pool({
    connectionString: ENV_CONFIG.DATABASE_URL,
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
    url: ENV_CONFIG.REDIS_URL
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

    // Initialize EmbeddingGenerator
    embeddingGenerator = new EmbeddingGenerator(openaiApiKey, {
      model: 'text-embedding-3-small',
      batchSize: 100,
      enableCaching: true,
      cacheExpiry: 3600 // 1 hour
    });
    logger.info('EmbeddingGenerator initialized successfully');

    // Initialize DataCollectionAgent
    dataCollectionAgent = createDataCollectionAgent(openaiService, langchainService, logger);
    logger.info('DataCollectionAgent initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize AI services:', error);
    // Don't throw error, just log it and continue without AI services
    openaiService = null;
    langchainService = null;
    embeddingGenerator = null;
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

    // Initialize job state manager first
    const stateManagerConfig = {
      enableWebSocket: true,
      progressUpdateInterval: 5000,
      jobTimeoutDuration: 3600000 // 1 hour
    };

    jobStateManager = new JobStateManager(pgPool, logger, stateManagerConfig, io);
    logger.info('JobStateManager initialized successfully');

    // Initialize job queue with state manager
    jobQueue = new JobQueue(jobQueueConfig, redisClient, logger, jobStateManager);
    await jobQueue.initialize();
    logger.info('JobQueue initialized successfully');

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
    
    // Register job classes BEFORE initializing the processor
    jobProcessor.registerJobClass(JobType.COLLECTION, CollectionJob);
    
    // Register required services for job processing
    jobProcessor.registerService('openaiService', openaiService);
    jobProcessor.registerService('langchainService', langchainService);
    jobProcessor.registerService('dataCollectionAgent', dataCollectionAgent);
    jobProcessor.registerService('scraperManager', scraperManager);
    
    // Initialize the processor AFTER registering everything
    await jobProcessor.initialize();
    logger.info('JobProcessor initialized successfully');
    
    // Verify job processor is working
    const health = await jobProcessor.getHealthInfo();
    logger.info('Job processor health check', {
      initialized: health.initialized,
      registeredJobTypes: health.registeredJobTypes,
      queueStats: health.queueStats
    });

  } catch (error) {
    logger.error('Failed to initialize job services:', error);
    throw error;
  }
  };

// Initialize search services
const initializeSearchServices = async () => {
  try {
    // Check if embedding generator is available
    if (!embeddingGenerator) {
      logger.warn('EmbeddingGenerator not available - search services will be limited');
      searchEngine = null;
      return;
    }
    
    // Initialize OpenSearch service
    const openSearchService = createOpenSearchService({
      node: ENV_CONFIG.OPENSEARCH_URL,
      auth: {
        username: 'admin', // Default for local development
        password: 'admin'  // Default for local development
      },
      ssl: {
        rejectUnauthorized: false // For local development
      },
      timeout: 30000
    }, logger);
    
    // Initialize ChromaDB service
    const chromaDBService = createChromaDBService({
      url: ENV_CONFIG.CHROMADB_URL,
      collectionName: 'datacollector',
      embeddingDimension: 1536, // OpenAI text-embedding-3-small dimension
      distanceFunction: 'cosine'
    }, embeddingGenerator, logger);
    
    // Initialize hybrid search engine
    searchEngine = createHybridSearchEngine(
      openSearchService,
      chromaDBService,
      {
        defaultWeights: {
          fulltext: 0.6,
          semantic: 0.4,
        },
        maxResults: 100,
        enableCaching: true,
        cacheTimeout: 5 * 60 * 1000, // 5 minutes
      },
      logger
    );
    
    await searchEngine.initialize();
    logger.info('Search services initialized successfully');
    
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

// Metrics tracking middleware
app.use((req, res, next) => {
  if (metricsService) {
    const requestId = `${req.method}-${req.path}-${Date.now()}-${Math.random()}`;
    metricsService.startRequest(requestId);
    
    // Track response time
    res.on('finish', () => {
      if (metricsService) {
        const duration = metricsService.endRequest(requestId);
        logger.debug(`Request completed: ${req.method} ${req.path} - ${duration}ms`, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration
        });
      }
    });
  }
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
      const pgResponseTime = Date.now() - pgStart;
      serviceStatuses.push({
        name: 'postgresql',
        status: 'healthy',
        responseTime: pgResponseTime
      });
      
      // Record metrics
      if (metricsService) {
        metricsService.recordServiceHealth('postgresql', 'healthy', pgResponseTime);
      }
    } catch (error) {
      serviceStatuses.push({
        name: 'postgresql',
        status: 'unhealthy',
        error: (error as Error).message
      });
      
      // Record metrics
      if (metricsService) {
        metricsService.recordServiceHealth('postgresql', 'unhealthy', 0);
      }
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await redisClient.ping();
      const redisResponseTime = Date.now() - redisStart;
      serviceStatuses.push({
        name: 'redis',
        status: 'healthy',
        responseTime: redisResponseTime
      });
      
      // Record metrics
      if (metricsService) {
        metricsService.recordServiceHealth('redis', 'healthy', redisResponseTime);
      }
    } catch (error) {
      serviceStatuses.push({
        name: 'redis',
        status: 'unhealthy',
        error: (error as Error).message
      });
      
      // Record metrics
      if (metricsService) {
        metricsService.recordServiceHealth('redis', 'unhealthy', 0);
      }
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

// Metrics endpoints
app.get('/metrics', (req, res) => {
  if (!metricsService) {
    return res.status(503).json({
      error: 'Metrics service not available',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const metrics = metricsService.getMetrics();
    return res.status(200).json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    return res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/metrics/services', (req, res) => {
  if (!metricsService) {
    return res.status(503).json({
      error: 'Metrics service not available',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const serviceMetrics = metricsService.getServiceMetrics();
    res.status(200).json({
      success: true,
      data: serviceMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get service metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve service metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Prometheus-compatible metrics endpoint
app.get('/metrics/prometheus', (req, res) => {
  if (!metricsService) {
    return res.status(503).send('# Metrics service not available\n');
  }

  try {
    const metrics = metricsService.getMetrics();
    const serviceMetrics = metricsService.getServiceMetrics();
    
    let prometheusMetrics = '';
    
    // System metrics
    prometheusMetrics += `# HELP datacollector_uptime_seconds Application uptime in seconds\n`;
    prometheusMetrics += `# TYPE datacollector_uptime_seconds gauge\n`;
    prometheusMetrics += `datacollector_uptime_seconds ${metrics.uptime / 1000}\n\n`;
    
    prometheusMetrics += `# HELP datacollector_memory_bytes Memory usage in bytes\n`;
    prometheusMetrics += `# TYPE datacollector_memory_bytes gauge\n`;
    prometheusMetrics += `datacollector_memory_used_bytes ${metrics.memory.used}\n`;
    prometheusMetrics += `datacollector_memory_heap_used_bytes ${metrics.memory.heapUsed}\n`;
    prometheusMetrics += `datacollector_memory_heap_total_bytes ${metrics.memory.heapTotal}\n\n`;
    
    prometheusMetrics += `# HELP datacollector_requests_total Total number of requests\n`;
    prometheusMetrics += `# TYPE datacollector_requests_total counter\n`;
    prometheusMetrics += `datacollector_requests_total ${metrics.requests.total}\n\n`;
    
    prometheusMetrics += `# HELP datacollector_requests_active Current active requests\n`;
    prometheusMetrics += `# TYPE datacollector_requests_active gauge\n`;
    prometheusMetrics += `datacollector_requests_active ${metrics.requests.active}\n\n`;
    
    prometheusMetrics += `# HELP datacollector_jobs_total Total number of jobs\n`;
    prometheusMetrics += `# TYPE datacollector_jobs_total counter\n`;
    prometheusMetrics += `datacollector_jobs_total{status="pending"} ${metrics.jobs.pending}\n`;
    prometheusMetrics += `datacollector_jobs_total{status="running"} ${metrics.jobs.running}\n`;
    prometheusMetrics += `datacollector_jobs_total{status="completed"} ${metrics.jobs.completed}\n`;
    prometheusMetrics += `datacollector_jobs_total{status="failed"} ${metrics.jobs.failed}\n\n`;
    
    prometheusMetrics += `# HELP datacollector_search_queries_total Total search queries\n`;
    prometheusMetrics += `# TYPE datacollector_search_queries_total counter\n`;
    prometheusMetrics += `datacollector_search_queries_total ${metrics.search.totalQueries}\n\n`;
    
    prometheusMetrics += `# HELP datacollector_search_response_time_seconds Average search response time\n`;
    prometheusMetrics += `# TYPE datacollector_search_response_time_seconds gauge\n`;
    prometheusMetrics += `datacollector_search_response_time_seconds ${metrics.search.averageResponseTime / 1000}\n\n`;
    
    // Service health metrics
    serviceMetrics.forEach(service => {
      prometheusMetrics += `# HELP datacollector_service_health Service health status\n`;
      prometheusMetrics += `# TYPE datacollector_service_health gauge\n`;
      const healthValue = service.status === 'healthy' ? 1 : service.status === 'degraded' ? 0.5 : 0;
      prometheusMetrics += `datacollector_service_health{service="${service.name}"} ${healthValue}\n`;
      
      prometheusMetrics += `# HELP datacollector_service_response_time_seconds Service response time\n`;
      prometheusMetrics += `# TYPE datacollector_service_response_time_seconds gauge\n`;
      prometheusMetrics += `datacollector_service_response_time_seconds{service="${service.name}"} ${service.responseTime / 1000}\n`;
    });
    
    res.set('Content-Type', 'text/plain');
    res.status(200).send(prometheusMetrics);
  } catch (error) {
    logger.error('Failed to generate Prometheus metrics:', error);
    res.status(500).send('# Failed to generate metrics\n');
  }
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

// Document routes
const documentRouter = createDocumentRouter({ logger });
app.use('/api/documents', documentRouter);

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
    
    // Initialize metrics service
    metricsService = new MetricsService(logger);
    logger.info('MetricsService initialized successfully');

    // Determine initial port (default 3001) and convert to number
    let currentPort: number = Number(process.env.PORT) || 3001;
    const maxRetries = 10;

    /**
     * Try to start the HTTP server. If the port is already in use, increment
     * the port number (up to `maxRetries` times) and retry. This prevents the
     * common "EADDRINUSE" crash that occurs when multiple test or dev
     * instances are running simultaneously.
     */
    const listen = (retries = 0) => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && retries < maxRetries) {
          logger.warn(`Port ${currentPort} in use, retrying with port ${currentPort + 1}`);
          currentPort += 1;
          listen(retries + 1);
        } else {
          logger.error('Failed to start server:', err);
          process.exit(1);
        }
      });

      server.listen(currentPort, () => {
        logger.info(`DataCollector backend server running on port ${currentPort}`, {
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0'
        });
      });
    };

    // Start listening (initial attempt)
    listen();

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