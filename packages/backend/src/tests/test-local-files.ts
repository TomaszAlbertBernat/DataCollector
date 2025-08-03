import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import winston from 'winston';
import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '..', '..', '.env') });

// Import services
import { createOpenAIService } from './services/ai/OpenAIService';
import { createLangChainService } from './services/ai/LangChainService';
import { createDataCollectionAgent } from './services/agents/DataCollectionAgent';
import { createScraperManager } from './services/scrapers/ScraperManager';
import { ContentDownloader } from './services/download/ContentDownloader';
import { FileProcessor } from './services/processing/FileProcessor';
import { EmbeddingGenerator } from './services/ai/EmbeddingGenerator';
import { createJobQueue } from './services/queue/JobQueue';
import { createJobStateManager } from './services/queue/JobStateManager';
import { createJobProcessor } from './services/queue/JobProcessor';
import { createOpenSearchService } from './services/search/OpenSearchService';
import { createChromaDBService } from './services/search/ChromaDBService';
import { createHybridSearchEngine } from './services/search/HybridSearchEngine';

// Import types
import { JobType, JobStatus } from './types/job';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Global variables for services
let pgPool: Pool;
let redisClient: any;
let openaiService: any;
let langchainService: any;
let dataCollectionAgent: any;
let scraperManager: any;
let contentDownloader: any;
let fileProcessor: any;
let embeddingGenerator: any;
let jobQueue: any;
let stateManager: any;
let processor: any;
let openSearchService: any;
let chromaDBService: any;
let hybridSearchEngine: any;

async function initializeServices() {
  logger.info('🔧 Initializing services for local file testing...');
  
  // Check environment variables
  logger.info('🔍 Checking environment variables...');
  logger.info('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
  logger.info('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  logger.info('REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');

  try {
    // Initialize database connections
    logger.info('🔧 Initializing PostgreSQL connection...');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/datacollector',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    logger.info('🔧 Initializing Redis connection...');
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    logger.info('✅ Redis connected successfully');

    // Initialize AI services
    openaiService = createOpenAIService(logger);
    langchainService = createLangChainService(openaiService, logger);
    dataCollectionAgent = createDataCollectionAgent(openaiService, langchainService, logger);

    // Initialize processing services
    contentDownloader = new ContentDownloader('./test-downloads', 5, {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    });

    fileProcessor = new FileProcessor({
      chunkSize: 1000,
      chunkOverlap: 200,
      maxTextLength: 100000,
      preserveFormatting: true,
      extractMetadata: true,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    embeddingGenerator = new EmbeddingGenerator(apiKey, {
      model: 'text-embedding-3-small',
      batchSize: 10,
      maxRetries: 3,
      retryDelay: 1000,
      enableCaching: true,
    });

    // Initialize job services
    stateManager = createJobStateManager(pgPool, logger, undefined);
    
    jobQueue = createJobQueue(redisClient, logger);

    processor = createJobProcessor(jobQueue, stateManager, logger);

    // Initialize search services
    openSearchService = createOpenSearchService({
      node: process.env.OPENSEARCH_URL || 'https://localhost:9200',
      auth: {
        username: process.env.OPENSEARCH_USERNAME || 'admin',
        password: process.env.OPENSEARCH_PASSWORD || 'admin',
      },
      ssl: {
        rejectUnauthorized: false,
      },
      timeout: 30000,
    }, logger);

    chromaDBService = createChromaDBService({
      url: process.env.CHROMADB_URL || 'http://localhost:8000',
      collectionName: 'test_collection',
      embeddingDimension: 1536,
      distanceFunction: 'cosine',
    }, logger);

    hybridSearchEngine = createHybridSearchEngine(
      openSearchService,
      chromaDBService,
      {
        defaultWeights: {
          fulltext: 0.6,
          semantic: 0.4,
        },
        maxResults: 50,
        enableCaching: true,
        cacheTimeout: 300,
      },
      logger
    );

    // Initialize all services
    await Promise.all([
      openSearchService.initialize(),
      chromaDBService.initialize(),
      hybridSearchEngine.initialize(),
      jobQueue.initialize(),
      processor.initialize(),
    ]);

    logger.info('✅ All services initialized successfully');
    return true;
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    logger.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return false;
  }
}

async function getLocalFiles(): Promise<string[]> {
  const transcriptionsPath = path.join(process.cwd(), '..', '..', 'Transcriptions_All');
  const files: string[] = [];

  try {
    // Get meditation files
    const meditationPath = path.join(transcriptionsPath, 'DRK', 'Meditation ｜ Healthy Gamer');
    const meditationFiles = fs.readdirSync(meditationPath)
      .filter(file => file.endsWith('.txt'))
      .map(file => path.join(meditationPath, file));

    // Get lecture files
    const lecturePath = path.join(transcriptionsPath, 'DRK', 'Best Lectures ｜ Healthy Gamer');
    const lectureFiles = fs.readdirSync(lecturePath)
      .filter(file => file.endsWith('.txt'))
      .map(file => path.join(lecturePath, file));

    files.push(...meditationFiles, ...lectureFiles);
    logger.info(`📁 Found ${files.length} local files for testing`);
    
    return files;
  } catch (error) {
    logger.error('❌ Error reading local files:', error);
    return [];
  }
}

async function testFileProcessing(localFiles: string[]) {
  logger.info('📄 Testing file processing with local files...');
  
  const results = [];
  let successCount = 0;
  let totalFiles = localFiles.length;

  for (let i = 0; i < localFiles.length; i++) {
    const filePath = localFiles[i];
    const fileName = path.basename(filePath || 'unknown');
    
    try {
      logger.info(`Processing file ${i + 1}/${totalFiles}: ${fileName}`);
      
      const result = await fileProcessor.processFile(filePath);
      
      if (result.success) {
        successCount++;
        results.push({
          filePath,
          fileName,
          textLength: result.text?.length || 0,
          chunksCount: result.chunks?.length || 0,
          metadata: result.metadata,
        });
        
        logger.info(`✅ Processed ${fileName}: ${result.chunks?.length || 0} chunks, ${result.text?.length || 0} chars`);
      } else {
        logger.error(`❌ Failed to process ${fileName}: ${result.error}`);
      }
    } catch (error) {
      logger.error(`❌ Error processing ${fileName}:`, error);
    }
  }

  logger.info(`📊 File processing results: ${successCount}/${totalFiles} successful`);
  return results;
}

async function testEmbeddingGeneration(processingResults: any[]) {
  logger.info('🧠 Testing embedding generation...');
  
  if (processingResults.length === 0) {
    logger.warn('⚠️ No processed files available for embedding generation');
    return null;
  }

  try {
    // Collect all text chunks
    const allChunks: any[] = [];
    processingResults.forEach(result => {
      if (result.chunks) {
        allChunks.push(...result.chunks);
      }
    });

    if (allChunks.length === 0) {
      logger.warn('⚠️ No text chunks available for embedding generation');
      return null;
    }

    logger.info(`📝 Generating embeddings for ${allChunks.length} text chunks...`);
    
    const embeddingResult = await embeddingGenerator.generateChunkEmbeddings(allChunks);
    
    if (embeddingResult.success && embeddingResult.embeddings) {
      logger.info(`✅ Generated ${embeddingResult.embeddings.length} embeddings successfully`);
      return {
        embeddings: embeddingResult.embeddings,
        chunks: allChunks,
        processingTime: embeddingResult.processingTime,
      };
    } else {
      logger.error('❌ Failed to generate embeddings:', embeddingResult.error);
      return null;
    }
  } catch (error) {
    logger.error('❌ Error during embedding generation:', error);
    return null;
  }
}

async function testSearchIndexing(processingResults: any[], embeddingResult: any) {
  logger.info('🔍 Testing search indexing...');
  
  if (processingResults.length === 0) {
    logger.warn('⚠️ No processed files available for search indexing');
    return;
  }

  try {
    let indexedCount = 0;
    
    for (const result of processingResults) {
      if (result.text) {
        const document = {
          id: randomUUID(),
          title: result.fileName || 'Unknown',
          content: result.text,
          source: 'local_transcription',
          authors: ['Dr. K'],
          publicationDate: new Date().toISOString(),
          fileType: 'text',
          fileSize: result.text.length,
          metadata: {
            ...result.metadata,
            originalPath: result.filePath,
            processingTime: new Date().toISOString(),
          },
        };

        try {
          // Index in OpenSearch
          await openSearchService.indexDocument(document);
          
          // Index in ChromaDB (if we have embeddings)
          if (embeddingResult && embeddingResult.embeddings) {
            const chunkIndex = indexedCount;
            if (chunkIndex < embeddingResult.embeddings.length) {
              await chromaDBService.addDocuments([{
                id: document.id,
                content: document.content,
                metadata: document.metadata,
                embedding: embeddingResult.embeddings[chunkIndex],
              }]);
            }
          }
          
          indexedCount++;
          logger.info(`✅ Indexed document: ${document.title}`);
        } catch (error) {
          logger.error(`❌ Failed to index document ${document.title}:`, error);
        }
      }
    }

    logger.info(`📊 Search indexing results: ${indexedCount} documents indexed`);
  } catch (error) {
    logger.error('❌ Error during search indexing:', error);
  }
}

async function testSearchFunctionality() {
  logger.info('🔍 Testing search functionality...');
  
  try {
    // Test search queries
    const testQueries = [
      'meditation anxiety',
      'ADHD mental health',
      'therapy depression',
      'self love',
      'negative emotions',
    ];

    for (const query of testQueries) {
      logger.info(`🔍 Testing search query: "${query}"`);
      
      try {
        const searchResult = await hybridSearchEngine.search({
          query,
          searchMode: 'hybrid',
          pagination: {
            page: 1,
            limit: 5,
          },
        });

        logger.info(`✅ Search results for "${query}": ${searchResult.results.length} results found`);
        
        if (searchResult.results.length > 0) {
          const topResult = searchResult.results[0];
          logger.info(`📄 Top result: ${topResult.title} (score: ${topResult.relevanceScore.toFixed(3)})`);
        }
      } catch (error) {
        logger.error(`❌ Search failed for query "${query}":`, error);
      }
    }
  } catch (error) {
    logger.error('❌ Error during search testing:', error);
  }
}

async function testCompleteLocalPipeline() {
  logger.info('🚀 Testing complete local file pipeline...');
  
  try {
    // Get local files
    const localFiles = await getLocalFiles();
    if (localFiles.length === 0) {
      logger.error('❌ No local files found for testing');
      return;
    }

    // Test file processing
    const processingResults = await testFileProcessing(localFiles);
    
    // Test embedding generation
    const embeddingResult = await testEmbeddingGeneration(processingResults);
    
    // Test search indexing
    await testSearchIndexing(processingResults, embeddingResult);
    
    // Test search functionality
    await testSearchFunctionality();
    
    logger.info('✅ Complete local file pipeline test completed successfully');
  } catch (error) {
    logger.error('❌ Error during complete pipeline test:', error);
  }
}

async function runLocalFileTest() {
  logger.info('🧪 Starting local file pipeline test...');
  
  try {
    // Initialize services
    const initialized = await initializeServices();
    if (!initialized) {
      logger.error('❌ Failed to initialize services');
      return;
    }

    // Run the complete pipeline test
    await testCompleteLocalPipeline();
    
    logger.info('✅ Local file pipeline test completed');
  } catch (error) {
    logger.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    try {
      await pgPool?.end();
      await redisClient?.disconnect();
      logger.info('🧹 Cleanup completed');
    } catch (error) {
      logger.error('❌ Cleanup error:', error);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runLocalFileTest().catch(console.error);
}

export { runLocalFileTest }; 