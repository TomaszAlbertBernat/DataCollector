/**
 * Job-related TypeScript type definitions and interfaces
 * 
 * This file contains types for job processing that don't directly map to database schema.
 * For database models, see models/Job.ts
 */

// Job status enumeration with clear state transitions
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  ANALYZING = 'analyzing',
  SEARCHING = 'searching',
  DOWNLOADING = 'downloading',
  PROCESSING = 'processing',
  INDEXING = 'indexing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Job types enumeration
export enum JobType {
  COLLECTION = 'collection',
  PROCESSING = 'processing',
  INDEXING = 'indexing',
  SEARCH = 'search'
}

// Valid state transitions for job status machine
export const JOB_STATE_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.RUNNING, JobStatus.CANCELLED],
  [JobStatus.RUNNING]: [JobStatus.ANALYZING, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.ANALYZING]: [JobStatus.SEARCHING, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.SEARCHING]: [JobStatus.DOWNLOADING, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.DOWNLOADING]: [JobStatus.PROCESSING, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.PROCESSING]: [JobStatus.INDEXING, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.INDEXING]: [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.FAILED]: [],
  [JobStatus.CANCELLED]: []
};

// Core job data interface (used in job processing)
export interface JobData {
  id: string;
  type: JobType;
  status: JobStatus;
  query: string;
  progress: number;
  userId?: string;
  metadata: JobMetadata;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// Job metadata for different job types
export interface JobMetadata {
  sources?: string[];
  options?: CollectionOptions;
  results?: JobResults;
  performance?: JobPerformance;
}

// Collection job specific options
export interface CollectionOptions {
  maxResults?: number;
  fileTypes?: string[];
  dateRange?: DateRange;
  language?: string;
  priority?: JobPriority;
  retryAttempts?: number;
}

// Job results structure
export interface JobResults {
  documentsFound?: number;
  documentsDownloaded?: number;
  documentsProcessed?: number;
  documentsIndexed?: number;
  errors?: string[];
  warnings?: string[];
  downloadUrls?: string[];
  processedFiles?: ProcessedFile[];
}

// Performance metrics for jobs
export interface JobPerformance {
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  memoryUsage?: number; // bytes
  cpuUsage?: number; // percentage
  networkRequests?: number;
  bytesDownloaded?: number;
}

// Job priority levels
export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

// Date range filter
export interface DateRange {
  from?: Date;
  to?: Date;
}

// Processed file information
export interface ProcessedFile {
  originalUrl: string;
  localPath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  processedAt: Date;
  extractedText?: string;
  metadata?: Record<string, any>;
}

// Job progress update interface
export interface JobProgressUpdate {
  jobId: string;
  status: JobStatus;
  progress: number;
  message?: string;
  timestamp: Date;
  data?: any;
}

// Job log entry interface
export interface JobLogEntry {
  jobId: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// Job cancellation request
export interface JobCancellationRequest {
  jobId: string;
  reason?: string;
  force?: boolean;
}

// Job retry configuration
export interface JobRetryConfig {
  maxAttempts: number;
  backoffStrategy: BackoffStrategy;
  retryableErrors: string[];
}

// Backoff strategies for job retries
export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential'
}

// Job queue configuration
export interface JobQueueConfig {
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  priority: JobPriority;
}

// Job statistics interface
export interface JobStatistics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageDuration: number;
  successRate: number;
  throughput: number; // jobs per hour
}

// Job validation error
export interface JobValidationError {
  field: string;
  message: string;
  code: string;
}

// Job execution context (passed to job processors)
export interface JobExecutionContext {
  jobData: JobData;
  logger: ILogger;
  statusNotifier: IStatusNotifier;
  services: IServiceContainer;
  config: IConfig;
}

// Interface definitions for dependency injection
export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

export interface IStatusNotifier {
  broadcast(jobId: string, status: JobStatus, message?: string, data?: any): Promise<void>;
  subscribe(jobId: string, callback: (update: JobProgressUpdate) => void): void;
  unsubscribe(jobId: string): void;
}

export interface IServiceContainer {
  get<T>(serviceName: string): T;
  register<T>(serviceName: string, service: T): void;
}

export interface IConfig {
  get<T>(key: string): T;
  getOptional<T>(key: string, defaultValue: T): T;
}

// Type guards for job status validation
export function isValidJobStatus(status: string): status is JobStatus {
  return Object.values(JobStatus).includes(status as JobStatus);
}

export function isValidJobType(type: string): type is JobType {
  return Object.values(JobType).includes(type as JobType);
}

export function isValidStateTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_STATE_TRANSITIONS[from].includes(to);
}

// Utility types
export type JobFilter = Partial<Pick<JobData, 'type' | 'status' | 'userId'>>;
export type JobSortField = keyof Pick<JobData, 'createdAt' | 'startedAt' | 'completedAt' | 'progress'>;
export type JobSortOrder = 'asc' | 'desc';

// Job query parameters for API endpoints
export interface JobQueryParams {
  filter?: JobFilter;
  sort?: {
    field: JobSortField;
    order: JobSortOrder;
  };
  pagination?: {
    page: number;
    limit: number;
  };
} 