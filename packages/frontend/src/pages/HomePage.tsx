import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { JobCreationForm } from '@/components/forms/JobCreationForm'
import { useJobStore } from '@/stores/jobStore'
import { systemApi } from '@/services/api'

export function HomePage() {
  const [showJobForm, setShowJobForm] = useState(false)
  const { jobs } = useJobStore()

  // Fetch system health for the dashboard stats
  const { data: healthData } = useQuery({
    queryKey: ['system-health'],
    queryFn: systemApi.getHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: false,
  })

  // Calculate stats from jobs
  const stats = {
    totalDocuments: jobs.reduce((sum, job) => sum + (job.results?.documentsDownloaded || 0), 0),
    completedJobs: jobs.filter(job => job.status === 'completed').length,
    activeJobs: jobs.filter(job => ['pending', 'running', 'analyzing', 'searching', 'downloading', 'processing', 'indexing'].includes(job.status)).length,
    failedJobs: jobs.filter(job => job.status === 'failed').length,
  }

  if (showJobForm) {
    return (
      <div className="max-w-4xl mx-auto">
        <JobCreationForm
          onSuccess={() => setShowJobForm(false)}
          onCancel={() => setShowJobForm(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome to DataCollector
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          AI-powered research data collection and analysis platform
        </p>
        {healthData && (
          <div className="mt-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              healthData.status === 'healthy' 
                ? 'bg-green-100 text-green-800' 
                : healthData.status === 'degraded'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                healthData.status === 'healthy' 
                  ? 'bg-green-400' 
                  : healthData.status === 'degraded'
                  ? 'bg-yellow-400'
                  : 'bg-red-400'
              }`} />
              System {healthData.status}
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* New Collection */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <PlusIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Start New Collection
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            Begin collecting research papers and documents with AI-powered search
          </p>
          <button 
            onClick={() => setShowJobForm(true)}
            className="btn-primary w-full"
          >
            Create Collection Job
          </button>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <ClockIcon className="h-4 w-4 text-yellow-500 mr-2" />
              <span className="text-gray-600">
                {stats.activeJobs} job{stats.activeJobs !== 1 ? 's' : ''} in progress
              </span>
            </div>
            <div className="flex items-center text-sm">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
              <span className="text-gray-600">
                {stats.completedJobs} job{stats.completedJobs !== 1 ? 's' : ''} completed
              </span>
            </div>
            {stats.failedJobs > 0 && (
              <div className="flex items-center text-sm">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-gray-600">
                  {stats.failedJobs} job{stats.failedJobs !== 1 ? 's' : ''} failed
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalDocuments}
          </div>
          <div className="text-sm text-gray-600">Total Documents</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {stats.completedJobs}
          </div>
          <div className="text-sm text-gray-600">Completed Jobs</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {stats.activeJobs}
          </div>
          <div className="text-sm text-gray-600">Active Jobs</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {healthData?.services?.length || 0}
          </div>
          <div className="text-sm text-gray-600">Services</div>
        </div>
      </div>

      {/* Recent Jobs Preview */}
      {jobs.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Jobs
            </h2>
            <a href="/jobs" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View all →
            </a>
          </div>
          <div className="space-y-3">
            {jobs.slice(0, 3).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {job.query}
                  </div>
                  <div className="text-xs text-gray-500">
                    {job.status} • {job.progress}%
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {new Date(job.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 