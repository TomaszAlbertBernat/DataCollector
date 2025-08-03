import winston from 'winston';
import { PubMedScraper } from '../services/scrapers/PubMedScraper';
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

async function testPubMedScraper() {
  logger.info('🧪 Testing PubMed Scraper...');

  const config = createDefaultScrapingConfig();
  const scraper = new PubMedScraper(config, logger);

  try {
    // Initialize the scraper
    await scraper.initialize();
    logger.info('✅ PubMed scraper initialized');

    // Test search functionality
    const query = 'machine learning';
    logger.info(`🔍 Searching PubMed for: "${query}"`);

    const results = await scraper.search(query, { maxResults: 5 });
    
    logger.info(`📊 Found ${results.length} results from PubMed`);
    
    // Log the first few results
    results.slice(0, 3).forEach((result, index) => {
      logger.info(`Result ${index + 1}:`);
      logger.info(`  Title: ${result.title}`);
      logger.info(`  URL: ${result.url}`);
      logger.info(`  Authors: ${result.authors?.join(', ') || 'N/A'}`);
      logger.info(`  Journal: ${result.journal || 'N/A'}`);
      logger.info(`  Year: ${result.publicationDate || 'N/A'}`);
      logger.info(`  Snippet: ${result.snippet.substring(0, 100)}...`);
      logger.info('');
    });

    // Test scraper info
    const info = scraper.getScraperInfo();
    logger.info('📋 Scraper Info:', info);

    logger.info('✅ PubMed scraper test completed successfully!');
    return true;

  } catch (error) {
    logger.error('❌ PubMed scraper test failed:', error);
    return false;
  } finally {
    // Cleanup
    await scraper.cleanup();
    logger.info('🧹 PubMed scraper cleaned up');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPubMedScraper()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test failed with error:', error);
      process.exit(1);
    });
}

export { testPubMedScraper }; 