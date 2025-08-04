import winston from 'winston';
import { ArXivScraper } from '../services/scrapers/ArXivScraper';
import { createDefaultScrapingConfig } from '../services/scrapers/BaseScraper';

// Create a simple logger for testing
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.colorize({ all: true })
    })
  ]
});

async function testArXivPdfDownload() {
  logger.info('🧪 Testing arXiv PDF Download Functionality...');

  const config = createDefaultScrapingConfig();
  const scraper = new ArXivScraper(config, logger);

  try {
    // Initialize the scraper
    await scraper.initialize();
    logger.info('✅ arXiv scraper initialized');

    // Test PDF URL extraction from a known arXiv paper
    const testUrl = 'https://arxiv.org/abs/1706.03762'; // "Attention Is All You Need" paper
    logger.info(`📄 Testing PDF extraction for: ${testUrl}`);

    const documentData = await scraper.extractDocument(testUrl);
    
    logger.info('📊 Document extraction results:');
    logger.info(`  Title: ${documentData.title || 'N/A'}`);
    logger.info(`  Authors: ${documentData.authors?.join(', ') || 'N/A'}`);
    logger.info(`  ArXiv ID: ${documentData.arxivId || 'N/A'}`);
    logger.info(`  PDF URL: ${documentData.pdfUrl || 'N/A'}`);
    logger.info(`  Submission Date: ${documentData.submissionDate || 'N/A'}`);
    
    // Verify PDF URL format
    if (documentData.pdfUrl) {
      const expectedPdfPattern = /https:\/\/arxiv\.org\/pdf\/\d+\.\d+\.pdf/;
      if (expectedPdfPattern.test(documentData.pdfUrl)) {
        logger.info('✅ PDF URL format is correct');
      } else {
        logger.warn('⚠️ PDF URL format may be incorrect:', documentData.pdfUrl);
      }
    } else {
      logger.warn('⚠️ No PDF URL extracted');
    }

    // Test multiple papers to verify consistency
    const testPapers = [
      'https://arxiv.org/abs/2010.11929', // GPT-3 paper
      'https://arxiv.org/abs/1810.04805'  // BERT paper
    ];

    for (const paperUrl of testPapers) {
      try {
        logger.info(`📄 Testing additional paper: ${paperUrl}`);
        const data = await scraper.extractDocument(paperUrl);
        
        if (data.pdfUrl) {
          logger.info(`✅ PDF URL extracted: ${data.pdfUrl}`);
        } else {
          logger.warn(`⚠️ No PDF URL for: ${paperUrl}`);
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.warn(`⚠️ Failed to extract document ${paperUrl}:`, (error as Error).message);
      }
    }

    logger.info('✅ arXiv PDF download test completed successfully!');
    return true;

  } catch (error) {
    logger.error('❌ arXiv PDF download test failed:', error);
    return false;
  } finally {
    // Cleanup
    await scraper.cleanup();
    logger.info('🧹 arXiv scraper cleaned up');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testArXivPdfDownload()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test failed with error:', error);
      process.exit(1);
    });
}

export { testArXivPdfDownload };