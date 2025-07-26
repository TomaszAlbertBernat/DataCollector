import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { JobWithClientState, JobStatus } from '@/types/api'

interface JobStore {
  // State
  jobs: JobWithClientState[]
  selectedJobIds: Set<string>
  isLoading: boolean
  error: string | null
  filters: {
    status?: JobStatus[]
    query?: string
  }

  // Actions
  setJobs: (jobs: JobWithClientState[]) => void
  addJob: (job: JobWithClientState) => void
  updateJob: (jobId: string, updates: Partial<JobWithClientState>) => void
  removeJob: (jobId: string) => void
  selectJob: (jobId: string) => void
  deselectJob: (jobId: string) => void
  selectAllJobs: () => void
  deselectAllJobs: () => void
  toggleJobSelection: (jobId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setFilters: (filters: Partial<JobStore['filters']>) => void
  
  // Computed selectors
  getJobById: (jobId: string) => JobWithClientState | undefined
  getSelectedJobs: () => JobWithClientState[]
  getFilteredJobs: () => JobWithClientState[]
  getJobsByStatus: (status: JobStatus) => JobWithClientState[]
}

export const useJobStore = create<JobStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    jobs: [],
    selectedJobIds: new Set(),
    isLoading: false,
    error: null,
    filters: {},

    // Actions
    setJobs: (jobs) =>
      set({ jobs: jobs.map(job => ({ ...job, clientId: crypto.randomUUID() })) }),

    addJob: (job) =>
      set((state) => ({
        jobs: [...state.jobs, { ...job, clientId: crypto.randomUUID() }],
      })),

    updateJob: (jobId, updates) =>
      set((state) => ({
        jobs: state.jobs.map((job) =>
          job.id === jobId ? { ...job, ...updates } : job
        ),
      })),

    removeJob: (jobId) =>
      set((state) => {
        const newSelectedIds = new Set(state.selectedJobIds)
        newSelectedIds.delete(jobId)
        return {
          jobs: state.jobs.filter((job) => job.id !== jobId),
          selectedJobIds: newSelectedIds,
        }
      }),

    selectJob: (jobId) =>
      set((state) => ({
        selectedJobIds: new Set([...state.selectedJobIds, jobId]),
      })),

    deselectJob: (jobId) =>
      set((state) => {
        const newSelectedIds = new Set(state.selectedJobIds)
        newSelectedIds.delete(jobId)
        return { selectedJobIds: newSelectedIds }
      }),

    selectAllJobs: () =>
      set((state) => ({
        selectedJobIds: new Set(state.jobs.map((job) => job.id)),
      })),

    deselectAllJobs: () =>
      set({ selectedJobIds: new Set() }),

    toggleJobSelection: (jobId) =>
      set((state) => {
        const newSelectedIds = new Set(state.selectedJobIds)
        if (newSelectedIds.has(jobId)) {
          newSelectedIds.delete(jobId)
        } else {
          newSelectedIds.add(jobId)
        }
        return { selectedJobIds: newSelectedIds }
      }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    setFilters: (filters) =>
      set((state) => ({
        filters: { ...state.filters, ...filters },
      })),

    // Computed selectors
    getJobById: (jobId) => get().jobs.find((job) => job.id === jobId),

    getSelectedJobs: () => {
      const { jobs, selectedJobIds } = get()
      return jobs.filter((job) => selectedJobIds.has(job.id))
    },

    getFilteredJobs: () => {
      const { jobs, filters } = get()
      let filtered = jobs

      if (filters.status && filters.status.length > 0) {
        filtered = filtered.filter((job) => filters.status!.includes(job.status))
      }

      if (filters.query) {
        const query = filters.query.toLowerCase()
        filtered = filtered.filter((job) =>
          job.query.toLowerCase().includes(query)
        )
      }

      return filtered
    },

    getJobsByStatus: (status) => get().jobs.filter((job) => job.status === status),
  }))
)

// Selector hooks for performance optimization
export const useJobById = (jobId: string) =>
  useJobStore((state) => state.getJobById(jobId))

export const useSelectedJobs = () =>
  useJobStore((state) => state.getSelectedJobs())

export const useFilteredJobs = () =>
  useJobStore((state) => state.getFilteredJobs())

export const useJobsByStatus = (status: JobStatus) =>
  useJobStore((state) => state.getJobsByStatus(status)) 