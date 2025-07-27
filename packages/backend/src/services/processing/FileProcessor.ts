import { readFileSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import csvParser from 'csv-parser';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import mime from 'mime-types';
import { ProcessedFile } from '../../types/job';

export interface ProcessingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  maxTextLength?: number;
  preserveFormatting?: boolean;
  extractMetadata?: boolean;
  language?: string;
}

export interface ProcessingResult {
  success: boolean;
  text?: string;
  chunks?: TextChunk[];
  metadata?: Record<string, any>;
  error?: string;
  processingTime?: number;
}

export interface TextChunk {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
  metadata?: Record<string, any>;
}

export interface FileMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creationDate?: Date;
  modificationDate?: Date;
  pageCount?: number;
  wordCount?: number;
  language?: string;
  fileType: string;
  fileSize: number;
  checksum?: string;
}

export class FileProcessor {
  private options: ProcessingOptions;
  private supportedTypes: Map<string, (filePath: string) => Promise<ProcessingResult>>;

  constructor(options: ProcessingOptions = {}) {
    this.options = {
      chunkSize: 1000,
      chunkOverlap: 200,
      maxTextLength: 1000000, // 1MB
      preserveFormatting: true,
      extractMetadata: true,
      language: 'en',
      ...options
    };

    this.supportedTypes = new Map([
      ['application/pdf', this.processPDF.bind(this)],
      ['application/msword', this.processWord.bind(this)],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', this.processWord.bind(this)],
      ['text/csv', this.processCSV.bind(this)],
      ['application/json', this.processJSON.bind(this)],
      ['text/plain', this.processText.bind(this)],
      ['text/html', this.processHTML.bind(this)]
    ]);
  }

  /**
   * Process a file and extract text content
   */
  async processFile(filePath: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      if (!existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      const mimeType = this.detectMimeType(filePath);
      const processor = this.supportedTypes.get(mimeType);

      if (!processor) {
        return {
          success: false,
          error: `Unsupported file type: ${mimeType}`
        };
      }

      const result = await processor(filePath);
      result.processingTime = Date.now() - startTime;

      if (result.success && result.text) {
        // Generate text chunks if text is extracted
        result.chunks = this.createTextChunks(result.text);
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process multiple files
   */
  async processFiles(filePaths: string[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];

    for (const filePath of filePaths) {
      const result = await this.processFile(filePath);
      results.push(result);
    }

    return results;
  }

  /**
   * Process PDF files
   */
  private async processPDF(filePath: string): Promise<ProcessingResult> {
    try {
      const dataBuffer = readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer, {
        max: this.options.maxTextLength || undefined
      });

      const metadata: FileMetadata = {
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        subject: pdfData.info?.Subject,
        pageCount: pdfData.numpages,
        wordCount: pdfData.text.split(/\s+/).length,
        fileType: 'PDF',
        fileSize: dataBuffer.length,
        language: this.detectLanguage(pdfData.text)
      };

      return {
        success: true,
        text: pdfData.text,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: `PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process Word documents
   */
  private async processWord(filePath: string): Promise<ProcessingResult> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;

      // Extract metadata from document properties
      const metadata: FileMetadata = {
        title: basename(filePath, '.docx'),
        wordCount: text.split(/\s+/).length,
        fileType: 'Word',
        fileSize: readFileSync(filePath).length,
        language: this.detectLanguage(text)
      };

      return {
        success: true,
        text,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: `Word document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process CSV files
   */
  private async processCSV(filePath: string): Promise<ProcessingResult> {
    return new Promise((resolve) => {
      try {
        const rows: any[] = [];
        const headers: string[] = [];
        let isFirstRow = true;

        createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => {
            if (isFirstRow) {
              headers.push(...Object.keys(row));
              isFirstRow = false;
            }
            rows.push(row);
          })
          .on('end', () => {
            const text = this.formatCSVAsText(headers, rows);
            const metadata: FileMetadata = {
              title: basename(filePath, '.csv'),
              wordCount: text.split(/\s+/).length,
              fileType: 'CSV',
              fileSize: readFileSync(filePath).length,
              language: 'en'
            };

            resolve({
              success: true,
              text,
              metadata
            });
          })
          .on('error', (error) => {
            resolve({
              success: false,
              error: `CSV processing failed: ${error.message}`
            });
          });

      } catch (error) {
        resolve({
          success: false,
          error: `CSV processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    });
  }

  /**
   * Process JSON files
   */
  private async processJSON(filePath: string): Promise<ProcessingResult> {
    try {
      const data = readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(data);
      const text = this.formatJSONAsText(jsonData);

      const metadata: FileMetadata = {
        title: basename(filePath, '.json'),
        wordCount: text.split(/\s+/).length,
        fileType: 'JSON',
        fileSize: data.length,
        language: 'en'
      };

      return {
        success: true,
        text,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: `JSON processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process plain text files
   */
  private async processText(filePath: string): Promise<ProcessingResult> {
    try {
      const text = readFileSync(filePath, 'utf-8');

      const metadata: FileMetadata = {
        title: basename(filePath),
        wordCount: text.split(/\s+/).length,
        fileType: 'Text',
        fileSize: text.length,
        language: this.detectLanguage(text)
      };

      return {
        success: true,
        text,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: `Text processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Process HTML files
   */
  private async processHTML(filePath: string): Promise<ProcessingResult> {
    try {
      const html = readFileSync(filePath, 'utf-8');
      const text = this.extractTextFromHTML(html);

      const metadata: FileMetadata = {
        title: this.extractTitleFromHTML(html) || basename(filePath),
        wordCount: text.split(/\s+/).length,
        fileType: 'HTML',
        fileSize: html.length,
        language: this.detectLanguage(text)
      };

      return {
        success: true,
        text,
        metadata
      };

    } catch (error) {
      return {
        success: false,
        error: `HTML processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create text chunks for processing
   */
  private createTextChunks(text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    const chunkSize = this.options.chunkSize || 1000;
    const overlap = this.options.chunkOverlap || 200;
    let chunkIndex = 0;

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const endIndex = Math.min(i + chunkSize, text.length);
      const chunkText = text.substring(i, endIndex);

      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: chunkText,
        startIndex: i,
        endIndex: endIndex,
        chunkIndex: chunkIndex,
        metadata: {
          length: chunkText.length,
          wordCount: chunkText.split(/\s+/).length
        }
      });

      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Detect MIME type of file
   */
  private detectMimeType(filePath: string): string {
    const extension = extname(filePath).toLowerCase();
    const mimeType = mime.lookup(extension);
    return (mimeType as string) ?? 'application/octet-stream';
  }

  /**
   * Detect language of text (simple implementation)
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = text.toLowerCase().split(/\s+/);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    
    if (englishCount > words.length * 0.1) {
      return 'en';
    }
    
    return 'unknown';
  }

  /**
   * Format CSV data as readable text
   */
  private formatCSVAsText(headers: string[], rows: any[]): string {
    let text = `CSV Data with ${rows.length} rows and ${headers.length} columns:\n\n`;
    
    // Add headers
    text += `Headers: ${headers.join(', ')}\n\n`;
    
    // Add first few rows as example
    const maxRows = Math.min(10, rows.length);
    for (let i = 0; i < maxRows; i++) {
      text += `Row ${i + 1}: ${headers.map(h => `${h}: ${rows[i][h] || ''}`).join(', ')}\n`;
    }
    
    if (rows.length > maxRows) {
      text += `\n... and ${rows.length - maxRows} more rows`;
    }
    
    return text;
  }

  /**
   * Format JSON data as readable text
   */
  private formatJSONAsText(data: any, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    
    if (typeof data === 'string') {
      return `"${data}"`;
    } else if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    } else if (data === null) {
      return 'null';
    } else if (Array.isArray(data)) {
      if (data.length === 0) return '[]';
      if (depth > 3) return `[Array with ${data.length} items]`;
      
      const items = data.slice(0, 5).map(item => this.formatJSONAsText(item, depth + 1));
      if (data.length > 5) items.push(`... and ${data.length - 5} more items`);
      
      return `[\n${indent}  ${items.join(',\n' + indent + '  ')}\n${indent}]`;
    } else if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '{}';
      if (depth > 3) return `{Object with ${keys.length} properties}`;
      
      const pairs = keys.slice(0, 10).map(key => 
        `${key}: ${this.formatJSONAsText(data[key], depth + 1)}`
      );
      if (keys.length > 10) pairs.push(`... and ${keys.length - 10} more properties`);
      
      return `{\n${indent}  ${pairs.join(',\n' + indent + '  ')}\n${indent}}`;
    }
    
    return String(data);
  }

  /**
   * Extract text content from HTML
   */
  private extractTextFromHTML(html: string): string {
    // Simple HTML tag removal
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract title from HTML
   */
  private extractTitleFromHTML(html: string): string | null {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch && titleMatch[1] ? titleMatch[1].trim() : null;
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return Array.from(this.supportedTypes.keys());
  }

  /**
   * Check if a file type is supported
   */
  isFileTypeSupported(mimeType: string): boolean {
    return this.supportedTypes.has(mimeType);
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): Record<string, any> {
    return {
      supportedTypes: this.getSupportedFileTypes(),
      chunkSize: this.options.chunkSize,
      chunkOverlap: this.options.chunkOverlap,
      maxTextLength: this.options.maxTextLength,
      preserveFormatting: this.options.preserveFormatting,
      extractMetadata: this.options.extractMetadata
    };
  }
} 