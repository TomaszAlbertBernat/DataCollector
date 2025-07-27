import OpenAI from 'openai';
import { createHash } from 'crypto';
import { TextChunk } from '../processing/FileProcessor';

export interface EmbeddingOptions {
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  enableCaching?: boolean;
  cacheExpiry?: number; // in seconds
}

export interface EmbeddingResult {
  success: boolean;
  embeddings?: number[][];
  error?: string;
  processingTime?: number;
  cached?: boolean;
}

export interface EmbeddingCache {
  [key: string]: {
    embedding: number[];
    timestamp: number;
  };
}

export class EmbeddingGenerator {
  private openai: OpenAI;
  private options: EmbeddingOptions;
  private cache: EmbeddingCache = {};
  private cacheExpiry: number;

  constructor(
    apiKey: string,
    options: EmbeddingOptions = {}
  ) {
    this.openai = new OpenAI({
      apiKey,
      timeout: options.timeout || 30000
    });

    this.options = {
      model: 'text-embedding-3-small',
      batchSize: 100,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableCaching: true,
      cacheExpiry: 24 * 60 * 60, // 24 hours
      ...options
    };

    this.cacheExpiry = this.options.cacheExpiry || 24 * 60 * 60;
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(text);
      if (this.options.enableCaching) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          return {
            success: true,
            embeddings: [cached],
            processingTime: Date.now() - startTime,
            cached: true
          };
        }
      }

      // Generate embedding
      const embedding = await this.callOpenAIEmbeddingAPI([text]);
      
      if (embedding.success && embedding.embeddings && embedding.embeddings.length > 0) {
        // Cache the result
        if (this.options.enableCaching && embedding.embeddings[0]) {
          this.addToCache(cacheKey, embedding.embeddings[0]);
        }

        return {
          success: true,
          embeddings: embedding.embeddings,
          processingTime: Date.now() - startTime,
          cached: false
        };
      }

      return embedding;

    } catch (error) {
      return {
        success: false,
        error: `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate embeddings for multiple texts with batching
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      if (texts.length === 0) {
        return {
          success: true,
          embeddings: [],
          processingTime: Date.now() - startTime
        };
      }

      const allEmbeddings: number[][] = [];
      const batchSize = this.options.batchSize || 100;

      // Process in batches
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch);
        
        if (!batchResult.success) {
          return batchResult;
        }

        if (batchResult.embeddings) {
          allEmbeddings.push(...batchResult.embeddings);
        }
      }

      return {
        success: true,
        embeddings: allEmbeddings,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate embeddings for text chunks
   */
  async generateChunkEmbeddings(chunks: TextChunk[]): Promise<EmbeddingResult> {
    const texts = chunks.map(chunk => chunk.text);
    return this.generateEmbeddings(texts);
  }

  /**
   * Process a batch of texts
   */
  private async processBatch(texts: string[]): Promise<EmbeddingResult> {
    const startTime = Date.now();

    try {
      // Check cache for all texts first
      const uncachedTexts: string[] = [];
      const cachedEmbeddings: number[][] = [];
      const cacheKeys: string[] = [];

      for (const text of texts) {
        const cacheKey = this.generateCacheKey(text);
        cacheKeys.push(cacheKey);

        if (this.options.enableCaching) {
          const cached = this.getFromCache(cacheKey);
          if (cached) {
            cachedEmbeddings.push(cached);
          } else {
            uncachedTexts.push(text);
          }
        } else {
          uncachedTexts.push(text);
        }
      }

      // Generate embeddings for uncached texts
      let newEmbeddings: number[][] = [];
      if (uncachedTexts.length > 0) {
        const apiResult = await this.callOpenAIEmbeddingAPI(uncachedTexts);
        
        if (!apiResult.success) {
          return apiResult;
        }

        newEmbeddings = apiResult.embeddings || [];

        // Cache new embeddings
        if (this.options.enableCaching) {
          for (let i = 0; i < uncachedTexts.length; i++) {
            const text = uncachedTexts[i];
            const embedding = newEmbeddings[i];
            if (text && embedding) {
              const cacheKey = this.generateCacheKey(text);
              this.addToCache(cacheKey, embedding);
            }
          }
        }
      }

      // Combine cached and new embeddings in original order
      const allEmbeddings: number[][] = [];
      let cachedIndex = 0;
      let newIndex = 0;

      for (let i = 0; i < texts.length; i++) {
        const cacheKey = cacheKeys[i];
        if (cacheKey) {
          const cached = this.getFromCache(cacheKey);
          
          if (cached) {
            allEmbeddings.push(cached);
            cachedIndex++;
          } else {
            const embedding = newEmbeddings[newIndex];
            if (embedding) {
              allEmbeddings.push(embedding);
            }
            newIndex++;
          }
        }
      }

      return {
        success: true,
        embeddings: allEmbeddings,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Call OpenAI embedding API with retry logic
   */
  private async callOpenAIEmbeddingAPI(texts: string[]): Promise<EmbeddingResult> {
    let retries = 0;
    const maxRetries = this.options.maxRetries || 3;

    while (retries <= maxRetries) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.options.model || 'text-embedding-3-small',
          input: texts,
          encoding_format: 'float'
        });

        const embeddings = response.data.map(item => item.embedding);

        return {
          success: true,
          embeddings
        };

      } catch (error: any) {
        retries++;
        
        // Check if it's a rate limit error
        if (error?.status === 429 && retries <= maxRetries) {
          const retryAfter = error?.headers?.['retry-after'] ?? this.options.retryDelay ?? 1000;
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
          continue;
        }

        // Check if it's a timeout error
        if (error?.code === 'ECONNABORTED' && retries <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay || 1000));
          continue;
        }

        // For other errors or max retries reached
        return {
          success: false,
          error: `OpenAI API error: ${error?.message || 'Unknown error'}`
        };
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded for OpenAI API call'
    };
  }

  /**
   * Generate cache key for text
   */
  private generateCacheKey(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  /**
   * Get embedding from cache
   */
  private getFromCache(key: string): number[] | null {
    const cached = this.cache[key];
    if (!cached) return null;

    // Check if cache entry has expired
    const now = Date.now();
    if (now - cached.timestamp > this.cacheExpiry * 1000) {
      delete this.cache[key];
      return null;
    }

    return cached.embedding;
  }

  /**
   * Add embedding to cache
   */
  private addToCache(key: string, embedding: number[]): void {
    this.cache[key] = {
      embedding,
      timestamp: Date.now()
    };

    // Clean up old cache entries periodically
    this.cleanupCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys = Object.keys(this.cache).filter(key => {
      const entry = this.cache[key];
      return entry && now - entry.timestamp > this.cacheExpiry * 1000;
    });

    expiredKeys.forEach(key => delete this.cache[key]);
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): Record<string, any> {
    const now = Date.now();
    const validEntries = Object.values(this.cache).filter(
      entry => now - entry.timestamp <= this.cacheExpiry * 1000
    );

    return {
      totalEntries: Object.keys(this.cache).length,
      validEntries: validEntries.length,
      cacheExpiry: this.cacheExpiry,
      enableCaching: this.options.enableCaching
    };
  }

  /**
   * Get embedding model information
   */
  getModelInfo(): Record<string, any> {
    return {
      model: this.options.model,
      batchSize: this.options.batchSize,
      maxRetries: this.options.maxRetries,
      retryDelay: this.options.retryDelay,
      timeout: this.options.timeout
    };
  }

  /**
   * Test OpenAI API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.generateEmbedding('test');
      return { success: result.success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 