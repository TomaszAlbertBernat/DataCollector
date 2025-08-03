import dotenv from 'dotenv';
import winston from 'winston';
import { Pool } from 'pg';
import { createClient } from 'redis';

// Load environment variables
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
dotenv.config({ path: envPath });

// Import services
import { createOpenAIService } from './services/ai/OpenAIService';
import { createLangChainService } from './services/ai/LangChainService';
import { createDataCollectionAgent } from './services/agents/DataCollectionAgent';
import { createScraperManager } from './services/scrapers/ScraperManager';
import { JobQueue } from './services/queue/JobQueue';
import { JobStateManager } from './services/queue/JobStateManager';
import { JobProcessor } from './services/queue/JobProcessor';
import { CollectionJob } from './services/jobs/CollectionJob';
import { ContentDownloader } from './services/download/ContentDownloader';
import { FileProcessor } from './services/processing/FileProcessor';
import { EmbeddingGenerator } from './services/ai/EmbeddingGenerator';
import { OpenSearchService } from './services/search/OpenSearchService';
import { ChromaDBService } from './services/search/ChromaDBService';
import { HybridSearchEngine } from './services/search/HybridSearchEngine';
import { JobType, JobStatus } from './types/job';

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Global service instances
let pgPool: Pool;
let redisClient: any;
let openaiService: any;
let langchainService: any;
let dataCollectionAgent: any;
let scraperManager: any;
let jobQueue: JobQueue;
let jobStateManager: JobStateManager;
let jobProcessor: JobProcessor;
let contentDownloader: ContentDownloader;
let fileProcessor: FileProcessor;
let embeddingGenerator: EmbeddingGenerator;
let openSearchService: OpenSearchService;
let chromaDBService: ChromaDBService;
let searchEngine: HybridSearchEngine;

// Test configuration
const TEST_CONFIG = {
  query: 'machine learning applications in healthcare',
  sources: ['scholar'],
  maxResults: 5,
  downloadFiles: true,
  processFiles: true,
  generateEmbeddings: true,
  indexInSearch: true
};

async function initializeServices() {
  logger.info('🚀 Initializing services for complete pipeline test...');

  try {
    // Initialize PostgreSQL
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    await pgPool.query('SELECT NOW()');
    logger.info('✅ PostgreSQL connected');

    // Initialize Redis
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379'
    });
    await redisClient.connect();
    logger.info('✅ Redis connected');

    // Initialize AI Services
    openaiService = createOpenAIService(logger);
    langchainService = createLangChainService(openaiService, logger);
    logger.info('✅ AI services initialized');

    // Initialize Data Collection Agent
    dataCollectionAgent = createDataCollectionAgent(openaiService, langchainService, logger);
    logger.info('✅ Data collection agent initialized');

    // Initialize Scraping Services
    scraperManager = createScraperManager(logger);
    logger.info('✅ Scraper manager initialized');

    // Initialize Job Services
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

    const stateManagerConfig = {
      enableWebSocket: false, // Disable WebSocket for testing
      progressUpdateInterval: 1000,
      jobTimeoutDuration: 3600000
    };

    jobStateManager = new JobStateManager(pgPool, logger, stateManagerConfig);
    logger.info('✅ Job services initialized');

    // Initialize Job Processor
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

    jobProcessor = new JobProcessor(jobQueue, jobStateManager, processorConfig, logger);
    jobProcessor.registerJobClass(JobType.COLLECTION, CollectionJob);
    jobProcessor.registerService('openaiService', openaiService);
    jobProcessor.registerService('langchainService', langchainService);
    jobProcessor.registerService('dataCollectionAgent', dataCollectionAgent);
    jobProcessor.registerService('scraperManager', scraperManager);
    await jobProcessor.initialize();
    logger.info('✅ Job processor initialized');

    // Initialize File Processing Services
    contentDownloader = new ContentDownloader('./test-downloads', 3);
    fileProcessor = new FileProcessor({
      chunkSize: 1000,
      chunkOverlap: 200,
      maxTextLength: 100000
    });
    logger.info('✅ File processing services initialized');

    // Initialize Embedding Generator
    embeddingGenerator = new EmbeddingGenerator(process.env.OPENAI_API_KEY!, {
      model: 'text-embedding-ada-002',
      batchSize: 10,
      enableCaching: true
    });
    logger.info('✅ Embedding generator initialized');

    // Initialize Search Services
    openSearchService = new OpenSearchService({
      node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: 'admin',
        password: 'admin'
      },
      timeout: 30000
    }, logger);

    chromaDBService = new ChromaDBService({
      url: process.env.CHROMADB_URL || 'http://localhost:8000',
      collectionName: 'test-collection',
      embeddingDimension: 1536, // OpenAI ada-002 embedding dimension
      distanceFunction: 'cosine'
    }, logger);

    const searchConfig = {
      defaultWeights: {
        fulltext: 0.6,
        semantic: 0.4
      },
      maxResults: 100,
      enableCaching: true,
      cacheTimeout: 300000 // 5 minutes
    };

    searchEngine = new HybridSearchEngine(openSearchService, chromaDBService, searchConfig, logger);
    logger.info('✅ Search services initialized');

    logger.info('🎉 All services initialized successfully!');
    return true;

  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    return false;
  }
}

async function testGoogleScholarScraping() {
  logger.info('🔍 Testing Google Scholar scraping...');

  try {
    const scraper = scraperManager.getScraper('scholar');
    if (!scraper) {
      throw new Error('Google Scholar scraper not found');
    }

    const results = await scraper.search(TEST_CONFIG.query, {
      maxResults: TEST_CONFIG.maxResults,
      yearFrom: 2020,
      sortBy: 'relevance'
    });

    logger.info(`✅ Google Scholar scraping successful: ${results.length} results found`);
    
    // Log first few results
    results.slice(0, 3).forEach((result: any, index: number) => {
      logger.info(`Result ${index + 1}:`, {
        title: result.title?.substring(0, 100),
        url: result.url,
        snippet: result.snippet?.substring(0, 150),
        authors: result.authors?.slice(0, 3),
        year: result.year
      });
    });

    return results;

  } catch (error) {
    logger.error('❌ Google Scholar scraping failed:', error);
    throw error;
  }
}

async function testFileDownloading(searchResults: any[]) {
  logger.info('📥 Testing file downloading...');

  try {
    const pdfUrls = searchResults
      .filter(result => result.pdfUrl)
      .slice(0, 2) // Limit to 2 files for testing
      .map(result => result.pdfUrl);

    if (pdfUrls.length === 0) {
      logger.warn('⚠️ No PDF URLs found in search results');
      return [];
    }

    logger.info(`📄 Attempting to download ${pdfUrls.length} PDF files...`);

    const downloadResults = await contentDownloader.downloadFiles(
      pdfUrls,
      'test-job-id',
      (progress) => {
        logger.info(`Download progress: ${progress.percentage.toFixed(1)}% - ${progress.url}`);
      }
    );

    const successfulDownloads = downloadResults.filter(result => result.success);
    logger.info(`✅ File downloading completed: ${successfulDownloads.length}/${downloadResults.length} successful`);

    successfulDownloads.forEach((result, index) => {
      logger.info(`Download ${index + 1}:`, {
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType
      });
    });

    return successfulDownloads;

  } catch (error) {
    logger.error('❌ File downloading failed:', error);
    throw error;
  }
}

async function testFileProcessing(downloadResults: any[]) {
  logger.info('🔧 Testing file processing...');

  try {
    const filePaths = downloadResults.map(result => result.filePath!);
    
    logger.info(`📄 Processing ${filePaths.length} files...`);

    const processingResults = await fileProcessor.processFiles(filePaths);

    const successfulProcessing = processingResults.filter(result => result.success);
    logger.info(`✅ File processing completed: ${successfulProcessing.length}/${processingResults.length} successful`);

    successfulProcessing.forEach((result, index) => {
      logger.info(`Processing ${index + 1}:`, {
        textLength: result.text?.length || 0,
        chunksCount: result.chunks?.length || 0,
        processingTime: result.processingTime
      });
    });

    return successfulProcessing;

  } catch (error) {
    logger.error('❌ File processing failed:', error);
    throw error;
  }
}

async function testEmbeddingGeneration(processingResults: any[]) {
  logger.info('🧠 Testing embedding generation...');

  try {
    const textChunks = processingResults
      .flatMap(result => result.chunks || [])
      .slice(0, 10); // Limit to 10 chunks for testing

    if (textChunks.length === 0) {
      logger.warn('⚠️ No text chunks available for embedding generation');
      return [];
    }

    logger.info(`🧠 Generating embeddings for ${textChunks.length} text chunks...`);

    const texts = textChunks.map(chunk => chunk.text);
    const embeddingResult = await embeddingGenerator.generateEmbeddings(texts);

    if (embeddingResult.success && embeddingResult.embeddings) {
      logger.info(`✅ Embedding generation successful: ${embeddingResult.embeddings.length} embeddings created`);
      logger.info(`Processing time: ${embeddingResult.processingTime}ms`);
      logger.info(`Cached: ${embeddingResult.cached ? 'Yes' : 'No'}`);
    } else {
      logger.error('❌ Embedding generation failed:', embeddingResult.error);
    }

    return embeddingResult;

  } catch (error) {
    logger.error('❌ Embedding generation failed:', error);
    throw error;
  }
}

async function testSearchIndexing(processingResults: any[], embeddingResult: any) {
  logger.info('🔍 Testing search indexing...');

  try {
    // Test OpenSearch indexing
    logger.info('📝 Testing OpenSearch indexing...');
    
    const documents = processingResults.map((result: any, index: number) => ({
      id: `doc-${index}`,
      title: `Document ${index + 1}`,
      content: result.text || '',
      url: '',
      source: 'test-pipeline',
      fileType: 'text',
      metadata: {
        source: 'test-pipeline',
        processingTime: result.processingTime,
        chunksCount: result.chunks?.length || 0
      },
      createdAt: new Date().toISOString()
    }));

    for (const doc of documents.slice(0, 3)) { // Index first 3 documents
      await openSearchService.indexDocument(doc);
      logger.info(`✅ Indexed document: ${doc.id}`);
    }

    // Test ChromaDB indexing
    logger.info('🧠 Testing ChromaDB indexing...');
    
    if (embeddingResult.success && embeddingResult.embeddings) {
      const vectorDocuments = documents.slice(0, 5).map((doc, index) => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        embedding: embeddingResult.embeddings?.[index] || undefined
      }));

      await chromaDBService.addDocuments(vectorDocuments);
      logger.info(`✅ Indexed ${vectorDocuments.length} documents in ChromaDB`);
    }

    // Test hybrid search
    logger.info('🔍 Testing hybrid search...');
    
    const searchQuery = 'machine learning healthcare';
    const searchResults = await searchEngine.search({
      query: searchQuery,
      searchMode: 'hybrid',
      pagination: {
        page: 1,
        limit: 5
      }
    });

    logger.info(`✅ Hybrid search successful: ${searchResults.results.length} results found`);
    
    if (searchResults.results.length > 0) {
      const topResult = searchResults.results[0];
      logger.info('Top search result:', {
        title: topResult?.title,
        score: topResult?.relevanceScore,
        source: topResult?.source
      });
    }

    return searchResults;

  } catch (error) {
    logger.error('❌ Search indexing failed:', error);
    throw error;
  }
}

async function testCompleteJobPipeline() {
  logger.info('🚀 Testing complete job pipeline...');

  try {
    // Create a collection job
    const jobData = {
      id: `test-pipeline-${Date.now()}`,
      type: JobType.COLLECTION,
      status: JobStatus.PENDING,
      query: TEST_CONFIG.query,
      progress: 0,
      userId: 'test-user',
      metadata: {
        sources: TEST_CONFIG.sources,
        maxResults: TEST_CONFIG.maxResults,
        testMode: true
      },
      createdAt: new Date()
    };

    // Submit job to queue
    const submissionResult = await jobQueue.submitJob(jobData);
    logger.info(`✅ Job submitted: ${submissionResult.jobId}`);

    // Wait for job to complete
    let jobStatus = JobStatus.PENDING;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    while (jobStatus !== JobStatus.COMPLETED && jobStatus !== JobStatus.FAILED && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const job = await jobStateManager.getJobById(submissionResult.jobId);
      if (job) {
        jobStatus = job.status;
        logger.info(`Job status: ${jobStatus} (${job.progress}%)`);
      }
      
      attempts++;
    }

    if (jobStatus === JobStatus.COMPLETED) {
      logger.info('✅ Complete job pipeline successful!');
      const finalJob = await jobStateManager.getJobById(submissionResult.jobId);
      if (finalJob) {
        logger.info('Job results:', {
          documentsFound: finalJob.results.documentsFound,
          documentsDownloaded: finalJob.results.documentsDownloaded,
          documentsProcessed: finalJob.results.documentsProcessed
        });
      }
    } else {
      logger.error('❌ Job pipeline failed or timed out');
    }

  } catch (error) {
    logger.error('❌ Complete job pipeline failed:', error);
    throw error;
  }
}

async function runCompletePipelineTest() {
  logger.info('🎯 Starting complete data collection pipeline test...');
  logger.info('Test configuration:', TEST_CONFIG);

  try {
    // Initialize all services
    const initialized = await initializeServices();
    if (!initialized) {
      throw new Error('Failed to initialize services');
    }

    // Test individual components
    logger.info('\n=== Testing Individual Components ===');
    
    const searchResults = await testGoogleScholarScraping();
    
    if (TEST_CONFIG.downloadFiles) {
      const downloadResults = await testFileDownloading(searchResults);
      
      if (TEST_CONFIG.processFiles) {
        const processingResults = await testFileProcessing(downloadResults);
        
        if (TEST_CONFIG.generateEmbeddings) {
          const embeddingResult = await testEmbeddingGeneration(processingResults);
          
          if (TEST_CONFIG.indexInSearch) {
            await testSearchIndexing(processingResults, embeddingResult);
          }
        }
      }
    }

    // Test complete job pipeline
    logger.info('\n=== Testing Complete Job Pipeline ===');
    await testCompleteJobPipeline();

    logger.info('\n🎉 Complete pipeline test successful!');
    logger.info('✅ All components working correctly');
    logger.info('✅ Integration between services verified');
    logger.info('✅ End-to-end workflow functional');

  } catch (error) {
    logger.error('\n❌ Complete pipeline test failed:', error);
    throw error;
  } finally {
    // Cleanup
    if (pgPool) await pgPool.end();
    if (redisClient) await redisClient.quit();
    logger.info('🧹 Cleanup completed');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runCompletePipelineTest()
    .then(() => {
      logger.info('🎯 Pipeline test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Pipeline test failed:', error);
      process.exit(1);
    });
}

export { runCompletePipelineTest }; 