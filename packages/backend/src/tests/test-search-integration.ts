import axios from 'axios';
import { getEnvironmentInfo } from './config/environment.js';

const BASE_URL = 'http://localhost:3001';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  relevanceScore: number;
  highlights?: Array<{
    field: string;
    fragments: string[];
  }>;
}

interface SearchResponse {
  success: boolean;
  data: {
    results: SearchResult[];
    totalResults: number;
    searchTime: number;
    searchMode: string;
  };
}

async function waitForServer(maxAttempts = 30, interval = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      if (response.status === 200) {
        console.log(`✅ Server is ready (attempt ${attempt})`);
        return true;
      }
    } catch (error: any) {
      console.log(`⏳ Waiting for server... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  return false;
}

async function checkSearchHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${BASE_URL}/api/search/health`);
    console.log('🔍 Search Health Status:', response.data);
    return response.data.success && response.data.data.overall;
  } catch (error: any) {
    console.error('❌ Search health check failed:', error.response?.data || error.message);
    return false;
  }
}

async function indexSampleDocuments(): Promise<void> {
  console.log('\n📄 Indexing sample mental health documents...');
  
  const sampleDocs = [
    {
      id: 'mh-meditation-001',
      title: 'Introduction to Mindfulness Meditation',
      content: 'Mindfulness meditation is a powerful practice for mental health. It involves focusing on the present moment, observing thoughts without judgment, and developing awareness of our mental patterns. This practice can help reduce anxiety, depression, and stress while improving emotional regulation.',
      source: 'Mental Health Transcription',
      authors: ['Dr. K', 'Healthy Gamer'],
      fileType: 'text',
      metadata: {
        category: 'meditation',
        topic: 'mindfulness',
        duration: '15 minutes'
      }
    },
    {
      id: 'mh-anxiety-002', 
      title: 'Understanding Anxiety and Coping Mechanisms',
      content: 'Anxiety is a natural response to stress, but when it becomes overwhelming, it can significantly impact daily life. Effective coping mechanisms include breathing exercises, cognitive restructuring, progressive muscle relaxation, and mindfulness practices. Understanding the root causes of anxiety is crucial for developing long-term management strategies.',
      source: 'Mental Health Transcription',
      authors: ['Dr. K', 'Healthy Gamer'],
      fileType: 'text',
      metadata: {
        category: 'psychology',
        topic: 'anxiety',
        techniques: ['breathing', 'cognitive therapy']
      }
    },
    {
      id: 'mh-depression-003',
      title: 'Depression: Symptoms, Causes, and Treatment Options',
      content: 'Depression is more than just feeling sad. It involves persistent feelings of hopelessness, loss of interest in activities, changes in sleep and appetite, and difficulty concentrating. Treatment options include therapy, medication, lifestyle changes, and social support. Cognitive Behavioral Therapy (CBT) has shown particularly effective results.',
      source: 'Mental Health Transcription',
      authors: ['Dr. K', 'Healthy Gamer'],
      fileType: 'text',
      metadata: {
        category: 'psychology',
        topic: 'depression',
        treatments: ['CBT', 'therapy', 'medication']
      }
    }
  ];

  for (const doc of sampleDocs) {
    try {
      const response = await axios.post(`${BASE_URL}/api/search/index`, doc);
      if (response.data.success) {
        console.log(`✅ Indexed: ${doc.title}`);
      } else {
        console.log(`❌ Failed to index: ${doc.title}`, response.data);
      }
    } catch (error: any) {
      console.error(`❌ Error indexing ${doc.title}:`, error.response?.data || error.message);
    }
  }
}

async function testSearchQueries(): Promise<void> {
  console.log('\n🔍 Testing search functionality...');
  
  const searchQueries = [
    {
      query: 'mindfulness meditation',
      description: 'Basic meditation search'
    },
    {
      query: 'anxiety coping strategies',
      description: 'Anxiety management search'
    },
    {
      query: 'depression treatment',
      description: 'Depression therapy search'
    },
    {
      query: 'mental health',
      description: 'General mental health search'
    },
    {
      query: 'CBT cognitive behavioral therapy',
      description: 'Specific therapy search'
    }
  ];

  for (const { query, description } of searchQueries) {
    try {
      console.log(`\n🔎 Testing: ${description}`);
      console.log(`Query: "${query}"`);
      
      const startTime = Date.now();
      const response = await axios.get(`${BASE_URL}/api/search`, {
        params: {
          query,
          searchMode: 'hybrid',
          includeHighlights: true,
          limit: 5
        }
      });
      const requestTime = Date.now() - startTime;

      if (response.data.success) {
        const { results, totalResults, searchTime } = response.data.data;
        console.log(`✅ Found ${totalResults} results in ${searchTime}ms (request: ${requestTime}ms)`);
        
        results.forEach((result: SearchResult, index: number) => {
          console.log(`  ${index + 1}. ${result.title} (score: ${result.relevanceScore.toFixed(2)})`);
          if (result.highlights && result.highlights.length > 0 && result.highlights[0]) {
            console.log(`     Highlights: ${result.highlights[0].fragments.join(', ')}`);
          }
        });
      } else {
        console.log(`❌ Search failed:`, response.data);
      }
    } catch (error: any) {
      console.error(`❌ Search error:`, error.response?.data || error.message);
    }
  }
}

async function testSearchModes(): Promise<void> {
  console.log('\n🎯 Testing different search modes...');
  
  const testQuery = 'meditation anxiety';
  const searchModes = ['hybrid', 'fulltext', 'semantic'] as const;
  
  for (const mode of searchModes) {
    try {
      console.log(`\n🔍 Testing ${mode.toUpperCase()} search mode:`);
      
      const response = await axios.get(`${BASE_URL}/api/search`, {
        params: {
          query: testQuery,
          searchMode: mode,
          limit: 3
        }
      });

      if (response.data.success) {
        const { results, totalResults, searchTime } = response.data.data;
        console.log(`✅ ${mode}: ${totalResults} results in ${searchTime}ms`);
        
        results.forEach((result: SearchResult, index: number) => {
          console.log(`  ${index + 1}. ${result.title} (score: ${result.relevanceScore.toFixed(2)})`);
        });
      }
    } catch (error: any) {
      console.error(`❌ ${mode} search error:`, error.response?.data || error.message);
    }
  }
}

async function main(): Promise<void> {
  console.log('🧪 DataCollector Search Integration Test');
  console.log('=========================================\n');

  // Check environment
  const envInfo = getEnvironmentInfo();
  console.log('🔧 Environment Status:');
  console.log(`  OpenAI API Key: ${envInfo.hasOpenAIKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  Node Environment: ${envInfo.nodeEnv}`);
  console.log(`  Services: ${JSON.stringify(envInfo.servicesConfigured)}\n`);

  // Wait for server to be ready
  console.log('⏳ Waiting for backend server...');
  const serverReady = await waitForServer();
  if (!serverReady) {
    console.error('❌ Server is not responding. Make sure the backend is running.');
    process.exit(1);
  }

  // Check search engine health
  console.log('\n🏥 Checking search engine health...');
  const searchHealthy = await checkSearchHealth();
  if (!searchHealthy) {
    console.log('⚠️ Search engine may not be fully operational, but continuing with tests...');
  }

  // Index sample documents
  await indexSampleDocuments();

  // Allow time for indexing to complete
  console.log('\n⏳ Waiting for indexing to complete...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test search queries
  await testSearchQueries();

  // Test different search modes
  await testSearchModes();

  console.log('\n🎉 Search integration test completed!');
  console.log('\n📋 Next Steps:');
  console.log('  1. Index the 32 processed mental health transcription files');
  console.log('  2. Test search with real content data');
  console.log('  3. Connect frontend search interface');
  console.log('  4. Implement advanced search filters');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
} 