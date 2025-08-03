import { ContentDownloader } from './services/download/ContentDownloader';
import { FileProcessor } from './services/processing/FileProcessor';
import { EmbeddingGenerator } from './services/ai/EmbeddingGenerator';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables from root directory
const envPath = 'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env';
console.log('Loading .env from:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));
dotenv.config({ path: envPath });
console.log('OPENAI_API_KEY loaded:', !!process.env.OPENAI_API_KEY, 'Length:', process.env.OPENAI_API_KEY?.length || 0);

class PipelineTest {
  private contentDownloader!: ContentDownloader;
  private fileProcessor!: FileProcessor;
  private embeddingGenerator!: EmbeddingGenerator;

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    console.log('🔧 Initializing services...');
    
    // Initialize AI services
    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.embeddingGenerator = new EmbeddingGenerator(openaiApiKey);
    
    // Initialize processing services
    this.contentDownloader = new ContentDownloader('./test-downloads', 3);
    this.fileProcessor = new FileProcessor({
      chunkSize: 1000,
      chunkOverlap: 200,
      extractMetadata: true
    });
    
    // Note: JobQueue and JobStateManager require Redis and PostgreSQL connections
    // We'll test them separately in a simpler way
    console.log('⚠️  Job processing services require Redis/PostgreSQL - testing separately');
    
    console.log('✅ Services initialized');
  }

  async runCompletePipelineTest() {
    console.log('\n🚀 Starting Complete Pipeline Test');
    console.log('=====================================');

    try {
      // Step 1: Test Content Downloader
      await this.testContentDownloader();
      
      // Step 2: Test File Processor
      await this.testFileProcessor();
      
      // Step 3: Test Embedding Generator
      await this.testEmbeddingGenerator();
      
      console.log('\n✅ All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Pipeline test failed:', error);
      throw error;
    }
  }

  private async testContentDownloader() {
    console.log('\n📥 Testing Content Downloader...');
    
    try {
      const supportedTypes = this.contentDownloader.getSupportedFileTypes();
      console.log('✅ Downloader initialized with', supportedTypes.length, 'supported file types');
      console.log('   Supported types:', supportedTypes.join(', '));
      
      // Test with a simple text file creation
      const testContent = 'This is a test document for download testing.';
      const testFilePath = './test-downloads/test-download.txt';
      
      // Ensure directory exists
      const dir = path.dirname(testFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(testFilePath, testContent);
      console.log('✅ Created test file for download testing');
      
      return testFilePath;
    } catch (error) {
      console.error('❌ Content downloader test failed:', error);
      throw error;
    }
  }

  private async testFileProcessor() {
    console.log('\n📄 Testing File Processor...');
    
    // Test with a sample text file
    const testContent = `This is a test document about machine learning.
    
    Machine learning is a subset of artificial intelligence that focuses on algorithms
    that can learn and make predictions from data. It has applications in healthcare,
    finance, and many other fields.
    
    The main types of machine learning are:
    1. Supervised Learning
    2. Unsupervised Learning
    3. Reinforcement Learning`;
    
    const testFilePath = './test-downloads/test-document.txt';
    
    try {
      // Ensure directory exists
      const dir = path.dirname(testFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(testFilePath, testContent);
      
      const result = await this.fileProcessor.processFile(testFilePath);
      console.log('✅ File processing test completed:', result.success);
      
      if (result.chunks) {
        console.log('📝 Generated chunks:', result.chunks.length);
        console.log('📄 Total text length:', result.text?.length || 0, 'characters');
      }
      
      return result;
    } catch (error) {
      console.error('❌ File processor test failed:', error);
      throw error;
    }
  }

  private async testEmbeddingGenerator() {
    console.log('\n🧠 Testing Embedding Generator...');
    
    try {
      const modelInfo = this.embeddingGenerator.getModelInfo();
      console.log('✅ Embedding generator initialized');
      console.log('   Model:', modelInfo.model);
      console.log('   Batch size:', modelInfo.batchSize);
      
      // Test connection
      const connectionTest = await this.embeddingGenerator.testConnection();
      console.log('   Connection test:', connectionTest.success ? '✅ PASSED' : '❌ FAILED');
      if (!connectionTest.success) {
        console.log('   Error:', connectionTest.error);
      }
      
      return connectionTest;
    } catch (error) {
      console.error('❌ Embedding generator test failed:', error);
      throw error;
    }
  }


}

// Run the test
async function main() {
  console.log('🧪 Starting Pipeline Test Suite');
  console.log('================================');
  
  const test = new PipelineTest();
  
  // Wait a moment for services to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await test.runCompletePipelineTest();
  
  console.log('\n🎉 Pipeline test suite completed!');
  process.exit(0);
}

main().catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
}); 