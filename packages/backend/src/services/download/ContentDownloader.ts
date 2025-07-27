import axios, { AxiosResponse } from 'axios';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, extname, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import mime from 'mime-types';
import { JobStatus, JobProgressUpdate } from '../../types/job';
import { ProcessedFile } from '../../types/job';

export interface DownloadOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  validateSSL?: boolean;
  followRedirects?: boolean;
  maxFileSize?: number; // in bytes
}

export interface DownloadProgress {
  jobId: string;
  url: string;
  bytesDownloaded: number;
  totalBytes?: number;
  percentage: number;
  speed: number; // bytes per second
  eta?: number; // estimated time remaining in seconds
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  checksum?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export class ContentDownloader {
  private downloadQueue: Map<string, Promise<DownloadResult>> = new Map();
  private maxConcurrentDownloads: number;
  private downloadDirectory: string;
  private options: DownloadOptions;

  constructor(
    downloadDirectory: string = './downloads',
    maxConcurrentDownloads: number = 5,
    options: DownloadOptions = {}
  ) {
    this.downloadDirectory = downloadDirectory;
    this.maxConcurrentDownloads = maxConcurrentDownloads;
    this.options = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      userAgent: 'DataCollector/1.0 (Academic Research Tool)',
      headers: {},
      validateSSL: true,
      followRedirects: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      ...options
    };

    // Ensure download directory exists
    this.ensureDownloadDirectory();
  }

  private ensureDownloadDirectory(): void {
    if (!existsSync(this.downloadDirectory)) {
      mkdirSync(this.downloadDirectory, { recursive: true });
    }
  }

  /**
   * Download a single file with progress tracking
   */
  async downloadFile(
    url: string,
    jobId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<DownloadResult> {
    const fileName = this.generateFileName(url);
    const filePath = join(this.downloadDirectory, fileName);

    try {
      // Check if file already exists
      if (existsSync(filePath)) {
        const existingFile = await this.validateExistingFile(filePath, url);
        if (existingFile.success) {
          return existingFile;
        }
      }

      // Start download
      const result = await this.performDownload(url, filePath, jobId, onProgress);
      
      if (result.success && result.filePath) {
        // Validate downloaded file
        const validation = await this.validateDownloadedFile(result.filePath, url);
        if (!validation.success) {
          return { ...result, success: false, error: validation.error || 'Validation failed' };
        }

        // Generate checksum
        const checksum = await this.generateChecksum(result.filePath);
        result.checksum = checksum;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown download error'
      };
    }
  }

  /**
   * Download multiple files with concurrency control
   */
  async downloadFiles(
    urls: string[],
    jobId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const semaphore = new Semaphore(this.maxConcurrentDownloads);

    const downloadPromises = urls.map(async (url, index) => {
      await semaphore.acquire();
      try {
        const result = await this.downloadFile(url, jobId, onProgress);
        results[index] = result;
        return result;
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(downloadPromises);
    return results;
  }

  /**
   * Perform the actual download with progress tracking
   */
  private async performDownload(
    url: string,
    filePath: string,
    jobId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<DownloadResult> {
    let retries = 0;
    const maxRetries = this.options.maxRetries || 3;

    while (retries <= maxRetries) {
      try {
        const response = await axios({
          method: 'GET',
          url,
          responseType: 'stream',
          ...(this.options.timeout && { timeout: this.options.timeout }),
          headers: {
            ...(this.options.userAgent && { 'User-Agent': this.options.userAgent }),
            ...this.options.headers
          },
          validateStatus: (status) => status === 200,
          maxRedirects: this.options.followRedirects ? 5 : 0,
          httpsAgent: this.options.validateSSL ? undefined : new (require('https').Agent)({
            rejectUnauthorized: false
          })
        });

        const contentLength = parseInt(response.headers['content-length'] || '0');
        const mimeType = response.headers['content-type'] || mime.lookup(url) || 'application/octet-stream';

        // Check file size limit
        if (contentLength > 0 && contentLength > (this.options.maxFileSize || 0)) {
          return {
            success: false,
            error: `File size (${contentLength} bytes) exceeds limit (${this.options.maxFileSize} bytes)`
          };
        }

        const writeStream = createWriteStream(filePath);
        let bytesDownloaded = 0;
        const startTime = Date.now();

        response.data.on('data', (chunk: Buffer) => {
          bytesDownloaded += chunk.length;
          
          if (onProgress) {
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? bytesDownloaded / elapsed : 0;
            const percentage = contentLength > 0 ? (bytesDownloaded / contentLength) * 100 : 0;
            const eta = speed > 0 && contentLength > 0 ? (contentLength - bytesDownloaded) / speed : undefined;

            onProgress({
              jobId,
              url,
              bytesDownloaded,
              totalBytes: contentLength,
              percentage,
              speed,
              ...(eta !== undefined && { eta })
            });
          }
        });

        await pipeline(response.data, writeStream);

        const fileSize = bytesDownloaded;
        const fileName = basename(filePath);

        return {
          success: true,
          filePath,
          fileName,
          fileSize,
          mimeType,
          metadata: {
            originalUrl: url,
            downloadTime: new Date().toISOString(),
            contentLength: contentLength || fileSize
          }
        };

      } catch (error) {
        retries++;
        if (retries > maxRetries) {
          return {
            success: false,
            error: `Download failed after ${maxRetries} retries: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay || 1000));
      }
    }

    return {
      success: false,
      error: 'Download failed - max retries exceeded'
    };
  }

  /**
   * Generate a unique filename for the download
   */
  private generateFileName(url: string): string {
    const urlHash = createHash('md5').update(url).digest('hex').substring(0, 8);
    const extension = extname(url) || '.txt';
    const timestamp = Date.now();
    return `${urlHash}_${timestamp}${extension}`;
  }

  /**
   * Validate an existing file to see if it can be reused
   */
  private async validateExistingFile(filePath: string, url: string): Promise<DownloadResult> {
    try {
      const stats = await import('fs').then(fs => fs.promises.stat(filePath));
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      
      return {
        success: true,
        filePath,
        fileName: basename(filePath),
        fileSize: stats.size,
        mimeType,
        metadata: {
          originalUrl: url,
          reused: true,
          lastModified: stats.mtime.toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to validate existing file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate a downloaded file
   */
  private async validateDownloadedFile(filePath: string, url: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stats = await import('fs').then(fs => fs.promises.stat(filePath));
      
      // Check if file is empty
      if (stats.size === 0) {
        return { success: false, error: 'Downloaded file is empty' };
      }

      // Check file size limit
      if (stats.size > (this.options.maxFileSize || 0)) {
        return { success: false, error: `File size exceeds limit` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Generate MD5 checksum for a file
   */
  private async generateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('md5');
      const stream = require('fs').createReadStream(filePath);
      
      stream.on('data', (chunk: Buffer) => {
        hash.update(chunk);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/json',
      'text/plain',
      'text/html'
    ];
  }

  /**
   * Check if a file type is supported
   */
  isFileTypeSupported(mimeType: string): boolean {
    return this.getSupportedFileTypes().includes(mimeType);
  }

  /**
   * Clean up old downloads
   */
  async cleanupOldDownloads(maxAgeHours: number = 24): Promise<number> {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const files = await fs.promises.readdir(this.downloadDirectory);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.downloadDirectory, file);
        const stats = await fs.promises.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old downloads:', error);
      return 0;
    }
  }
}

/**
 * Simple semaphore implementation for concurrency control
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }
} 