import axios, { AxiosInstance, AxiosResponse } from 'axios'
import type {
  ApiResponse,
  CreateCollectionRequest,
  CreateJobResponse,
  JobStatusResponse,
  ListJobsRequest,
  PaginatedResponse,
  SearchRequest,
  SearchResponse,
  DocumentResponse,
  HealthCheckResponse,
} from '@/types/api'

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3005',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for handling common API patterns
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// Job Management API
export const jobsApi = {
  // Create a new collection job
  createCollection: async (request: CreateCollectionRequest): Promise<CreateJobResponse> => {
    const response = await api.post<ApiResponse<CreateJobResponse>>('/api/jobs/collection', request)
    return response.data.data!
  },

  // Get job status by ID
  getJobStatus: async (jobId: string): Promise<JobStatusResponse> => {
    const response = await api.get<ApiResponse<JobStatusResponse>>(`/api/jobs/${jobId}`)
    return response.data.data!
  },

  // List jobs with filtering
  listJobs: async (params?: ListJobsRequest): Promise<PaginatedResponse<JobStatusResponse>> => {
    const response = await api.get<PaginatedResponse<JobStatusResponse>>('/api/jobs', { params })
    return response.data
  },

  // Cancel a job
  cancelJob: async (jobId: string, reason?: string): Promise<void> => {
    await api.delete(`/api/jobs/${jobId}`, { 
      data: { reason } 
    })
  },

  // Retry a failed job
  retryJob: async (jobId: string): Promise<JobStatusResponse> => {
    const response = await api.post<ApiResponse<JobStatusResponse>>(`/api/jobs/${jobId}/retry`)
    return response.data.data!
  },
}

// Search API
export const searchApi = {
  // Search documents
  search: async (request: SearchRequest): Promise<SearchResponse> => {
    const response = await api.get<ApiResponse<SearchResponse>>('/api/search', { 
      params: request 
    })
    return response.data.data!
  },

  // Get search suggestions
  getSuggestions: async (query: string): Promise<string[]> => {
    const response = await api.get<ApiResponse<string[]>>('/api/search/suggestions', {
      params: { query }
    })
    return response.data.data!
  },
}

// Document API
export const documentsApi = {
  // Get document by ID
  getDocument: async (documentId: string): Promise<DocumentResponse> => {
    const response = await api.get<ApiResponse<DocumentResponse>>(`/api/documents/${documentId}`)
    return response.data.data!
  },

  // Get document content for preview
  getDocumentContent: async (documentId: string): Promise<{ content: string; highlights?: any[]; metadata?: any }> => {
    const response = await api.get<ApiResponse<{ content: string; highlights?: any[]; metadata?: any }>>(`/api/documents/${documentId}/content`)
    return response.data.data!
  },

  // Download document
  downloadDocument: async (documentId: string, format?: string): Promise<Blob> => {
    const response = await api.get(`/api/documents/${documentId}/download`, {
      params: { format },
      responseType: 'blob'
    })
    return response.data
  },
}

// System API
export const systemApi = {
  // Health check
  getHealth: async (): Promise<HealthCheckResponse> => {
    const response = await api.get<ApiResponse<HealthCheckResponse>>('/api/health')
    return response.data.data!
  },
}

// Export the configured axios instance for custom requests
export default api 