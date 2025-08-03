import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DocumentViewer } from '../components/ui/DocumentViewer'
import { documentsApi } from '../services/api'

// Mock the API
vi.mock('../services/api', () => ({
  documentsApi: {
    getDocument: vi.fn(),
    getDocumentContent: vi.fn(),
    downloadDocument: vi.fn()
  }
}))

const mockDocumentsApi = documentsApi as any

// Mock window.URL.createObjectURL
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL
  }
})

// Mock document.createElement and related methods
const mockClick = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockCreateElement = vi.fn(() => ({
  href: '',
  download: '',
  click: mockClick
}))

Object.defineProperty(window.document, 'createElement', {
  value: mockCreateElement
})

Object.defineProperty(window.document, 'body', {
  value: {
    appendChild: mockAppendChild,
    removeChild: mockRemoveChild
  }
})

describe('DocumentViewer', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
    
    // Reset mocks
    vi.clearAllMocks()
    mockCreateObjectURL.mockReturnValue('blob:mock-url')
  })

  const renderDocumentViewer = (props: {
    documentId: string
    isOpen: boolean
    onClose: () => void
  }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DocumentViewer {...props} />
      </QueryClientProvider>
    )
  }

  const mockDocument = {
    id: 'test-doc-1',
    title: 'Test Document',
    filePath: '/uploads/test-doc.txt',
    fileType: 'txt',
    fileSize: 45680,
    source: 'Test Source',
    authors: ['Test Author'],
    publicationDate: '2024-01-15',
    abstract: 'This is a test document abstract.',
    keywords: ['test', 'document'],
    language: 'en',
    createdAt: '2024-01-15T10:00:00Z',
    metadata: {
      category: 'test',
      type: 'document'
    }
  }

  const mockContent = {
    content: 'This is the full content of the test document.',
    highlights: [
      {
        field: 'content',
        fragments: ['This is the <mark>full content</mark>']
      }
    ],
    metadata: {
      wordCount: 10,
      readingTime: '1 minute'
    }
  }

  it('renders loading state when document is loading', () => {
    mockDocumentsApi.getDocument.mockImplementation(() => new Promise(() => {}))
    
    renderDocumentViewer({
      documentId: 'test-doc-1',
      isOpen: true,
      onClose: vi.fn()
    })

    expect(screen.getByText('Loading document...')).toBeInTheDocument()
  })

  it('renders error state when document fails to load', async () => {
    mockDocumentsApi.getDocument.mockRejectedValue(new Error('Document not found'))
    
    renderDocumentViewer({
      documentId: 'test-doc-1',
      isOpen: true,
      onClose: vi.fn()
    })

    await waitFor(() => {
      expect(screen.getByText('Failed to load document')).toBeInTheDocument()
    })
  })

  it('renders document content when loaded successfully', async () => {
    mockDocumentsApi.getDocument.mockResolvedValue(mockDocument)
    mockDocumentsApi.getDocumentContent.mockResolvedValue(mockContent)
    
    renderDocumentViewer({
      documentId: 'test-doc-1',
      isOpen: true,
      onClose: vi.fn()
    })

    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument()
    })
  })

  it('does not render when isOpen is false', () => {
    renderDocumentViewer({
      documentId: 'test-doc-1',
      isOpen: false,
      onClose: vi.fn()
    })

    expect(screen.queryByText('Test Document')).not.toBeInTheDocument()
  })

  it('handles PDF documents with placeholder content', async () => {
    const pdfDocument = { ...mockDocument, fileType: 'pdf' }
    mockDocumentsApi.getDocument.mockResolvedValue(pdfDocument)
    
    renderDocumentViewer({
      documentId: 'test-doc-1',
      isOpen: true,
      onClose: vi.fn()
    })

    await waitFor(() => {
      expect(screen.getByText('PDF Viewer')).toBeInTheDocument()
    })
  })

  it('handles unsupported file types', async () => {
    const unsupportedDocument = { ...mockDocument, fileType: 'exe' }
    mockDocumentsApi.getDocument.mockResolvedValue(unsupportedDocument)
    
    renderDocumentViewer({
      documentId: 'test-doc-1',
      isOpen: true,
      onClose: vi.fn()
    })

    await waitFor(() => {
      expect(screen.getByText('Preview not available')).toBeInTheDocument()
    })
  })
}) 