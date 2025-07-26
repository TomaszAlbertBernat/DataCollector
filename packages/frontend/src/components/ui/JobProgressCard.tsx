import { useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  EyeIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useJobStore } from '@/stores/jobStore'
import { useNotificationStore } from '@/stores/notificationStore'
import type { JobWithClientState, JobStatus } from '@/types/api'

interface JobProgressCardProps {
  job: JobWithClientState
  onView?: (jobId: string) => void
  onCancel?: (jobId: string) => void
  onDelete?: (jobId: string) => void
}

const statusConfig: Record<JobStatus, { 
  color: string
  icon: typeof ClockIcon
  bgColor: string
}> = {
  pending: { color: 'text-yellow-600', icon: ClockIcon, bgColor: 'bg-yellow-100' },
  running: { color: 'text-blue-600', icon: PlayIcon, bgColor: 'bg-blue-100' },
  analyzing: { color: 'text-blue-600', icon: PlayIcon, bgColor: 'bg-blue-100' },
  searching: { color: 'text-blue-600', icon: PlayIcon, bgColor: 'bg-blue-100' },
  downloading: { color: 'text-blue-600', icon: PlayIcon, bgColor: 'bg-blue-100' },
  processing: { color: 'text-blue-600', icon: PlayIcon, bgColor: 'bg-blue-100' },
  indexing: { color: 'text-blue-600', icon: PlayIcon, bgColor: 'bg-blue-100' },
  completed: { color: 'text-green-600', icon: CheckCircleIcon, bgColor: 'bg-green-100' },
  failed: { color: 'text-red-600', icon: XCircleIcon, bgColor: 'bg-red-100' },
  cancelled: { color: 'text-gray-600', icon: XCircleIcon, bgColor: 'bg-gray-100' },
}

export function JobProgressCard({ job, onView, onCancel, onDelete }: JobProgressCardProps) {
  const { updateJob } = useJobStore()
  const { addNotification } = useNotificationStore()
  const { subscribeToJobUpdates } = useWebSocket()

  // Subscribe to real-time updates for this job
  useEffect(() => {
    const unsubscribe = subscribeToJobUpdates(
      job.id,
      // Status updates
      (statusUpdate) => {
        updateJob(job.id, {
          status: statusUpdate.status,
          progress: statusUpdate.progress,
          message: statusUpdate.message,
        })

        // Show notification for important status changes
        if (statusUpdate.status === 'completed') {
          addNotification({
            type: 'success',
            title: 'Job Completed',
            message: `Collection job "${job.query}" finished successfully`,
            duration: 5000,
          })
        } else if (statusUpdate.status === 'failed') {
          addNotification({
            type: 'error',
            title: 'Job Failed',
            message: `Collection job "${job.query}" failed: ${statusUpdate.message || 'Unknown error'}`,
            duration: 10000,
          })
        }
      },
      // Progress updates
      (progressUpdate) => {
        updateJob(job.id, {
          progress: progressUpdate.progress,
          message: progressUpdate.message,
          estimatedTimeRemaining: progressUpdate.eta,
        })
      }
    )

    return unsubscribe
  }, [job.id, updateJob, addNotification, subscribeToJobUpdates])

  const config = statusConfig[job.status]
  const StatusIcon = config.icon

  const isActive = ['pending', 'running', 'analyzing', 'searching', 'downloading', 'processing', 'indexing'].includes(job.status)
  const canCancel = ['pending', 'running', 'analyzing', 'searching', 'downloading', 'processing', 'indexing'].includes(job.status)
  const canDelete = ['completed', 'failed', 'cancelled'].includes(job.status)

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return null
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `~${hours}h ${minutes % 60}m remaining`
    } else if (minutes > 0) {
      return `~${minutes}m remaining`
    } else {
      return `~${seconds}s remaining`
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  return (
    <div 
      className="card p-6 hover:shadow-md transition-shadow duration-200"
      role="article"
      aria-labelledby={`job-title-${job.id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <StatusIcon className={`h-5 w-5 ${config.color}`} aria-hidden="true" />
            <h3 
              id={`job-title-${job.id}`}
              className="text-lg font-medium text-gray-900 truncate"
            >
              {job.query}
            </h3>
            <span 
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${config.color} ${config.bgColor}`}
              aria-label={`Job status: ${job.status}`}
            >
              {job.status}
            </span>
          </div>
          
          {job.message && (
            <p className="text-sm text-gray-600 mb-2" aria-live="polite">
              {job.message}
            </p>
          )}
          
          <div className="text-sm text-gray-500">
            Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {onView && (
            <button
              onClick={() => onView(job.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onView(job.id))}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              title="View details"
              aria-label={`View details for job: ${job.query}`}
            >
              <EyeIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(job.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onCancel(job.id))}
              className="p-2 text-gray-400 hover:text-yellow-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 rounded"
              title="Cancel job"
              aria-label={`Cancel job: ${job.query}`}
            >
              <StopIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          
          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(job.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onDelete(job.id))}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
              title="Delete job"
              aria-label={`Delete job: ${job.query}`}
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isActive && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {job.progress}%
            </span>
            {job.estimatedTimeRemaining && (
              <span className="text-sm text-gray-500">
                {formatTimeRemaining(job.estimatedTimeRemaining)}
              </span>
            )}
          </div>
          <div 
            className="w-full bg-gray-200 rounded-full h-2"
            role="progressbar"
            aria-valuenow={job.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Job progress: ${job.progress}%`}
          >
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Summary */}
      {job.results && (
        <div 
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm"
          role="region"
          aria-label="Job results summary"
        >
          {job.results.documentsFound !== undefined && (
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600" aria-label={`${job.results.documentsFound} documents found`}>
                {job.results.documentsFound}
              </div>
              <div className="text-gray-600">Found</div>
            </div>
          )}
          
          {job.results.documentsDownloaded !== undefined && (
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600" aria-label={`${job.results.documentsDownloaded} documents downloaded`}>
                {job.results.documentsDownloaded}
              </div>
              <div className="text-gray-600">Downloaded</div>
            </div>
          )}
          
          {job.results.documentsProcessed !== undefined && (
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600" aria-label={`${job.results.documentsProcessed} documents processed`}>
                {job.results.documentsProcessed}
              </div>
              <div className="text-gray-600">Processed</div>
            </div>
          )}
          
          {job.results.errors && job.results.errors.length > 0 && (
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600" aria-label={`${job.results.errors.length} errors occurred`}>
                {job.results.errors.length}
              </div>
              <div className="text-gray-600">Errors</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 