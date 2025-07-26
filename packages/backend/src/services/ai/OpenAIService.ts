import OpenAI from 'openai';
import winston from 'winston';

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  embeddingModel: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface EmbeddingOptions {
  input: string | string[];
  model?: string;
}

export interface ChatCompletionResult {
  content: string;
  tokensUsed: number;
  model: string;
  finishReason: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  tokensUsed: number;
  model: string;
}

export class OpenAIService {
  private client: OpenAI;
  private logger: winston.Logger;
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout
    });

    this.logger.info('OpenAI service initialized', {
      model: config.model,
      embeddingModel: config.embeddingModel
    });
  }

  /**
   * Generate chat completion using OpenAI API
   */
  async generateChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    try {
      const startTime = Date.now();

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: options.messages,
        temperature: options.temperature ?? this.config.temperature,
        max_tokens: options.maxTokens ?? this.config.maxTokens,
        stream: false
      });

      const duration = Date.now() - startTime;
      const choice = response.choices[0];
      const content = choice?.message?.content || '';

      this.logger.debug('Chat completion generated', {
        model: response.model,
        tokensUsed: response.usage?.total_tokens || 0,
        duration: `${duration}ms`,
        finishReason: choice?.finish_reason
      });

      return {
        content,
        tokensUsed: response.usage?.total_tokens || 0,
        model: response.model,
        finishReason: choice?.finish_reason || 'unknown'
      };

    } catch (error) {
      this.logger.error('Chat completion failed', {
        error: (error as Error).message,
        messages: options.messages.length
      });
      throw new Error(`OpenAI chat completion failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate embeddings using OpenAI API
   */
  async generateEmbeddings(options: EmbeddingOptions): Promise<EmbeddingResult> {
    try {
      const startTime = Date.now();

      const response = await this.client.embeddings.create({
        model: options.model ?? this.config.embeddingModel,
        input: options.input,
        encoding_format: 'float'
      });

      const duration = Date.now() - startTime;
      const embeddings = response.data.map(item => item.embedding);

      this.logger.debug('Embeddings generated', {
        model: response.model,
        tokensUsed: response.usage?.total_tokens || 0,
        duration: `${duration}ms`,
        embeddingCount: embeddings.length
      });

      return {
        embeddings,
        tokensUsed: response.usage?.total_tokens || 0,
        model: response.model
      };

    } catch (error) {
      this.logger.error('Embedding generation failed', {
        error: (error as Error).message,
        inputType: typeof options.input,
        inputLength: Array.isArray(options.input) ? options.input.length : 1
      });
      throw new Error(`OpenAI embedding generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate embeddings for text chunks in batches
   */
  async generateEmbeddingsBatch(
    texts: string[], 
    batchSize: number = 100
  ): Promise<{ embeddings: number[][]; totalTokens: number }> {
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      this.logger.debug('Processing embedding batch', {
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(texts.length / batchSize)
      });

      try {
        const result = await this.generateEmbeddings({ input: batch });
        allEmbeddings.push(...result.embeddings);
        totalTokens += result.tokensUsed;

        // Rate limiting - wait between batches
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        this.logger.error('Batch embedding failed', {
          batchIndex: Math.floor(i / batchSize) + 1,
          error: (error as Error).message
        });
        throw error;
      }
    }

    this.logger.info('Batch embedding completed', {
      totalTexts: texts.length,
      totalTokens,
      totalEmbeddings: allEmbeddings.length
    });

    return { embeddings: allEmbeddings, totalTokens };
  }

  /**
   * Validate API key and test connection
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });

      this.logger.info('OpenAI connection validated successfully');
      return true;

    } catch (error) {
      this.logger.error('OpenAI connection validation failed', {
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): {
    model: string;
    embeddingModel: string;
    maxTokens: number;
    temperature: number;
  } {
    return {
      model: this.config.model,
      embeddingModel: this.config.embeddingModel,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature
    };
  }
}

// Factory function for creating OpenAI service
export const createOpenAIService = (logger: winston.Logger): OpenAIService => {
  const config: OpenAIConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    temperature: Number(process.env.OPENAI_TEMPERATURE) || 0.1,
    maxTokens: Number(process.env.OPENAI_MAX_TOKENS) || 4000,
    timeout: Number(process.env.OPENAI_TIMEOUT) || 30000
  };

  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new OpenAIService(config, logger);
}; 