import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { 
  MagnifyingGlassIcon, 
  AdjustmentsHorizontalIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  TagIcon,
  UserIcon,
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { searchApi } from '@/services/api'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
import type { SearchRequest, SearchResult, SearchFilters, DocumentResponse } from '@/types/api'

// Mock search results for development
const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    title: 'Deep Learning Applications in Natural Language Processing',
    content: 'This paper presents a comprehensive survey of deep learning techniques applied to natural language processing tasks...',
    url: 'https://arxiv.org/abs/2021.00001',
    source: 'arXiv',
    authors: ['John Doe', 'Jane Smith'],
    publicationDate: '2021-03-15',
    fileType: 'pdf',
    fileSize: 2048000,
    relevanceScore: 0.95,
    highlights: [
      { field: 'title', fragments: ['<mark>Deep Learning</mark> Applications'] },
      { field: 'content', fragments: ['comprehensive survey of <mark>deep learning</mark> techniques'] }
    ]
  },
  {
    id: '2',
    title: 'Machine Learning for Climate Change Prediction',
    content: 'An analysis of various machine learning algorithms for predicting climate change patterns...',
    url: 'https://scholar.google.com/article2',
    source: 'Google Scholar',
    authors: ['Alice Johnson', 'Bob Wilson'],
    publicationDate: '2022-01-20',
    fileType: 'pdf',
    fileSize: 1536000,
    relevanceScore: 0.87,
    highlights: [
      { field: 'title', fragments: ['<mark>Machine Learning</mark> for Climate'] },
      { field: 'content', fragments: ['various <mark>machine learning</mark> algorithms'] }
    ]
  },
  {
    id: '3',
    title: 'Artificial Intelligence in Healthcare: A Review',
    content: 'This review examines the current state and future prospects of AI applications in healthcare...',
    url: 'https://pubmed.ncbi.nlm.nih.gov/article3',
    source: 'PubMed',
    authors: ['Dr. Sarah Chen', 'Dr. Michael Brown'],
    publicationDate: '2023-06-10',
    fileType: 'pdf',
    fileSize: 3072000,
    relevanceScore: 0.82,
    highlights: [
      { field: 'title', fragments: ['<mark>Artificial Intelligence</mark> in Healthcare'] },
      { field: 'content', fragments: ['current state and future prospects of <mark>AI applications</mark>'] }
    ]
  }
]

// Mock function to convert search result to document
const createMockDocument = (result: SearchResult): DocumentResponse => ({
  id: result.id,
  title: result.title,
  url: result.url,
  filePath: result.url || `/documents/${result.id}.${result.fileType}`,
  fileType: result.fileType,
  fileSize: result.fileSize || 0,
  source: result.source,
  authors: result.authors,
  publicationDate: result.publicationDate,
  abstract: result.content,
  keywords: ['AI', 'machine learning', 'research'],
  language: 'en',
  createdAt: new Date().toISOString(),
  metadata: {
    relevanceScore: result.relevanceScore,
    source: result.source,
    doi: `10.1000/example.${result.id}`
  }
})

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    sources: [],
    fileTypes: [],
    dateRange: {},
    authors: [],
    language: 'en'
  })

  // Search results (using mock data for now)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Document viewer state
  const [selectedDocument, setSelectedDocument] = useState<DocumentResponse | null>(null)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  // Simulate search API call
  const performSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Filter mock results based on search query
      const filteredResults = mockSearchResults.filter(result =>
        result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.authors?.some(author => author.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      
      setSearchResults(filteredResults)
      
      // Update URL with search query
      setSearchParams({ q: searchQuery })
      
      toast.success(`Found ${filteredResults.length} results`)
    } catch (error) {
      toast.error('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch()
    }
  }

  const handleViewDocument = (result: SearchResult) => {
    const document = createMockDocument(result)
    setSelectedDocument(document)
    setIsViewerOpen(true)
  }

  const handleDownloadDocument = async (result: SearchResult) => {
    try {
      // Create a mock download
      if (result.url) {
        window.open(result.url, '_blank')
        toast.success('Opening document in new tab')
      } else {
        toast('Download functionality will be implemented with backend API', { 
          icon: '💡',
          style: { background: '#3b82f6', color: 'white' }
        })
      }
    } catch (error) {
      toast.error('Download failed')
    }
  }

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Documents</h1>
        <p className="text-gray-600">Find research papers and documents from your collections</p>
      </div>

      {/* Search Interface */}
      <div className="card p-6">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search for research papers, datasets, or documents..."
              className="input-field pl-10"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-outline flex items-center ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
            Filters
          </button>
          <button 
            onClick={performSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="btn-primary"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Type
                </label>
                <select 
                  className="input-field"
                  onChange={(e) => setFilters({...filters, fileTypes: e.target.value ? [e.target.value] : []})}
                >
                  <option value="">All types</option>
                  <option value="pdf">PDF</option>
                  <option value="txt">Text</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source
                </label>
                <select 
                  className="input-field"
                  onChange={(e) => setFilters({...filters, sources: e.target.value ? [e.target.value] : []})}
                >
                  <option value="">All sources</option>
                  <option value="scholar">Google Scholar</option>
                  <option value="pubmed">PubMed</option>
                  <option value="arxiv">arXiv</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <select className="input-field">
                  <option value="">Any time</option>
                  <option value="last-week">Last week</option>
                  <option value="last-month">Last month</option>
                  <option value="last-year">Last year</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      {isSearching ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Searching documents...</p>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Found {searchResults.length} results for "{searchQuery}"
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>Sort by:</span>
              <select className="border-0 bg-transparent focus:ring-0 font-medium">
                <option>Relevance</option>
                <option>Date</option>
                <option>Title</option>
              </select>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-4">
            {searchResults.map((result) => (
              <div key={result.id} className="card p-6 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Title and Metadata */}
                    <div className="flex items-center space-x-2 mb-2">
                      <DocumentTextIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <h3 
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer"
                        onClick={() => handleViewDocument(result)}
                      >
                        <span dangerouslySetInnerHTML={{ 
                          __html: result.highlights?.find(h => h.field === 'title')?.fragments[0] || result.title 
                        }} />
                      </h3>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                        {result.fileType.toUpperCase()}
                      </span>
                    </div>

                    {/* Authors and Date */}
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      {result.authors && (
                        <div className="flex items-center">
                          <UserIcon className="h-4 w-4 mr-1" />
                          <span>{result.authors.join(', ')}</span>
                        </div>
                      )}
                      {result.publicationDate && (
                        <div className="flex items-center">
                          <CalendarDaysIcon className="h-4 w-4 mr-1" />
                          <span>{formatDate(result.publicationDate)}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <TagIcon className="h-4 w-4 mr-1" />
                        <span>{result.source}</span>
                      </div>
                    </div>

                    {/* Content Preview */}
                    <p className="text-gray-700 mb-3 line-clamp-3">
                      <span dangerouslySetInnerHTML={{ 
                        __html: result.highlights?.find(h => h.field === 'content')?.fragments[0] || 
                               result.content.substring(0, 200) + '...' 
                      }} />
                    </p>

                    {/* Metadata Footer */}
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Relevance: {Math.round(result.relevanceScore * 100)}%</span>
                      {result.fileSize && <span>Size: {formatFileSize(result.fileSize)}</span>}
                      {result.url && (
                        <a 
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          View Source →
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button 
                      onClick={() => handleViewDocument(result)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors duration-200"
                      title="View document"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDownloadDocument(result)}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors duration-200"
                      title="Download document"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Placeholder */}
          <div className="flex items-center justify-center pt-6">
            <div className="flex items-center space-x-2">
              <button className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                Previous
              </button>
              <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded">
                1
              </button>
              <button className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                2
              </button>
              <button className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                3
              </button>
              <button className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                Next
              </button>
            </div>
          </div>
        </div>
      ) : searchQuery && !isSearching ? (
        <div className="card p-12 text-center">
          <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No results found
          </h3>
          <p className="text-gray-600">
            Try adjusting your search terms or filters
          </p>
        </div>
      ) : (
        <div className="card p-6">
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Search for documents
            </h3>
            <p className="text-gray-600">
              Enter a search query above to find relevant documents and research papers
            </p>
          </div>
        </div>
      )}

      {/* Document Viewer */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          isOpen={isViewerOpen}
          onClose={() => {
            setIsViewerOpen(false)
            setSelectedDocument(null)
          }}
        />
      )}
    </div>
  )
} 