import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { 
  PlusIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { JobCreationForm } from '@/components/forms/JobCreationForm'
import { JobProgressCard } from '@/components/ui/JobProgressCard'
import { useJobStore } from '@/stores/jobStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { jobsApi } from '@/services/api'
import { JobStatus } from '../../../backend/src/types/job'

const statusFilters: { value: JobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Jobs' },
  { value: JobStatus.PENDING, label: 'Pending' },
  { value: JobStatus.RUNNING, label: 'Running' },
  { value: JobStatus.COMPLETED, label: 'Completed' },
  { value: JobStatus.FAILED, label: 'Failed' },
  { value: JobStatus.CANCELLED, label: 'Cancelled' },
]

export function JobsPage() {
  const [showJobForm, setShowJobForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { 
    jobs, 
    setJobs, 
    setLoading, 
    setError, 
    getFilteredJobs,
    setFilters,
  } = useJobStore()
  const { addNotification } = useNotificationStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Fetch jobs
  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.listJobs(),
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  // Update store when data changes
  useEffect(() => {
    if (jobsData?.data) {
      setJobs(jobsData.data)
    }
    setLoading(isLoading)
    setError(error instanceof Error ? error.message : null)
  }, [jobsData, isLoading, error, setJobs, setLoading, setError])

  // Update filters
  useEffect(() => {
    const filters: any = {}
    
    if (statusFilter !== 'all') {
      filters.status = [statusFilter]
    }
    
    if (searchQuery) {
      filters.query = searchQuery
    }
    
    setFilters(filters)
  }, [statusFilter, searchQuery, setFilters])

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.cancelJob(jobId, 'User cancelled'),
    onSuccess: () => {
      toast.success('Job cancelled successfully')
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
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

  const handleCancelJob = (jobId: string) => {
    if (confirm('Are you sure you want to cancel this job?')) {
      cancelJobMutation.mutate(jobId)
    }
  }

  const handleDeleteJob = (jobId: string) => {
    if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      // TODO: Implement delete job API call
      console.log('Delete job:', jobId)
    }
  }

  const handleViewJob = (jobId: string) => {
    navigate(`/jobs/${jobId}`)
  }

  const filteredJobs = getFilteredJobs()

  if (showJobForm) {
    return (
      <div className="max-w-4xl mx-auto">
        <JobCreationForm
          onSuccess={() => {
            setShowJobForm(false)
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
          }}
          onCancel={() => setShowJobForm(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Management</h1>
          <p className="text-gray-600">Monitor and manage your data collection jobs</p>
        </div>
        <button 
          onClick={() => setShowJobForm(true)}
          className="btn-primary flex items-center whitespace-nowrap"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          New Job
        </button>
      </div>

      {/* Filters and Search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs by query..."
              className="input-field pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
            className="input-field w-auto"
          >
            {statusFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-outline flex items-center whitespace-nowrap"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Additional filters will be added here (date range, source, etc.)
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && jobs.length === 0 && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading jobs...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card p-6 text-center">
          <p className="text-red-600 mb-4">Failed to load jobs: {String(error)}</p>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      )}

      {/* Jobs List */}
      {!isLoading && !error && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' && ` • ${statusFilter}`}
              {searchQuery && ` • "${searchQuery}"`}
            </h2>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="card p-12 text-center">
              <PlusIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No jobs found
              </h3>
              <p className="text-gray-600 mb-6">
                {jobs.length === 0 
                  ? "Get started by creating your first data collection job"
                  : "No jobs match your current filters"
                }
              </p>
              {jobs.length === 0 && (
                <button 
                  onClick={() => setShowJobForm(true)}
                  className="btn-primary"
                >
                  Create Your First Job
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredJobs.map((job) => (
                <JobProgressCard
                  key={job.id}
                  job={job}
                  onView={handleViewJob}
                  onCancel={handleCancelJob}
                  onDelete={handleDeleteJob}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 