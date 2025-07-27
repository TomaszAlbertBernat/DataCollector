import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { 
  ArrowLeftIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  EyeIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'
import { formatDistanceToNow, format } from 'date-fns'
import { JobProgressCard } from '@/components/ui/JobProgressCard'
// import { useJobStore } from '@/stores/jobStore' // TODO: Implement when job store is ready
import { useNotificationStore } from '@/stores/notificationStore'
import { jobsApi } from '@/services/api'
import type { JobStatus } from '@/types/api'

// Mock job logs for development
const mockJobLogs = [
  { timestamp: '2024-01-15T10:30:00Z', level: 'info', message: 'Job started: machine learning algorithms' },
  { timestamp: '2024-01-15T10:30:05Z', level: 'info', message: 'Analyzing query with AI...' },
  { timestamp: '2024-01-15T10:30:15Z', level: 'info', message: 'Query analysis complete. Found 3 relevant sources.' },
  { timestamp: '2024-01-15T10:30:20Z', level: 'info', message: 'Starting web search on Google Scholar...' },
  { timestamp: '2024-01-15T10:30:45Z', level: 'info', message: 'Found 150 documents matching criteria' },
  { timestamp: '2024-01-15T10:31:00Z', level: 'info', message: 'Beginning document download...' },
  { timestamp: '2024-01-15T10:31:30Z', level: 'warning', message: 'Failed to download document: timeout' },
  { timestamp: '2024-01-15T10:32:00Z', level: 'info', message: 'Successfully downloaded 67 documents' },
  { timestamp: '2024-01-15T10:32:30Z', level: 'info', message: 'Processing documents for text extraction...' },
  { timestamp: '2024-01-15T10:33:00Z', level: 'info', message: 'Text extraction complete for 45 documents' },
  { timestamp: '2024-01-15T10:33:30Z', level: 'info', message: 'Generating embeddings for semantic search...' },
  { timestamp: '2024-01-15T10:34:00Z', level: 'info', message: 'Indexing documents in search database...' },
  { timestamp: '2024-01-15T10:34:30Z', level: 'info', message: 'Job completed successfully' },
]

export function JobDetailsPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'results'>('overview')
  
  const { addNotification } = useNotificationStore()
  const queryClient = useQueryClient()

  // Fetch job details
  const { data: jobData, isLoading, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => jobsApi.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: 5000, // Refetch every 5 seconds for active jobs
  })

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.cancelJob(jobId, 'User cancelled from details page'),
    onSuccess: () => {
      toast.success('Job cancelled successfully')
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      addNotification({
        type: 'info',
        title: 'Job Cancelled',
        message: 'The job has been cancelled successfully',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to cancel job'
      toast.error(message)
      addNotification({
        type: 'error',
        title: 'Cancel Failed',
        message,
        duration: 5000,
      })
    },
  })

  // Retry job mutation
  const retryJobMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.retryJob(jobId),
    onSuccess: () => {
      toast.success('Job restarted successfully')
      queryClient.invalidateQueries({ queryKey: ['job', jobId] })
      addNotification({
        type: 'success',
        title: 'Job Restarted',
        message: 'The job has been restarted successfully',
        duration: 3000,
      })
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to restart job'
      toast.error(message)
      addNotification({
        type: 'error',
        title: 'Restart Failed',
        message,
        duration: 5000,
      })
    },
  })

  const handleCancelJob = () => {
    if (confirm('Are you sure you want to cancel this job?')) {
      cancelJobMutation.mutate(jobId!)
    }
  }

  const handleRetryJob = () => {
    if (confirm('Are you sure you want to restart this job?')) {
      retryJobMutation.mutate(jobId!)
    }
  }

  const handleDeleteJob = () => {
    if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      // TODO: Implement delete job API call
      toast('Delete functionality will be implemented with backend API', { 
        icon: '💡',
        style: { background: '#3b82f6', color: 'white' }
      })
    }
  }

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const duration = end.getTime() - start.getTime()
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return ClockIcon
      case 'running':
      case 'analyzing':
      case 'searching':
      case 'downloading':
      case 'processing':
      case 'indexing':
        return PlayIcon
      case 'completed':
        return CheckCircleIcon
      case 'failed':
        return XCircleIcon
      case 'cancelled':
        return StopIcon
      default:
        return ClockIcon
    }
  }

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      case 'running':
      case 'analyzing':
      case 'searching':
      case 'downloading':
      case 'processing':
      case 'indexing':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      case 'cancelled':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading job details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 text-center">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load job</h2>
        <p className="text-gray-600 mb-4">{String(error)}</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['job', jobId] })}
          className="btn-primary"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!jobData) {
    return (
      <div className="card p-6 text-center">
        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Job not found</h2>
        <p className="text-gray-600 mb-4">The requested job could not be found.</p>
        <button
          onClick={() => navigate('/jobs')}
          className="btn-primary"
        >
          Back to Jobs
        </button>
      </div>
    )
  }

  const StatusIcon = getStatusIcon(jobData.status)
  const isActive = ['pending', 'running', 'analyzing', 'searching', 'downloading', 'processing', 'indexing'].includes(jobData.status)
  const canCancel = isActive
  const canRetry = ['failed', 'cancelled'].includes(jobData.status)
  const canDelete = ['completed', 'failed', 'cancelled'].includes(jobData.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
            <p className="text-gray-600">ID: {jobData.id}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canRetry && (
            <button
              onClick={handleRetryJob}
              disabled={retryJobMutation.isPending}
              className="btn-outline flex items-center"
            >
              <PlayIcon className="h-4 w-4 mr-2" />
              {retryJobMutation.isPending ? 'Restarting...' : 'Restart'}
            </button>
          )}
          
          {canCancel && (
            <button
              onClick={handleCancelJob}
              disabled={cancelJobMutation.isPending}
              className="btn-outline flex items-center"
            >
              <StopIcon className="h-4 w-4 mr-2" />
              {cancelJobMutation.isPending ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
          
          {canDelete && (
            <button
              onClick={handleDeleteJob}
              className="btn-outline flex items-center text-red-600 hover:text-red-700"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Job Progress Card */}
      <JobProgressCard
        job={jobData}
        onView={() => {}} // Already on details page
        onCancel={handleCancelJob}
        onDelete={handleDeleteJob}
      />

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'logs', label: 'Logs' },
              { id: 'results', label: 'Results' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Job Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Query</label>
                    <p className="mt-1 text-sm text-gray-900">{jobData.query}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <div className="mt-1 flex items-center space-x-2">
                      <StatusIcon className={`h-4 w-4 ${getStatusColor(jobData.status).split(' ')[0]}`} />
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(jobData.status)}`}>
                        {jobData.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {format(new Date(jobData.createdAt), 'PPP p')}
                    </p>
                  </div>
                  {jobData.startedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Started</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {format(new Date(jobData.startedAt), 'PPP p')}
                      </p>
                    </div>
                  )}
                  {jobData.completedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Completed</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {format(new Date(jobData.completedAt), 'PPP p')}
                      </p>
                    </div>
                  )}
                  {jobData.startedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Duration</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {formatDuration(jobData.startedAt, jobData.completedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Information */}
              {isActive && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm text-gray-500">{jobData.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${jobData.progress}%` }}
                        />
                      </div>
                    </div>
                    {jobData.message && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Current Activity</label>
                        <p className="mt-1 text-sm text-gray-900">{jobData.message}</p>
                      </div>
                    )}
                    {jobData.estimatedTimeRemaining && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Estimated Time Remaining</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {Math.floor(jobData.estimatedTimeRemaining / 60)}m {jobData.estimatedTimeRemaining % 60}s
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Logs</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {mockJobLogs.map((log, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      log.level === 'error' ? 'bg-red-500' :
                      log.level === 'warning' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{log.message}</span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                        log.level === 'error' ? 'bg-red-100 text-red-800' :
                        log.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {log.level}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Results</h3>
              {jobData.results ? (
                <div className="space-y-6">
                  {/* Results Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {jobData.results.documentsFound !== undefined && (
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {jobData.results.documentsFound}
                        </div>
                        <div className="text-sm text-gray-600">Documents Found</div>
                      </div>
                    )}
                    
                    {jobData.results.documentsDownloaded !== undefined && (
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {jobData.results.documentsDownloaded}
                        </div>
                        <div className="text-sm text-gray-600">Documents Downloaded</div>
                      </div>
                    )}
                    
                    {jobData.results.documentsProcessed !== undefined && (
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {jobData.results.documentsProcessed}
                        </div>
                        <div className="text-sm text-gray-600">Documents Processed</div>
                      </div>
                    )}
                    
                    {jobData.results.errors && jobData.results.errors.length > 0 && (
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {jobData.results.errors.length}
                        </div>
                        <div className="text-sm text-gray-600">Errors</div>
                      </div>
                    )}
                  </div>

                  {/* Error Details */}
                  {jobData.results.errors && jobData.results.errors.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Errors</h4>
                      <div className="space-y-2">
                        {jobData.results.errors.map((error, index) => (
                          <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                              <span className="text-sm text-red-800">{error}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3">
                    <button className="btn-outline flex items-center">
                      <EyeIcon className="h-4 w-4 mr-2" />
                      View Documents
                    </button>
                    <button className="btn-outline flex items-center">
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      Export Results
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No results available yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 