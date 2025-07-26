import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { JobProgressCard } from '../JobProgressCard'
import type { JobWithClientState } from '../../../../types/api'

// Mock the stores
vi.mock('@/stores/jobStore', () => ({
  useJobStore: () => ({
    updateJob: vi.fn(),
  }),
}))

vi.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
  }),
}))

// Mock the WebSocket hook
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    subscribeToJobUpdates: vi.fn(() => vi.fn()), // Return unsubscribe function
  }),
}))

const mockJob: JobWithClientState = {
  id: 'test-job-1',
  type: 'collection',
  status: 'running',
  progress: 45,
  message: 'Downloading documents...',
  query: 'machine learning algorithms',
  createdAt: '2024-01-15T10:30:00Z',
  startedAt: '2024-01-15T10:31:00Z',
  estimatedTimeRemaining: 300, // 5 minutes
  results: {
    documentsFound: 150,
    documentsDownloaded: 67,
    documentsProcessed: 45,
    errors: ['Failed to download document: timeout'],
  },
}

describe('JobProgressCard', () => {
  it('renders job information correctly', () => {
    const mockOnView = vi.fn()
    const mockOnCancel = vi.fn()
    const mockOnDelete = vi.fn()

    render(
      <JobProgressCard
        job={mockJob}
        onView={mockOnView}
        onCancel={mockOnCancel}
        onDelete={mockOnDelete}
      />
    )

    // Check if job query is displayed
    expect(screen.getByText('machine learning algorithms')).toBeInTheDocument()

    // Check if status is displayed
    expect(screen.getByText('running')).toBeInTheDocument()

    // Check if progress is displayed
    expect(screen.getByText('Progress: 45%')).toBeInTheDocument()

    // Check if time remaining is displayed
    expect(screen.getByText('~5m remaining')).toBeInTheDocument()

    // Check if results are displayed
    expect(screen.getByText('150')).toBeInTheDocument() // documents found
    expect(screen.getByText('67')).toBeInTheDocument() // documents downloaded
    expect(screen.getByText('45')).toBeInTheDocument() // documents processed
    expect(screen.getByText('1')).toBeInTheDocument() // errors count
  })

  it('shows progress bar for active jobs', () => {
    render(
      <JobProgressCard
        job={mockJob}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    // Progress bar should be visible for running jobs
    const progressBar = screen.getByRole('progressbar', { hidden: true })
    expect(progressBar).toBeInTheDocument()
  })

  it('hides progress bar for completed jobs', () => {
    const completedJob = { ...mockJob, status: 'completed', progress: 100 }
    
    render(
      <JobProgressCard
        job={completedJob}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    // Progress bar should not be visible for completed jobs
    expect(screen.queryByText('Progress: 100%')).not.toBeInTheDocument()
  })

  it('calls onView when view button is clicked', () => {
    const mockOnView = vi.fn()
    
    render(
      <JobProgressCard
        job={mockJob}
        onView={mockOnView}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const viewButton = screen.getByTitle('View details')
    fireEvent.click(viewButton)

    expect(mockOnView).toHaveBeenCalledWith('test-job-1')
  })

  it('calls onCancel when cancel button is clicked', () => {
    const mockOnCancel = vi.fn()
    
    render(
      <JobProgressCard
        job={mockJob}
        onView={vi.fn()}
        onCancel={mockOnCancel}
        onDelete={vi.fn()}
      />
    )

    const cancelButton = screen.getByTitle('Cancel job')
    fireEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalledWith('test-job-1')
  })

  it('shows cancel button for active jobs', () => {
    render(
      <JobProgressCard
        job={mockJob}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByTitle('Cancel job')).toBeInTheDocument()
  })

  it('shows delete button for completed jobs', () => {
    const completedJob = { ...mockJob, status: 'completed' }
    
    render(
      <JobProgressCard
        job={completedJob}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByTitle('Delete job')).toBeInTheDocument()
  })

  it('displays job message when available', () => {
    render(
      <JobProgressCard
        job={mockJob}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Downloading documents...')).toBeInTheDocument()
  })

  it('displays creation time', () => {
    render(
      <JobProgressCard
        job={mockJob}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    // Should show relative time like "2 hours ago"
    expect(screen.getByText(/Created/)).toBeInTheDocument()
  })
}) 