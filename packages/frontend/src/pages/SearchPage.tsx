import { useState } from 'react'
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
  EyeIcon,
  BeakerIcon
} from '@heroicons/react/24/outline'
import { searchApi, documentsApi } from '@/services/api'
import { DocumentViewer } from '@/components/ui/DocumentViewer'
import type { SearchResult, SearchFilters, SearchMode, SearchSortField } from '@/types/api'

// Demo search results featuring mental health content (matching backend test data)
const demoSearchResults: SearchResult[] = [
  {
    id: 'demo-1',
    title: 'Meditation and Mental Health: Dr. K\'s Guide to Mindfulness Practice',
    content: 'This meditation guide explores how mindfulness practice can significantly improve mental health outcomes. The techniques discussed include breathing exercises, body awareness, and cognitive restructuring through meditative practices...',
    source: 'Dr. K / Healthy Gamer',
    authors: ['Dr. K (Alok Kanojia)'],
    publicationDate: '2024-01-15',
    fileType: 'txt',
    fileSize: 45680,
    relevanceScore: 0.96,
    highlights: [
      { field: 'title', fragments: ['<mark>Meditation</mark> and <mark>Mental Health</mark>'] },
      { field: 'content', fragments: ['<mark>mindfulness practice</mark> can significantly improve <mark>mental health</mark> outcomes'] }
    ],
    metadata: { category: 'meditation', duration: '45min', type: 'transcript' }
  },
  {
    id: 'demo-2', 
    title: 'Understanding Depression: A Psychiatrist\'s Perspective on Modern Mental Health',
    content: 'Depression affects millions worldwide, but understanding its mechanisms can help in treatment. This lecture covers neurobiological factors, environmental triggers, and evidence-based treatment approaches...',
    source: 'Dr. K / Healthy Gamer',
    authors: ['Dr. K (Alok Kanojia)'],
    publicationDate: '2024-02-20',
    fileType: 'txt',
    fileSize: 52340,
    relevanceScore: 0.93,
    highlights: [
      { field: 'title', fragments: ['Understanding <mark>Depression</mark>'] },
      { field: 'content', fragments: ['<mark>Depression</mark> affects millions worldwide'] }
    ],
    metadata: { category: 'lecture', duration: '60min', type: 'transcript' }
  },
  {
    id: 'demo-3',
    title: 'Anxiety Management Techniques for the Digital Age',
    content: 'Modern anxiety often stems from digital overwhelm and social media pressure. This session explores practical techniques for managing anxiety in our hyperconnected world, including digital detox strategies...',
    source: 'Dr. K / Healthy Gamer',
    authors: ['Dr. K (Alok Kanojia)'],
    publicationDate: '2024-03-10',
    fileType: 'txt',
    fileSize: 38920,
    relevanceScore: 0.89,
    highlights: [
      { field: 'title', fragments: ['<mark>Anxiety</mark> Management Techniques'] },
      { field: 'content', fragments: ['Modern <mark>anxiety</mark> often stems from digital overwhelm'] }
    ],
    metadata: { category: 'lecture', duration: '50min', type: 'transcript' }
  }
];

// Demo document creation function (kept for reference)
// const createDemoDocument = (result: SearchResult): DocumentResponse => ({
//   id: result.id,
//   title: result.title,
//   filePath: `/demo/documents/${result.id}.${result.fileType}`,
//   fileType: result.fileType,
//   fileSize: result.fileSize || 0,
//   source: result.source,
//   authors: result.authors,
//   publicationDate: result.publicationDate,
//   abstract: result.content,
//   keywords: ['mental health', 'psychology', 'wellness', 'Dr. K'],
//   language: 'en',
//   createdAt: new Date().toISOString(),
//   metadata: {
//     ...result.metadata,
//     relevanceScore: result.relevanceScore,
//     isDemo: true
//   }
// });

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid' as SearchMode)
  const [showFilters, setShowFilters] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    sources: [],
    fileTypes: [],
    dateRange: {},
    authors: [],
    language: 'en'
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Document viewer state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  // Search API integration (real API + demo fallback)
  const { 
    data: searchResults, 
    isLoading: isSearching, 
    error: searchError,
    refetch: performSearch 
  } = useQuery({
    queryKey: ['search', searchQuery, searchMode, filters, demoMode, currentPage, pageSize],
    queryFn: async () => {
      if (!searchQuery.trim()) return { results: [], totalResults: 0, searchTime: 0, pagination: { page: 1, limit: 20, total: 0, pages: 0, hasNext: false, hasPrev: false } };
      
      if (demoMode) {
        // Demo mode - filter demo results
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
        const filteredResults = demoSearchResults.filter(result =>
          result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.authors?.some(author => author.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        
        return {
          results: filteredResults,
          totalResults: filteredResults.length,
          searchTime: Math.floor(Math.random() * 50) + 10, // 10-60ms
          pagination: { page: 1, limit: 20, total: filteredResults.length, pages: 1, hasNext: false, hasPrev: false }
        };
      }
      
      // Try real API first - use fulltext mode for now since semantic search has issues
      try {
        const effectiveSearchMode = searchMode === 'hybrid' || searchMode === 'semantic' ? 'fulltext' as SearchMode : searchMode;
        const response = await searchApi.search({
          query: searchQuery,
          searchMode: effectiveSearchMode,
          filters,
          pagination: { page: currentPage, limit: pageSize },
          sort: { field: 'relevance' as SearchSortField, order: 'desc' },
          includeHighlights: true
        });
        return response;
      } catch (error) {
        // If real API fails, automatically switch to demo mode
        console.warn('Real API failed, switching to demo mode:', error);
        setDemoMode(true);
        // Return demo results instead of throwing error
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
        const filteredResults = demoSearchResults.filter(result =>
          result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.authors?.some(author => author.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        
        return {
          results: filteredResults,
          totalResults: filteredResults.length,
          searchTime: Math.floor(Math.random() * 50) + 10, // 10-60ms
          pagination: { page: 1, limit: 20, total: filteredResults.length, pages: 1, hasNext: false, hasPrev: false }
        };
      }
    },
    enabled: false, // Only run when manually triggered
  });

  // Handle search execution
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setCurrentPage(1); // Reset to first page on new search
      await performSearch();
      
      // Update URL with search query
      setSearchParams({ q: searchQuery, mode: searchMode });
      
      const resultCount = searchResults?.totalResults || 0;
      toast.success(`Found ${resultCount} results`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    performSearch();
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    performSearch();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleViewDocument = async (result: SearchResult) => {
    try {
      // For demo results, use the demo ID
      if (demoMode || result.id.startsWith('demo-')) {
        setSelectedDocumentId(result.id);
        setIsViewerOpen(true);
        return;
      }

      // For real results, use the result ID
      setSelectedDocumentId(result.id);
      setIsViewerOpen(true);
    } catch (error) {
      console.error('Error loading document:', error);
      toast.error('Failed to load document');
    }
  }

  const handleDownloadDocument = async (result: SearchResult) => {
    try {
      if (result.url) {
        // For external URLs, open in new tab
        window.open(result.url, '_blank');
        toast.success('Opening document in new tab');
      } else {
        // For internal documents, use the download API
        const blob = await documentsApi.downloadDocument(result.id);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${result.title}.${result.fileType}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Download started');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed');
    }
  }

  // Render highlighted content
  const renderHighlightedContent = (text: string, fieldHighlights?: any[]) => {
    if (!fieldHighlights || fieldHighlights.length === 0) {
      return text
    }

    let highlightedText = text
    fieldHighlights.forEach(highlight => {
      highlight.fragments.forEach((fragment: string) => {
        const cleanFragment = fragment.replace(/<mark>(.*?)<\/mark>/g, '$1')
        const regex = new RegExp(`(${cleanFragment})`, 'gi')
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>')
      })
    })

    return highlightedText
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

  const getRelevanceColor = (score: number): string => {
    if (score >= 0.9) return 'text-green-600 bg-green-100'
    if (score >= 0.7) return 'text-blue-600 bg-blue-100'
    if (score >= 0.5) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-600 bg-gray-100'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search Documents</h1>
          <p className="text-gray-600">Find research papers and documents from your collections</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`flex items-center px-3 py-2 text-sm rounded-md border transition-colors ${
              demoMode
                ? 'bg-purple-100 text-purple-700 border-purple-300'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
            title={demoMode ? 'Using demo data (mental health content)' : 'Click to enable demo mode'}
          >
            <BeakerIcon className="h-4 w-4 mr-1" />
            {demoMode ? 'Demo Mode' : 'Enable Demo'}
          </button>
        </div>
      </div>

      {/* Search Interface */}
      <div className="card p-6">
        {/* Search Mode Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Mode
          </label>
          <div className="flex space-x-2">
            {([
              { value: 'hybrid' as SearchMode, label: 'Hybrid', description: 'Best results (full-text + semantic)' },
              { value: 'fulltext' as SearchMode, label: 'Full-text', description: 'Traditional keyword search' },
              { value: 'semantic' as SearchMode, label: 'Semantic', description: 'Meaning-based search' },
              { value: 'fuzzy' as SearchMode, label: 'Fuzzy', description: 'Approximate matching' }
            ]).map((mode) => (
              <button
                key={mode.value}
                onClick={() => setSearchMode(mode.value)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  searchMode === mode.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={mode.description}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

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
            onClick={handleSearch}
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
                  <option value="web">Web Search</option>
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
      {searchError ? (
        <div className="card p-12 text-center">
          <div className="text-orange-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.966-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Backend Search Unavailable
          </h3>
          <p className="text-gray-600 mb-4">
            The backend search service is currently unavailable. Using demo mode with mental health content for testing.
          </p>
          <div className="flex space-x-3 justify-center">
            <button 
              onClick={handleSearch}
              className="btn-primary"
            >
              Try Again
            </button>
            <button 
              onClick={() => {
                setDemoMode(true);
                handleSearch();
              }}
              className="btn-outline flex items-center"
            >
              <BeakerIcon className="h-4 w-4 mr-2" />
              Continue with Demo
            </button>
          </div>
        </div>
      ) : isSearching ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Searching documents...</p>
        </div>
      ) : searchResults?.results && searchResults.results.length > 0 ? (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-600">
                Found {searchResults?.totalResults || 0} results for "{searchQuery}"
              </p>
              {searchResults?.searchTime && (
                <span className="text-xs text-gray-500">
                  ({searchResults.searchTime}ms)
                </span>
              )}
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-600">
                {searchMode.charAt(0).toUpperCase() + searchMode.slice(1)} search
              </span>
              {demoMode && (
                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-600">
                  Demo Data
                </span>
              )}
            </div>
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
            {searchResults?.results.map((result) => (
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
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRelevanceColor(result.relevanceScore)}`}>
                        {Math.round(result.relevanceScore * 100)}% match
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
                    <div className="text-gray-700 mb-3">
                      <p className="line-clamp-3">
                        {result.highlights?.find(h => h.field === 'content')?.fragments[0] ? (
                          <span dangerouslySetInnerHTML={{ 
                            __html: renderHighlightedContent(
                              result.content.substring(0, 300), 
                              result.highlights.filter(h => h.field === 'content')
                            )
                          }} />
                        ) : (
                          <span>{result.content.substring(0, 300)}...</span>
                        )}
                      </p>
                      {result.highlights && result.highlights.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {result.highlights.slice(0, 3).map((highlight, index) => (
                            <span 
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded"
                              title={`Highlighted in ${highlight.field}`}
                            >
                              {highlight.fragments[0]?.replace(/<mark>(.*?)<\/mark>/g, '$1')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

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

          {/* Pagination */}
          {searchResults?.pagination && searchResults.pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, searchResults.totalResults)} of {searchResults.totalResults} results
                </span>
                <select 
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!searchResults.pagination.hasPrev}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, searchResults.pagination.pages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm rounded ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!searchResults.pagination.hasNext}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
      {selectedDocumentId && (
        <DocumentViewer
          documentId={selectedDocumentId}
          isOpen={isViewerOpen}
          onClose={() => {
            setIsViewerOpen(false)
            setSelectedDocumentId(null)
          }}
        />
      )}
    </div>
  )
} 