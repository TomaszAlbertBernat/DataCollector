import { Browser, BrowserContext, Page, chromium } from 'playwright';
import winston from 'winston';

export interface ScrapingConfig {
  userAgent: string;
  headless: boolean;
  timeout: number;
  retryAttempts: number;
  delayBetweenRequests: number;
  maxConcurrentPages: number;
  useProxy?: boolean;
  proxyUrls?: string[];
}

export interface ScrapingResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    url: string;
    timestamp: Date;
    responseTime: number;
    source: string;
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  authors?: string[];
  publicationDate?: string;
  journal?: string;
  citations?: number;
  pdfUrl?: string;
  metadata: Record<string, any>;
}

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected config: ScrapingConfig;
  protected logger: winston.Logger;
  protected activePagesCount = 0;
  protected lastRequestTime = 0;

  constructor(config: ScrapingConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize browser and context
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing browser for scraping');

      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      this.context = await this.browser.newContext({
        userAgent: this.config.userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // Block unnecessary resources to speed up scraping
      await this.context.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font', 'other'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      this.logger.info('Browser initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize browser', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.logger.info('Browser cleanup completed');
    } catch (error) {
      this.logger.error('Error during browser cleanup', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Create a new page with anti-detection measures
   */
  protected async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    if (this.activePagesCount >= this.config.maxConcurrentPages) {
      throw new Error(`Maximum concurrent pages (${this.config.maxConcurrentPages}) reached`);
    }

    const page = await this.context.newPage();
    this.activePagesCount++;

    // Set additional anti-detection measures
    await page.addInitScript(() => {
      const win = globalThis as any;
      // Remove webdriver property
      delete win.navigator.webdriver;
      
      // Mock languages and plugins
      Object.defineProperty(win.navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      Object.defineProperty(win.navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
    });

    // Set timeout
    page.setDefaultTimeout(this.config.timeout);

    // Handle page close
    page.on('close', () => {
      this.activePagesCount--;
    });

    return page;
  }

  /**
   * Navigate to URL with rate limiting and retry logic
   */
  protected async navigateWithRetry(page: Page, url: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Rate limiting
        await this.enforceRateLimit();

        this.logger.debug('Navigating to URL', {
          url,
          attempt,
          maxAttempts: this.config.retryAttempts
        });

        const startTime = Date.now();
        
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.config.timeout
        });

        const responseTime = Date.now() - startTime;
        this.logger.debug('Navigation successful', {
          url,
          responseTime: `${responseTime}ms`
        });

        return;

      } catch (error) {
        lastError = error as Error;
        this.logger.warn('Navigation attempt failed', {
          url,
          attempt,
          error: lastError.message
        });

        if (attempt < this.config.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to navigate to ${url} after ${this.config.retryAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Enforce rate limiting between requests
   */
  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.delayBetweenRequests) {
      const delay = this.config.delayBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Extract text content safely
   */
  protected async safeTextContent(page: Page, selector: string): Promise<string> {
    try {
      const element = await page.$(selector);
      if (!element) return '';
      
      const text = await element.textContent();
      return text?.trim() || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Extract attribute safely
   */
  protected async safeAttribute(page: Page, selector: string, attribute: string): Promise<string> {
    try {
      const element = await page.$(selector);
      if (!element) return '';
      
      const attr = await element.getAttribute(attribute);
      return attr?.trim() || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Wait for element with timeout
   */
  protected async waitForElementSafely(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if page is blocked or shows CAPTCHA
   */
  protected async checkForBlocking(page: Page): Promise<boolean> {
    const blockingIndicators = [
      'captcha',
      'recaptcha',
      'blocked',
      'access denied',
      'security check',
      'unusual traffic'
    ];

    try {
      const pageContent = await page.content();
      const lowercaseContent = pageContent.toLowerCase();

      return blockingIndicators.some(indicator => 
        lowercaseContent.includes(indicator)
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle potential CAPTCHA or blocking
   */
  protected async handleBlocking(page: Page): Promise<void> {
    this.logger.warn('Potential blocking detected, implementing countermeasures');

    // Add random delay
    const delay = Math.random() * 3000 + 2000; // 2-5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));

    // Simulate human-like mouse movement
    await page.mouse.move(
      Math.random() * 800 + 100,
      Math.random() * 600 + 100
    );

    // Scroll randomly
    await page.evaluate(() => {
      (globalThis as any).scrollTo(0, Math.random() * 1000);
    });
  }

  /**
   * Abstract method for implementing specific search logic
   */
  abstract search(query: string, options?: any): Promise<SearchResult[]>;

  /**
   * Abstract method for extracting document content
   */
  abstract extractDocument(url: string): Promise<any>;

  /**
   * Get scraper-specific configuration
   */
  abstract getScraperInfo(): {
    name: string;
    supportedDomains: string[];
    maxResultsPerQuery: number;
    rateLimit: number; // requests per minute
  };
}

// Default scraping configuration
export const createDefaultScrapingConfig = (): ScrapingConfig => ({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  headless: true,
  timeout: 30000,
  retryAttempts: 3,
  delayBetweenRequests: 2000, // 2 seconds
  maxConcurrentPages: 3,
  useProxy: false,
  proxyUrls: []
});

// Utility function to create random delays for human-like behavior
export const randomDelay = (min: number = 500, max: number = 2000): Promise<void> => {
  const delay = Math.random() * (max - min) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}; 