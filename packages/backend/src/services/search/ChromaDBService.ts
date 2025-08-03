import { ChromaClient, Collection } from 'chromadb';
import winston from 'winston';
import { EmbeddingGenerator } from '../ai/EmbeddingGenerator';

export interface ChromaDBConfig {
  url: string;
  collectionName: string;
  embeddingDimension: number;
  distanceFunction: 'cosine' | 'euclidean' | 'manhattan';
}

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface SimilaritySearchQuery {
  query: string;
  embedding?: number[];
  nResults?: number;
  where?: Record<string, any>;
  whereDocument?: Record<string, any>;
  include?: string[];
}

export interface SimilaritySearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  distance: number;
  embedding?: number[];
}

export interface SimilaritySearchResponse {
  results: SimilaritySearchResult[];
  totalResults: number;
  searchTime: number;
}

export class ChromaDBService {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private logger: winston.Logger;
  private config: ChromaDBConfig;
  private embeddingGenerator: EmbeddingGenerator;
  private initialized = false;

  constructor(config: ChromaDBConfig, embeddingGenerator: EmbeddingGenerator, logger: winston.Logger) {
    this.config = config;
    this.embeddingGenerator = embeddingGenerator;
    this.logger = logger;
    
    this.client = new ChromaClient({
      path: config.url,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get or create collection
      this.collection = await this.getOrCreateCollection();
      
      this.initialized = true;
      this.logger.info('ChromaDB service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ChromaDB service:', error as Error);
      throw error;
    }
  }

  private async getOrCreateCollection(): Promise<Collection> {
    try {
      // Try to get existing collection
      const collection = await this.client.getCollection({
        name: this.config.collectionName
      } as any);
      
      this.logger.info(`Using existing ChromaDB collection: ${this.config.collectionName}`);
      return collection;
    } catch (error) {
      // Collection doesn't exist, create it
      this.logger.info(`Creating new ChromaDB collection: ${this.config.collectionName}`);
      
      return await this.client.createCollection({
        name: this.config.collectionName,
        metadata: {
          description: 'Document embeddings for semantic search',
          embeddingDimension: this.config.embeddingDimension,
          distanceFunction: this.config.distanceFunction,
        },
      });
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    if (documents.length === 0) return;

    try {
      const ids = documents.map(doc => doc.id);
      const contents = documents.map(doc => doc.content);
      const metadatas = documents.map(doc => doc.metadata);
      
      // Generate embeddings using our OpenAI service
      let embeddings: number[][] = [];
      if (documents.some(doc => !doc.embedding)) {
        // Generate embeddings for documents that don't have them
        const textsToEmbed = documents
          .filter(doc => !doc.embedding)
          .map(doc => doc.content);
        
        if (textsToEmbed.length > 0) {
          const embeddingResult = await this.embeddingGenerator.generateEmbeddings(textsToEmbed);
          if (embeddingResult.success && embeddingResult.embeddings) {
            embeddings = embeddingResult.embeddings;
          } else {
            throw new Error(`Failed to generate embeddings: ${embeddingResult.error}`);
          }
        }
      }
      
      // Combine provided embeddings with generated ones
      const finalEmbeddings: number[][] = [];
      let generatedIndex = 0;
      
      for (const doc of documents) {
        if (doc.embedding) {
          finalEmbeddings.push(doc.embedding);
        } else if (generatedIndex < embeddings.length) {
          const embedding = embeddings[generatedIndex];
          if (embedding) {
            finalEmbeddings.push(embedding);
            generatedIndex++;
          } else {
            throw new Error(`Generated embedding is null for document ${doc.id}`);
          }
        } else {
          throw new Error(`Missing embedding for document ${doc.id}`);
        }
      }

      await this.collection.add({
        ids,
        documents: contents,
        metadatas,
        embeddings: finalEmbeddings,
      });

      this.logger.info(`Added ${documents.length} documents to ChromaDB with embeddings`);
    } catch (error) {
      this.logger.error('Failed to add documents to ChromaDB:', error as Error);
      throw error;
    }
  }

  async updateDocument(documentId: string, updates: Partial<VectorDocument>): Promise<void> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    try {
      const updateData: any = { id: documentId };
      
      if (updates.content !== undefined) {
        updateData.document = updates.content;
      }
      
      if (updates.metadata !== undefined) {
        updateData.metadata = updates.metadata;
      }
      
      if (updates.embedding !== undefined) {
        updateData.embedding = updates.embedding;
      }

      await this.collection.update(updateData);
      
      this.logger.debug(`Updated document in ChromaDB: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to update document ${documentId} in ChromaDB:`, error as Error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    try {
      await this.collection.delete({
        ids: [documentId],
      });

      this.logger.debug(`Deleted document from ChromaDB: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId} from ChromaDB:`, error as Error);
      throw error;
    }
  }

  async similaritySearch(query: SimilaritySearchQuery): Promise<SimilaritySearchResponse> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    const startTime = Date.now();

    try {
      const searchParams: any = {
        nResults: query.nResults || 10,
      };

      if (query.embedding) {
        searchParams.queryEmbeddings = [query.embedding];
      } else if (query.query) {
        searchParams.queryTexts = [query.query];
      } else {
        throw new Error('Either query text or embedding must be provided');
      }

      if (query.where) {
        searchParams.where = query.where;
      }

      if (query.whereDocument) {
        searchParams.whereDocument = query.whereDocument;
      }

      if (query.include) {
        searchParams.include = query.include;
      }

      const response = await this.collection.query(searchParams);

      const results: SimilaritySearchResult[] = [];
      const distances = response.distances?.[0] || [];
      const documents = response.documents?.[0] || [];
      const metadatas = response.metadatas?.[0] || [];
      const embeddings = response.embeddings?.[0] || [];
      const ids = response.ids?.[0] || [];

      for (let i = 0; i < ids.length; i++) {
        results.push({
          id: ids[i] || '',
          content: documents[i] || '',
          metadata: metadatas[i] || {},
          distance: distances[i] || 0,
          ...(embeddings[i] && { embedding: embeddings[i] as number[] }),
        });
      }

      const searchTime = Date.now() - startTime;

      return {
        results,
        totalResults: results.length,
        searchTime,
      };
    } catch (error) {
      this.logger.error('Similarity search failed:', error as Error);
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<VectorDocument | null> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    try {
      const response = await this.collection.get({
        ids: [documentId],
        include: ['documents', 'metadatas', 'embeddings'] as any,
      });

      if (response.ids?.[0]?.length === 0) {
        return null;
      }

      return {
        id: response.ids?.[0]?.[0] || '',
        content: response.documents?.[0]?.[0] || '',
        metadata: (response.metadatas?.[0]?.[0] as unknown as Record<string, any>) || {},
        ...(response.embeddings?.[0]?.[0] && { embedding: response.embeddings[0][0] as unknown as number[] }),
      };
    } catch (error) {
      this.logger.error(`Failed to get document ${documentId} from ChromaDB:`, error as Error);
      throw error;
    }
  }

  async getCollectionStats(): Promise<any> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    try {
      const count = await this.collection.count();
      
      return {
        collectionName: this.config.collectionName,
        documentCount: count,
        embeddingDimension: this.config.embeddingDimension,
        distanceFunction: this.config.distanceFunction,
      };
    } catch (error) {
      this.logger.error('Failed to get collection stats:', error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to get collection info to check if service is responsive
      if (this.collection) {
        await this.collection.count();
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('ChromaDB health check failed:', error as Error);
      return false;
    }
  }

  async clearCollection(): Promise<void> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    try {
      await this.collection.delete({
        where: {}, // Delete all documents
      });

      this.logger.info('Cleared ChromaDB collection');
    } catch (error) {
      this.logger.error('Failed to clear ChromaDB collection:', error as Error);
      throw error;
    }
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.collection) {
      throw new Error('ChromaDB service not initialized');
    }

    try {
      // This would typically use an embedding model
      // For now, we'll return a placeholder
      // In a real implementation, you'd use OpenAI embeddings or similar
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        // Placeholder: generate random embeddings for demo
        const embedding = new Array(this.config.embeddingDimension)
          .fill(0)
          .map(() => Math.random() - 0.5);
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate embeddings:', error as Error);
      throw error;
    }
  }
}

export const createChromaDBService = (
  config: ChromaDBConfig,
  embeddingGenerator: EmbeddingGenerator,
  logger: winston.Logger
): ChromaDBService => {
  return new ChromaDBService(config, embeddingGenerator, logger);
}; 