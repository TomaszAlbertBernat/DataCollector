// Import backend types for consistency
import type {
  JobStatus,
  JobType,
} from '../../../backend/src/types/job'

// Re-export backend API types for frontend use
export type {
  CreateCollectionRequest,
  CreateJobResponse,
  JobStatusResponse,
  ListJobsRequest,
  CancelJobRequest,
  RetryJobRequest,
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearchFilters,
  SearchSort,
  SearchSortField,
  SearchMode,
  SearchHighlight,
  SearchFacets,
  FacetValue,
  SearchSuggestionsRequest,
  SearchSuggestionsResponse,
  DocumentResponse,
  DocumentChunk,
  DocumentDownloadRequest,
  WebSocketMessage,
  WebSocketMessageType,
  JobStatusUpdateMessage,
  JobProgressUpdateMessage,
  SystemNotificationMessage,
  ApiResponse,
  ApiError,
  PaginationMeta,
  PaginatedResponse,
  SuccessResponse,
  IdResponse,
  HealthCheckResponse,
  ServiceHealthStatus,
} from '../../../backend/src/types/api'

// Re-export job types
export type { JobStatus, JobType }

// Frontend-specific types that extend backend types
export interface JobWithClientState {
  id: string
  type: JobType
  status: JobStatus
  progress: number
  message?: string
  query: string
  userId?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  estimatedTimeRemaining?: number
  results?: {
    documentsFound?: number
    documentsDownloaded?: number
    documentsProcessed?: number
    errors?: string[]
  }
  // Client-side extensions
  isSelected?: boolean
  isExpanded?: boolean
  clientId?: string
}

export interface SearchFiltersUI {
  sources?: string[]
  fileTypes?: string[]
  dateRange?: {
    from?: string
    to?: string
  }
  authors?: string[]
  language?: string
  collectionIds?: string[]
  // UI-specific extensions
  isAdvanced?: boolean
  quickFilters?: string[]
}

export interface ClientNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  isRead?: boolean
  duration?: number
} 