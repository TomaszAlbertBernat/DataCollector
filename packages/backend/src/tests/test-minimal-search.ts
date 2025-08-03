import axios from 'axios';
// import { getEnvironmentInfo } from './config/environment.js';

const BASE_URL = 'http://localhost:3001';

async function testFulltextSearchOnly(): Promise<void> {
  console.log('🧪 Testing Fulltext Search Only (No ChromaDB)');
  console.log('==============================================\n');

  try {
    // Wait for server
    console.log('⏳ Waiting for backend server...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test health
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Backend server is running');

    // Test fulltext search mode specifically
    console.log('\n🔍 Testing FULLTEXT search mode only...');
    
    const response = await axios.get(`${BASE_URL}/api/search`, {
      params: {
        query: 'test search',
        searchMode: 'fulltext',  // Only test fulltext, skip semantic
        limit: 3
      }
    });

    if (response.data.success) {
      console.log(`✅ Fulltext search working: ${response.data.data.totalResults} results`);
      console.log(`   Search time: ${response.data.data.searchTime}ms`);
    } else {
      console.log('❌ Fulltext search failed:', response.data);
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

if (require.main === module) {
  testFulltextSearchOnly().catch(console.error);
} 