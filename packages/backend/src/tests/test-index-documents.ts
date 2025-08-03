import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

const testDocuments = [
  {
    id: 'test-001',
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
    id: 'test-002',
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
    id: 'test-003',
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
  },
  {
    id: 'test-004',
    title: 'Digital Wellness and Mental Health in the Modern Age',
    content: 'The digital age has brought new challenges to mental health. Social media, constant connectivity, and information overload can contribute to anxiety and depression. Digital wellness practices include setting boundaries, digital detox periods, and mindful technology use. Balancing online and offline life is essential for mental well-being.',
    source: 'Mental Health Transcription',
    authors: ['Dr. K', 'Healthy Gamer'],
    fileType: 'text',
    metadata: {
      category: 'digital_health',
      topic: 'digital_wellness',
      focus: ['social_media', 'technology_balance']
    }
  },
  {
    id: 'test-005',
    title: 'Building Resilience Through Cognitive Behavioral Therapy',
    content: 'Cognitive Behavioral Therapy (CBT) is an evidence-based approach to building mental resilience. It helps individuals identify and challenge negative thought patterns, develop coping strategies, and build healthier behavioral responses. CBT techniques can be applied to various mental health challenges including anxiety, depression, and stress management.',
    source: 'Mental Health Transcription',
    authors: ['Dr. K', 'Healthy Gamer'],
    fileType: 'text',
    metadata: {
      category: 'therapy',
      topic: 'CBT',
      techniques: ['cognitive_restructuring', 'behavioral_activation']
    }
  }
];

async function indexDocuments() {
  console.log('📄 Indexing test documents...');
  
  for (const doc of testDocuments) {
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

async function testSearch() {
  console.log('\n🔍 Testing search functionality...');
  
  const searchQueries = [
    'meditation',
    'anxiety',
    'depression',
    'CBT',
    'digital wellness'
  ];

  for (const query of searchQueries) {
    try {
      console.log(`\n🔎 Testing query: "${query}"`);
      
      const response = await axios.get(`${BASE_URL}/api/search`, {
        params: {
          query,
          searchMode: 'fulltext',
          limit: 5
        }
      });

      if (response.data.success) {
        const { results, totalResults, searchTime } = response.data.data;
        console.log(`✅ Found ${totalResults} results in ${searchTime}ms`);
        
        results.forEach((result: any, index: number) => {
          console.log(`  ${index + 1}. ${result.title} (score: ${result.relevanceScore?.toFixed(2) || 'N/A'})`);
        });
      } else {
        console.log(`❌ Search failed:`, response.data);
      }
    } catch (error: any) {
      console.error(`❌ Search error:`, error.response?.data || error.message);
    }
  }
}

async function main() {
  console.log('🧪 DataCollector Document Indexing Test');
  console.log('=========================================\n');

  // Index documents
  await indexDocuments();

  // Wait a moment for indexing to complete
  console.log('\n⏳ Waiting for indexing to complete...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test search
  await testSearch();

  console.log('\n🎉 Test completed!');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
} 