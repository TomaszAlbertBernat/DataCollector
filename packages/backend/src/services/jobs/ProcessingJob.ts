import { BaseJob } from './BaseJob';
import { JobStatus, JobType, JobData, JobMetadata, ILogger, IStatusNotifier, IServiceContainer, IConfig } from '../../types/job';
import { ContentDownloader, DownloadResult } from '../download/ContentDownloader';
import { FileProcessor, ProcessingResult } from '../processing/FileProcessor';
import { EmbeddingGenerator, EmbeddingResult } from '../ai/EmbeddingGenerator';
import { ProcessedFile } from '../../types/job';

export interface ProcessingJobData extends JobData {
  type: JobType.PROCESSING;
  metadata: ProcessingJobMetadata;
}

export interface ProcessingJobMetadata extends JobMetadata {
  downloadUrls?: string[];
  processedFiles?: ProcessedFile[];
  processingOptions?: {
    chunkSize?: number;
    chunkOverlap?: number;
    generateEmbeddings?: boolean;
  };
}

export interface ProcessingJobOptions {
  downloadDirectory?: string;
  maxConcurrentDownloads?: number;
  processingOptions?: {
    chunkSize?: number;
    chunkOverlap?: number;
    maxTextLength?: number;
  };
  embeddingOptions?: {
    model?: string;
    batchSize?: number;
    enableCaching?: boolean;
  };
}

export class ProcessingJob extends BaseJob {
  private contentDownloader: ContentDownloader;
  private fileProcessor: FileProcessor;
  private embeddingGenerator?: EmbeddingGenerator;
  private options: ProcessingJobOptions;

  constructor(
    jobData: ProcessingJobData,
    logger: ILogger,
    statusNotifier: IStatusNotifier,
    services: IServiceContainer,
    config: IConfig,
    options: ProcessingJobOptions = {}
  ) {
    super(jobData, logger, statusNotifier, services, config);
    this.options = options;

    // Initialize services
    this.contentDownloader = new ContentDownloader(
      options.downloadDirectory,
      options.maxConcurrentDownloads,
      {
        timeout: 30000,
        maxRetries: 3,
        maxFileSize: 100 * 1024 * 1024 // 100MB
      }
    );

    this.fileProcessor = new FileProcessor({
      chunkSize: options.processingOptions?.chunkSize || 1000,
      chunkOverlap: options.processingOptions?.chunkOverlap || 200,
      maxTextLength: options.processingOptions?.maxTextLength || 1000000
    });

    // Initialize embedding generator if OpenAI API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey && options.embeddingOptions?.enableCaching !== false) {
      this.embeddingGenerator = new EmbeddingGenerator(openaiApiKey, {
        model: options.embeddingOptions?.model || 'text-embedding-3-small',
        batchSize: options.embeddingOptions?.batchSize || 100,
        enableCaching: options.embeddingOptions?.enableCaching ?? true
      });
    }
  }

  /**
   * Validate the processing job
   */
  async validate(): Promise<void> {
    const jobData = this.jobData as ProcessingJobData;
    
    if (!jobData.metadata.downloadUrls || jobData.metadata.downloadUrls.length === 0) {
      throw new Error('No download URLs provided for processing job');
    }

    // Validate URLs
    for (const url of jobData.metadata.downloadUrls) {
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided for processing job');
      }
    }

    // Test services if needed
    const serviceTests = await this.testServices();
    if (!serviceTests.downloader || !serviceTests.processor) {
      throw new Error('Required services are not available');
    }
  }

  /**
   * Execute the processing job
   */
  async execute(): Promise<void> {
    try {
      const jobData = this.jobData as ProcessingJobData;
      const urls = jobData.metadata.downloadUrls || [];

      if (urls.length === 0) {
        await this.updateStatus(JobStatus.COMPLETED, 'No URLs to process');
        return;
      }

      // Step 1: Download files
      await this.updateStatus(JobStatus.DOWNLOADING, 'Starting file downloads');
      const downloadResults = await this.downloadFiles(urls);

      // Step 2: Process files
      await this.updateStatus(JobStatus.PROCESSING, 'Processing downloaded files');
      const processingResults = await this.processFiles(downloadResults);

      // Step 3: Generate embeddings (if enabled)
      if (this.embeddingGenerator && jobData.metadata.processingOptions?.generateEmbeddings === true) {
        await this.updateStatus(JobStatus.INDEXING, 'Generating embeddings');
        await this.generateEmbeddings(processingResults);
      }

      // Update job results
      const processedFiles = this.createProcessedFiles(downloadResults, processingResults);
      await this.updateJobResults(processedFiles);

      await this.updateStatus(JobStatus.COMPLETED, 'Processing completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      await this.updateStatus(JobStatus.FAILED, `Processing failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Download files from URLs
   */
  private async downloadFiles(urls: string[]): Promise<DownloadResult[]> {
    const jobId = this.jobData.id;
    const results: DownloadResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!url) continue;
      
      const progress = ((i / urls.length) * 100);
      
      await this.updateProgress(progress, `Downloading file ${i + 1} of ${urls.length}`);
      
      const result = await this.contentDownloader.downloadFile(
        url,
        jobId,
        (downloadProgress) => {
          // Update progress for individual file download
          const fileProgress = (downloadProgress.percentage / 100) * (100 / urls.length);
          const totalProgress = progress + fileProgress;
          this.updateProgress(totalProgress, `Downloading: ${downloadProgress.percentage.toFixed(1)}%`);
        }
      );

      results.push(result);

      if (!result.success) {
        console.warn(`Failed to download ${url}: ${result.error}`);
      }
    }

    return results;
  }

  /**
   * Process downloaded files
   */
  private async processFiles(downloadResults: DownloadResult[]): Promise<ProcessingResult[]> {
    const successfulDownloads = downloadResults.filter(result => result.success && result.filePath);
    const results: ProcessingResult[] = [];

    for (let i = 0; i < successfulDownloads.length; i++) {
      const download = successfulDownloads[i];
      if (!download) continue;
      
      const progress = ((i / successfulDownloads.length) * 100);
      
      await this.updateProgress(progress, `Processing file ${i + 1} of ${successfulDownloads.length}`);
      
      if (download.filePath) {
        const result = await this.fileProcessor.processFile(download.filePath);
        results.push(result);

        if (!result.success) {
          console.warn(`Failed to process ${download.filePath}: ${result.error}`);
        }
      }
    }

    return results;
  }

  /**
   * Generate embeddings for processed files
   */
  private async generateEmbeddings(processingResults: ProcessingResult[]): Promise<void> {
    if (!this.embeddingGenerator) {
      console.warn('Embedding generator not available');
      return;
    }

    const allChunks: any[] = [];
    const chunkToFileMap: Map<string, number> = new Map();

    // Collect all text chunks from processed files
    for (let i = 0; i < processingResults.length; i++) {
      const result = processingResults[i];
      if (result && result.success && result.chunks) {
        for (const chunk of result.chunks) {
          allChunks.push(chunk);
          chunkToFileMap.set(chunk.id, i);
        }
      }
    }

    if (allChunks.length === 0) {
      console.warn('No text chunks found for embedding generation');
      return;
    }

    // Generate embeddings in batches
    const batchSize = 100;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const progress = ((i / allChunks.length) * 100);
      
      await this.updateProgress(progress, `Generating embeddings for batch ${Math.floor(i / batchSize) + 1}`);
      
      const embeddingResult = await this.embeddingGenerator.generateChunkEmbeddings(batch);
      
      if (embeddingResult.success && embeddingResult.embeddings) {
        // Store embeddings with chunks (this would typically go to a vector database)
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddingResult.embeddings[j];
          if (embedding) {
            // Here you would store the embedding in your vector database
            // For now, we'll just log that it was generated
            console.log(`Generated embedding for chunk ${chunk.id} (${embedding.length} dimensions)`);
          }
        }
      } else {
        console.warn(`Failed to generate embeddings for batch: ${embeddingResult.error}`);
      }
    }
  }

  /**
   * Create processed file records
   */
  private createProcessedFiles(
    downloadResults: DownloadResult[],
    processingResults: ProcessingResult[]
  ): ProcessedFile[] {
    const processedFiles: ProcessedFile[] = [];

    for (let i = 0; i < downloadResults.length; i++) {
      const download = downloadResults[i];
      const processing = processingResults[i];

      if (download && download.success && download.filePath && processing?.success) {
        const processedFile: ProcessedFile = {
          originalUrl: download.metadata?.originalUrl || '',
          localPath: download.filePath,
          fileName: download.fileName || '',
          fileSize: download.fileSize || 0,
          mimeType: download.mimeType || 'application/octet-stream',
          checksum: download.checksum || '',
          processedAt: new Date(),
          extractedText: processing.text || '',
          metadata: {
            ...processing.metadata,
            downloadMetadata: download.metadata,
            processingMetadata: processing.metadata,
            chunkCount: processing.chunks?.length || 0
          }
        };

        processedFiles.push(processedFile);
      }
    }

    return processedFiles;
  }

  /**
   * Update job results with processed files
   */
  private async updateJobResults(processedFiles: ProcessedFile[]): Promise<void> {
    const jobData = this.jobData as ProcessingJobData;
    
    // Update job metadata with results
    jobData.metadata.processedFiles = processedFiles;
    jobData.metadata.results = {
      documentsFound: processedFiles.length,
      documentsDownloaded: processedFiles.length,
      documentsProcessed: processedFiles.length,
      documentsIndexed: processedFiles.length,
      processedFiles
    };

    // Update job in database (this would typically be done through a job manager)
    console.log(`Processing job completed: ${processedFiles.length} files processed`);
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): Record<string, any> {
    return {
      downloader: this.contentDownloader.getSupportedFileTypes(),
      processor: this.fileProcessor.getProcessingStats(),
      embeddingGenerator: this.embeddingGenerator?.getModelInfo() || null,
      cacheStats: this.embeddingGenerator?.getCacheStats() || null
    };
  }

  /**
   * Test all services
   */
  async testServices(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Test downloader
    try {
      const supportedTypes = this.contentDownloader.getSupportedFileTypes();
      results.downloader = supportedTypes.length > 0;
    } catch (error) {
      results.downloader = false;
    }

    // Test processor
    try {
      const stats = this.fileProcessor.getProcessingStats();
      results.processor = stats.supportedTypes.length > 0;
    } catch (error) {
      results.processor = false;
    }

    // Test embedding generator
    if (this.embeddingGenerator) {
      try {
        const testResult = await this.embeddingGenerator.testConnection();
        results.embeddingGenerator = testResult.success;
      } catch (error) {
        results.embeddingGenerator = false;
      }
    } else {
      results.embeddingGenerator = false;
    }

    return results;
  }
} 