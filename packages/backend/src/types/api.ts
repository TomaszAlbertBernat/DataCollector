/**
 * API-related TypeScript type definitions and interfaces
 * 
 * This file contains types for API requests, responses, and DTOs that don't map to database schema.
 * These are used for request validation, response formatting, and API documentation.
 */

import { JobStatus, JobType, JobStatistics, JobQueryParams } from './job';

// Common API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
  requestId?: string;
}

// API error structure
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string; // Only in development
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Paginated response wrapper
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}

// ===================
// JOB API ENDPOINTS
// ===================

// Create collection job request
export interface CreateCollectionRequest {
  query: string;
  sources?: string[];
  options?: {
    maxResults?: number;
    fileTypes?: string[];
    dateRange?: {
      from?: string; // ISO date string
      to?: string;   // ISO date string
    };
    language?: string;
    priority?: number;
  };
}

// Job creation response
export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  estimatedDuration?: number; // seconds
  queuePosition?: number;
}

// Job status response
export interface JobStatusResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  message?: string;
  query: string;
  userId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number; // seconds
  results?: {
    documentsFound?: number;
    documentsDownloaded?: number;
    documentsProcessed?: number;
    errors?: string[];
  };
}

// Job list request parameters
export interface ListJobsRequest extends JobQueryParams {
  status?: JobStatus[];
  type?: JobType[];
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Job cancellation request
export interface CancelJobRequest {
  reason?: string;
  force?: boolean;
}

// Job retry request
export interface RetryJobRequest {
  resetProgress?: boolean;
  newOptions?: CreateCollectionRequest['options'];
}

// ===================
// SEARCH API ENDPOINTS
// ===================

// Search request
export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  sort?: SearchSort;
  pagination?: {
    page?: number;
    limit?: number;
  };
  includeHighlights?: boolean;
  searchMode?: SearchMode;
}

// Search filters
export interface SearchFilters {
  sources?: string[];
  fileTypes?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
  authors?: string[];
  language?: string;
  collectionIds?: string[];
}

// Search sorting options
export interface SearchSort {
  field: SearchSortField;
  order: 'asc' | 'desc';
}

export enum SearchSortField {
  RELEVANCE = 'relevance',
  DATE = 'date',
  TITLE = 'title',
  AUTHOR = 'author',
  SOURCE = 'source'
}

export enum SearchMode {
  HYBRID = 'hybrid',      // Combines full-text and semantic search
  FULLTEXT = 'fulltext',  // OpenSearch only
  SEMANTIC = 'semantic',  // Vector search only
  FUZZY = 'fuzzy'        // Fuzzy matching
}

// Search response
export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number; // milliseconds
  suggestions?: string[];
  facets?: SearchFacets;
  pagination: PaginationMeta;
}

// Individual search result
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  url?: string;
  source: string;
  authors?: string[];
  publicationDate?: string;
  fileType: string;
  fileSize?: number;
  relevanceScore: number;
  highlights?: SearchHighlight[];
  metadata?: Record<string, any>;
}

// Search result highlights
export interface SearchHighlight {
  field: string;
  fragments: string[];
}

// Search facets for filtering
export interface SearchFacets {
  sources: FacetValue[];
  fileTypes: FacetValue[];
  authors: FacetValue[];
  years: FacetValue[];
  languages: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
}

// Search suggestions request
export interface SearchSuggestionsRequest {
  query: string;
  limit?: number;
}

// Search suggestions response
export interface SearchSuggestionsResponse {
  suggestions: string[];
  popular: string[];
  recent: string[];
}

// ===================
// DOCUMENT API ENDPOINTS
// ===================

// Document details response
export interface DocumentResponse {
  id: string;
  title: string;
  url?: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  source: string;
  authors?: string[];
  publicationDate?: string;
  abstract?: string;
  keywords?: string[];
  language: string;
  createdAt: string;
  metadata: Record<string, any>;
  chunks?: DocumentChunk[];
}

// Document chunk information
export interface DocumentChunk {
  id: string;
  index: number;
  content: string;
  tokenCount: number;
  embeddingId?: string;
}

// Document download request
export interface DocumentDownloadRequest {
  format?: 'original' | 'text' | 'pdf';
  includeMetadata?: boolean;
}

// ===================
// COLLECTION API ENDPOINTS
// ===================

// Create collection request
export interface CreateDocumentCollectionRequest {
  name: string;
  description?: string;
  documentIds?: string[];
}

// Collection response
export interface DocumentCollectionResponse {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

// Add documents to collection request
export interface AddDocumentsToCollectionRequest {
  documentIds: string[];
}

// ===================
// STATISTICS API ENDPOINTS
// ===================

// Dashboard statistics response
export interface DashboardStatsResponse {
  jobs: JobStatistics;
  documents: {
    total: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    totalSize: number; // bytes
    recentlyAdded: number; // last 24h
  };
  search: {
    totalQueries: number;
    averageResponseTime: number;
    popularQueries: string[];
    recentQueries: number; // last 24h
  };
  system: {
    uptime: number; // seconds
    version: string;
    status: 'healthy' | 'degraded' | 'down';
  };
}

// ===================
// WEBSOCKET MESSAGE TYPES
// ===================

// WebSocket message base interface
export interface WebSocketMessage {
  type: WebSocketMessageType;
  timestamp: string;
  data?: any;
}

export enum WebSocketMessageType {
  JOB_STATUS_UPDATE = 'job_status_update',
  JOB_PROGRESS_UPDATE = 'job_progress_update',
  JOB_LOG_UPDATE = 'job_log_update',
  SYSTEM_NOTIFICATION = 'system_notification',
  SEARCH_RESULTS_UPDATE = 'search_results_update'
}

// Job status update message
export interface JobStatusUpdateMessage extends WebSocketMessage {
  type: WebSocketMessageType.JOB_STATUS_UPDATE;
  data: {
    jobId: string;
    status: JobStatus;
    message?: string;
    progress: number;
  };
}

// Job progress update message
export interface JobProgressUpdateMessage extends WebSocketMessage {
  type: WebSocketMessageType.JOB_PROGRESS_UPDATE;
  data: {
    jobId: string;
    progress: number;
    message: string;
    stage: string;
    eta?: number; // estimated seconds remaining
  };
}

// System notification message
export interface SystemNotificationMessage extends WebSocketMessage {
  type: WebSocketMessageType.SYSTEM_NOTIFICATION;
  data: {
    level: 'info' | 'warning' | 'error';
    title: string;
    message: string;
    actionUrl?: string;
  };
}

// ===================
// HEALTH CHECK ENDPOINTS
// ===================

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: ServiceHealthStatus[];
  version: string;
  uptime: number;
}

// Individual service health status
export interface ServiceHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number; // milliseconds
  error?: string;
  details?: Record<string, any>;
}

// ===================
// VALIDATION SCHEMAS
// ===================

// Request validation error
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

// Bulk validation errors
export interface ValidationErrorResponse extends ApiError {
  code: 'VALIDATION_ERROR';
  details: {
    errors: ValidationError[];
    errorCount: number;
  };
}

// ===================
// UTILITY TYPES
// ===================

// Generic list response
export type ListResponse<T> = PaginatedResponse<T>;

// Generic ID response (for create operations)
export interface IdResponse {
  id: string;
}

// Generic success response (for delete/update operations)
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

// Query parameter types for API endpoints
export type ApiQueryParams = Record<string, string | string[] | number | boolean | undefined>;

// HTTP status codes commonly used
export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503
} 