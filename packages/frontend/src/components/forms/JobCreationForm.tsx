import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline'
import { jobsApi } from '@/services/api'
// import { useJobStore } from '@/stores/jobStore' // TODO: Implement when job store is ready
import { useNotificationStore } from '@/stores/notificationStore'
import type { CreateCollectionRequest } from '@/types/api'

// Validation schema
const jobCreationSchema = z.object({
  query: z.string()
    .min(3, 'Query must be at least 3 characters')
    .max(500, 'Query must be less than 500 characters'),
  sources: z.array(z.string()).optional(),
  maxResults: z.number()
    .min(1, 'Must be at least 1')
    .max(1000, 'Must be at most 1000')
    .optional(),
  fileTypes: z.array(z.string()).optional(),
  language: z.string().optional(),
  priority: z.number()
    .min(1, 'Priority must be 1-4')
    .max(4, 'Priority must be 1-4')
    .optional(),
  dateRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
})

type JobCreationFormData = z.infer<typeof jobCreationSchema>

interface JobCreationFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

const availableSources = [
  { id: 'scholar', name: 'Google Scholar', description: 'Academic papers and citations' },
  { id: 'pubmed', name: 'PubMed', description: 'Medical and life sciences literature' },
  { id: 'arxiv', name: 'arXiv', description: 'Preprint server for physics, math, CS' },
  { id: 'web', name: 'Web Search', description: 'General web document search' },
]

const availableFileTypes = [
  { id: 'pdf', name: 'PDF', description: 'Portable Document Format' },
  { id: 'txt', name: 'Text', description: 'Plain text files' },
  { id: 'csv', name: 'CSV', description: 'Comma-separated values' },
  { id: 'json', name: 'JSON', description: 'JavaScript Object Notation' },
]

export function JobCreationForm({ onSuccess, onCancel }: JobCreationFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  // const { addJob } = useJobStore() // TODO: Implement when job store is ready
  const { addNotification } = useNotificationStore()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<JobCreationFormData>({
    resolver: zodResolver(jobCreationSchema),
    defaultValues: {
      query: '',
      sources: ['scholar'],
      maxResults: 100,
      fileTypes: ['pdf'],
      language: 'en',
      priority: 2,
    },
  })

  // Watch for changes to update UI
  const watchedSources = watch('sources') || []
  const watchedFileTypes = watch('fileTypes') || []

  const createJobMutation = useMutation({
    mutationFn: (data: CreateCollectionRequest) => jobsApi.createCollection(data),
    onSuccess: (result) => {
      toast.success('Job created successfully!')
      
      // Add notification
      addNotification({
        type: 'success',
        title: 'Job Created',
        message: `Collection job started for query: "${result.jobId}"`,
        duration: 5000,
      })

      // Reset form
      reset()
      onSuccess?.()
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create job'
      toast.error(message)
      
      addNotification({
        type: 'error',
        title: 'Job Creation Failed',
        message,
        duration: 5000,
      })
    },
  })

  const onSubmit = (data: JobCreationFormData) => {
    const request: CreateCollectionRequest = {
      query: data.query,
      sources: data.sources,
      options: {
        maxResults: data.maxResults,
        fileTypes: data.fileTypes,
        language: data.language,
        priority: data.priority,
        dateRange: data.dateRange?.from || data.dateRange?.to ? {
          from: data.dateRange.from,
          to: data.dateRange.to,
        } : undefined,
      },
    }

    createJobMutation.mutate(request)
  }

  const toggleSource = (sourceId: string) => {
    const current = watchedSources
    const updated = current.includes(sourceId)
      ? current.filter(id => id !== sourceId)
      : [...current, sourceId]
    setValue('sources', updated)
  }

  const toggleFileType = (fileTypeId: string) => {
    const current = watchedFileTypes
    const updated = current.includes(fileTypeId)
      ? current.filter(id => id !== fileTypeId)
      : [...current, fileTypeId]
    setValue('fileTypes', updated)
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <PlusIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">
            Create Data Collection Job
          </h2>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Query Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Query *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('query')}
              type="text"
              placeholder="e.g., machine learning algorithms, climate change research..."
              className={`input-field pl-10 ${errors.query ? 'border-red-500' : ''}`}
            />
          </div>
          {errors.query && (
            <p className="mt-1 text-sm text-red-600">{errors.query.message}</p>
          )}
        </div>

        {/* Data Sources */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Data Sources
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableSources.map((source) => (
              <div
                key={source.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors duration-200 ${
                  watchedSources.includes(source.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => toggleSource(source.id)}
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={watchedSources.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{source.name}</div>
                    <div className="text-sm text-gray-600">{source.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Options */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            {/* Max Results */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Results
                </label>
                <input
                  {...register('maxResults', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  max="1000"
                  className={`input-field ${errors.maxResults ? 'border-red-500' : ''}`}
                />
                {errors.maxResults && (
                  <p className="mt-1 text-sm text-red-600">{errors.maxResults.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  {...register('priority', { valueAsNumber: true })}
                  className="input-field"
                >
                  <option value={1}>Low</option>
                  <option value={2}>Normal</option>
                  <option value={3}>High</option>
                  <option value={4}>Urgent</option>
                </select>
              </div>
            </div>

            {/* File Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                File Types
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {availableFileTypes.map((fileType) => (
                  <div
                    key={fileType.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors duration-200 text-center ${
                      watchedFileTypes.includes(fileType.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => toggleFileType(fileType.id)}
                  >
                    <input
                      type="checkbox"
                      checked={watchedFileTypes.includes(fileType.id)}
                      onChange={() => toggleFileType(fileType.id)}
                      className="mb-2"
                    />
                    <div className="font-medium text-gray-900">{fileType.name}</div>
                    <div className="text-xs text-gray-600">{fileType.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range (Optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <input
                    {...register('dateRange.from')}
                    type="date"
                    placeholder="From date"
                    className="input-field"
                  />
                </div>
                <div>
                  <input
                    {...register('dateRange.to')}
                    type="date"
                    placeholder="To date"
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-outline"
              disabled={createJobMutation.isPending}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={!isValid || createJobMutation.isPending}
          >
            {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  )
} 