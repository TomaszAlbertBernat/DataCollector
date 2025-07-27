import { ContentDownloader } from './services/download/ContentDownloader';
import { FileProcessor } from './services/processing/FileProcessor';
import { EmbeddingGenerator } from './services/ai/EmbeddingGenerator';

async function testPhase3Components() {
  console.log('🧪 Testing Phase 3 Components...\n');

  // Test 1: Content Downloader
  console.log('1. Testing Content Downloader...');
  try {
    const downloader = new ContentDownloader('./test-downloads', 3);
    const supportedTypes = downloader.getSupportedFileTypes();
    console.log(`✅ Downloader initialized with ${supportedTypes.length} supported file types`);
    console.log(`   Supported types: ${supportedTypes.join(', ')}`);
  } catch (error) {
    console.log(`❌ Downloader test failed: ${error}`);
  }

  // Test 2: File Processor
  console.log('\n2. Testing File Processor...');
  try {
    const processor = new FileProcessor({
      chunkSize: 1000,
      chunkOverlap: 200,
      maxTextLength: 1000000
    });
    const stats = processor.getProcessingStats();
    console.log(`✅ Processor initialized with ${stats.supportedTypes.length} supported file types`);
    console.log(`   Chunk size: ${stats.chunkSize}, Overlap: ${stats.chunkOverlap}`);
  } catch (error) {
    console.log(`❌ Processor test failed: ${error}`);
  }

  // Test 3: Embedding Generator
  console.log('\n3. Testing Embedding Generator...');
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      const embeddingGenerator = new EmbeddingGenerator(openaiApiKey, {
        model: 'text-embedding-3-small',
        batchSize: 100,
        enableCaching: true
      });
      
      const modelInfo = embeddingGenerator.getModelInfo();
      console.log(`✅ Embedding generator initialized`);
      console.log(`   Model: ${modelInfo.model}, Batch size: ${modelInfo.batchSize}`);
      
      // Test connection
      const connectionTest = await embeddingGenerator.testConnection();
      console.log(`   Connection test: ${connectionTest.success ? '✅ PASSED' : '❌ FAILED'}`);
      if (!connectionTest.success) {
        console.log(`   Error: ${connectionTest.error}`);
      }
    } else {
      console.log('⚠️  OpenAI API key not found, skipping embedding generator test');
    }
  } catch (error) {
    console.log(`❌ Embedding generator test failed: ${error}`);
  }

  // Test 4: Integration Test
  console.log('\n4. Testing Integration...');
  try {
    // Create a simple text file for testing
    const fs = require('fs');
    const testFilePath = './test-file.txt';
    const testContent = 'This is a test document for processing. It contains multiple sentences to test text chunking and embedding generation. The content should be processed and converted into embeddings for search functionality.';
    
    fs.writeFileSync(testFilePath, testContent);
    console.log(`✅ Created test file: ${testFilePath}`);

    // Process the file
    const processor = new FileProcessor();
    const processingResult = await processor.processFile(testFilePath);
    
    if (processingResult.success) {
      console.log(`✅ File processing successful`);
      console.log(`   Text length: ${processingResult.text?.length || 0} characters`);
      console.log(`   Chunks created: ${processingResult.chunks?.length || 0}`);
      
      // Test embedding generation if available
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey && processingResult.chunks && processingResult.chunks.length > 0) {
        const embeddingGenerator = new EmbeddingGenerator(openaiApiKey);
        const embeddingResult = await embeddingGenerator.generateChunkEmbeddings(processingResult.chunks);
        
        if (embeddingResult.success) {
          console.log(`✅ Embedding generation successful`);
          console.log(`   Embeddings generated: ${embeddingResult.embeddings?.length || 0}`);
          console.log(`   Processing time: ${embeddingResult.processingTime}ms`);
        } else {
          console.log(`❌ Embedding generation failed: ${embeddingResult.error}`);
        }
      } else {
        console.log('⚠️  Skipping embedding test (no API key or no chunks)');
      }
    } else {
      console.log(`❌ File processing failed: ${processingResult.error}`);
    }

    // Clean up
    fs.unlinkSync(testFilePath);
    console.log(`✅ Cleaned up test file`);

  } catch (error) {
    console.log(`❌ Integration test failed: ${error}`);
  }

  console.log('\n🎉 Phase 3 component testing completed!');
}

// Run the test
testPhase3Components().catch(console.error); 