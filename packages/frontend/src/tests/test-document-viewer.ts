import { documentsApi } from '../services/api';

/**
 * Test document viewer integration
 */
async function testDocumentViewer() {
  console.log('🧪 Testing Document Viewer Integration...\n');

  try {
    // Test 1: Get document by ID
    console.log('📄 Test 1: Get document by ID');
    const documentId = 'demo-1';
    const document = await documentsApi.getDocument(documentId);
    console.log('✅ Document retrieved:', {
      id: document.id,
      title: document.title,
      fileType: document.fileType,
      fileSize: document.fileSize
    });

    // Test 2: Get document content
    console.log('\n📄 Test 2: Get document content');
    const content = await documentsApi.getDocumentContent(documentId);
    console.log('✅ Document content retrieved:', {
      contentLength: content.content.length,
      hasHighlights: !!content.highlights,
      metadata: content.metadata
    });

    // Test 3: Download document
    console.log('\n📄 Test 3: Download document');
    const blob = await documentsApi.downloadDocument(documentId, 'txt');
    console.log('✅ Document downloaded:', {
      size: blob.size,
      type: blob.type
    });

    console.log('\n🎉 All document viewer tests passed!');
    console.log('\n📋 Summary:');
    console.log('- Document retrieval: ✅');
    console.log('- Content extraction: ✅');
    console.log('- File download: ✅');
    console.log('- API integration: ✅');

  } catch (error) {
    console.error('❌ Document viewer test failed:', error);
    throw error;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDocumentViewer()
    .then(() => {
      console.log('\n✅ Document viewer integration test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Document viewer integration test failed:', error);
      process.exit(1);
    });
}

export { testDocumentViewer }; 