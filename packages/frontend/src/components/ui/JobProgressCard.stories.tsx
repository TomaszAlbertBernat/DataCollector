import type { Meta, StoryObj } from '@storybook/react'
import { JobProgressCard } from './JobProgressCard'
import type { JobWithClientState } from '../../types/api'

const meta: Meta<typeof JobProgressCard> = {
  title: 'Components/JobProgressCard',
  component: JobProgressCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    onView: { action: 'view' },
    onCancel: { action: 'cancel' },
    onDelete: { action: 'delete' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const mockJob: JobWithClientState = {
  id: 'test-job-1',
  type: 'collection' as any,
  status: 'running' as any,
  progress: 45,
  message: 'Downloading documents...',
  query: 'machine learning algorithms',
  createdAt: '2024-01-15T10:30:00Z',
  startedAt: '2024-01-15T10:31:00Z',
  estimatedTimeRemaining: 300,
  results: {
    documentsFound: 150,
    documentsDownloaded: 67,
    documentsProcessed: 45,
    errors: ['Failed to download document: timeout'],
  },
}

export const Running: Story = {
  args: {
    job: mockJob,
  },
}

export const Completed: Story = {
  args: {
    job: {
      ...mockJob,
      status: 'completed',
      progress: 100,
      message: 'Job completed successfully',
      completedAt: '2024-01-15T10:35:00Z',
      estimatedTimeRemaining: undefined,
    },
  },
}

export const Failed: Story = {
  args: {
    job: {
      ...mockJob,
      status: 'failed',
      progress: 67,
      message: 'Failed to download documents: network error',
      results: {
        documentsFound: 150,
        documentsDownloaded: 67,
        documentsProcessed: 45,
        errors: ['Network timeout', 'Invalid file format'],
      },
    },
  },
}

export const Pending: Story = {
  args: {
    job: {
      ...mockJob,
      status: 'pending',
      progress: 0,
      message: 'Waiting to start...',
      estimatedTimeRemaining: undefined,
    },
  },
}

export const Cancelled: Story = {
  args: {
    job: {
      ...mockJob,
      status: 'cancelled',
      progress: 23,
      message: 'Job was cancelled by user',
      estimatedTimeRemaining: undefined,
    },
  },
}

export const LongQuery: Story = {
  args: {
    job: {
      ...mockJob,
      query: 'This is a very long query that demonstrates how the component handles text overflow and truncation in the job title display',
    },
  },
}

export const NoResults: Story = {
  args: {
    job: {
      ...mockJob,
      results: undefined,
    },
  },
}

export const NoMessage: Story = {
  args: {
    job: {
      ...mockJob,
      message: undefined,
    },
  },
} 