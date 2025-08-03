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
    logger.info('🔧 Initializing AI services...');
    openaiService = createOpenAIService(logger);
    langchainService = createLangChainService(openaiService, logger);
    dataCollectionAgent = createDataCollectionAgent(openaiService, langchainService, logger);

    // Initialize processing services
    logger.info('🔧 Initializing processing services...');
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
    
    logger.info('✅ Complete local file pipeline test completed successfully');
    
    // Summary
    logger.info('📊 Test Summary:');
    logger.info(`- Files found: ${localFiles.length}`);
    logger.info(`- Files processed: ${processingResults.length}`);
    logger.info(`- Embeddings generated: ${embeddingResult ? embeddingResult.embeddings.length : 0}`);
    
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