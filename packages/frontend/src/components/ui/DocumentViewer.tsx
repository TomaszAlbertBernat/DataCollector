import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { documentsApi } from '@/services/api'

interface DocumentViewerProps {
  documentId: string
  isOpen: boolean
  onClose: () => void
}

export function DocumentViewer({ documentId, isOpen, onClose }: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [content, setContent] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<any[]>([])
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  // Fetch document data
  const { data: document, isLoading, error } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentsApi.getDocument(documentId),
    enabled: isOpen && !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch document content when document is loaded
  useEffect(() => {
    if (document && isOpen) {
      setIsLoadingContent(true)
      documentsApi.getDocumentContent(documentId)
        .then((contentData: { content: string; highlights?: any[]; metadata?: any }) => {
          setContent(contentData.content)
          setHighlights(contentData.highlights || [])
        })
        .catch((error: Error) => {
          console.error('Failed to load document content:', error)
          // Fallback to abstract if content loading fails
          if (document.abstract) {
            setContent(document.abstract)
          }
        })
        .finally(() => {
          setIsLoadingContent(false)
        })
    }
  }, [document, documentId, isOpen])

  if (!isOpen) return null

  if (isLoading) {
    return (
      <div className="modal-mobile">
        <div className="flex min-h-full items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          <div className="modal-content relative transform overflow-hidden shadow-xl transition-all w-full h-full sm:h-[90vh] sm:max-w-6xl sm:rounded-lg">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading document...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="modal-mobile">
        <div className="flex min-h-full items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
          <div className="modal-content relative transform overflow-hidden shadow-xl transition-all w-full h-full sm:h-[90vh] sm:max-w-6xl sm:rounded-lg">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Failed to load document</p>
                <p className="text-sm text-gray-500 mb-4">
                  {error ? (error as Error).message : 'Document not found'}
                </p>
                <button
                  onClick={onClose}
                  className="btn-mobile"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isPDF = document.fileType === 'pdf'
  const isText = ['txt', 'md', 'json'].includes(document.fileType)

  const handleDownload = async () => {
    try {
      const blob = await documentsApi.downloadDocument(documentId)
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${document.title}.${document.fileType}`
      window.document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      window.document.body.removeChild(link)
    } catch (error) {
      console.error('Download failed:', error)
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

  return (
    <div className="modal-mobile">
      <div className="flex min-h-full items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="modal-content relative transform overflow-hidden shadow-xl transition-all w-full h-full sm:h-[90vh] sm:max-w-6xl sm:rounded-lg">
          {/* Header */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 safe-area-top">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                    {document.title}
                  </h3>
                  <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-600">
                    <span>{document.fileType.toUpperCase()}</span>
                    <span className="hidden sm:inline">{formatFileSize(document.fileSize)}</span>
                    {document.authors && (
                      <span className="hidden md:inline truncate">
                        by {document.authors.join(', ')}
                      </span>
                    )}
                    {document.publicationDate && (
                      <span className="hidden lg:inline">
                        {formatDate(document.publicationDate)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                {/* PDF Controls - Desktop */}
                {isPDF && (
                  <div className="hidden sm:flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        <ArrowLeftIcon className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-gray-600 px-2">
                        Page {currentPage}
                      </span>
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <ArrowRightIcon className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="h-6 w-px bg-gray-300" />
                    
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setZoom(Math.max(50, zoom - 25))}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Zoom out"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-gray-600 px-2 min-w-[4rem] text-center">
                        {zoom}%
                      </span>
                      <button
                        onClick={() => setZoom(Math.min(200, zoom + 25))}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Zoom in"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="h-6 w-px bg-gray-300" />
                  </div>
                )}
                
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors duration-200"
                  title="Download document"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
                
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile PDF Controls */}
          {isPDF && (
            <div className="sm:hidden bg-white px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="btn-outline py-1 px-2 text-sm disabled:opacity-50"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="btn-outline py-1 px-2 text-sm"
                >
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setZoom(Math.max(50, zoom - 25))}
                  className="btn-outline py-1 px-2 text-sm"
                  title="Zoom out"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom(Math.min(200, zoom + 25))}
                  className="btn-outline py-1 px-2 text-sm"
                  title="Zoom in"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto scroll-momentum" 
               style={{ height: isPDF ? 'calc(100vh - 160px)' : 'calc(100vh - 100px)' }}>
            {isPDF ? (
              <div className="flex justify-center p-2 sm:p-4 bg-gray-100 min-h-full">
                <div 
                  className="bg-white shadow-lg w-full max-w-4xl"
                  style={{ 
                    transform: `scale(${zoom / 100})`, 
                    transformOrigin: 'top center',
                    minHeight: '100%'
                  }}
                >
                  {/* PDF Viewer Placeholder */}
                  <div className="w-full h-[600px] sm:h-[800px] bg-white border border-gray-300 flex items-center justify-center">
                    <div className="text-center p-4">
                      <DocumentTextIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2 text-sm sm:text-base">PDF Viewer</p>
                      <p className="text-xs sm:text-sm text-gray-500 mb-4">
                        PDF rendering will be implemented when react-pdf is properly configured
                      </p>
                      <button
                        onClick={handleDownload}
                        className="btn-mobile"
                      >
                        Download to View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : isText ? (
              <div className="p-4 sm:p-6">
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6 font-mono text-xs sm:text-sm leading-relaxed">
                  {isLoadingContent ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                      <span className="text-gray-600">Loading content...</span>
                    </div>
                  ) : content ? (
                    <div className="text-gray-800 whitespace-pre-wrap">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: renderHighlightedContent(content, highlights) 
                        }} 
                      />
                    </div>
                  ) : (
                    <div className="text-gray-600">
                      {document.abstract || 'Document content will be displayed here when available from the backend.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center">
                  <DocumentTextIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2 text-sm sm:text-base">Preview not available</p>
                  <p className="text-xs sm:text-sm text-gray-500 mb-4">
                    This file type ({document.fileType}) cannot be previewed
                  </p>
                  <button
                    onClick={handleDownload}
                    className="btn-mobile"
                  >
                    Download File
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Document metadata */}
          <div className="hidden sm:block bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {document.authors && (
                <div className="flex items-center space-x-2">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    <span className="font-medium">Authors:</span> {document.authors.join(', ')}
                  </span>
                </div>
              )}
              
              {document.publicationDate && (
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    <span className="font-medium">Published:</span> {formatDate(document.publicationDate)}
                  </span>
                </div>
              )}
              
              {document.source && (
                <div className="flex items-center space-x-2">
                  <TagIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    <span className="font-medium">Source:</span> {document.source}
                  </span>
                </div>
              )}
              
              {document.keywords && document.keywords.length > 0 && (
                <div className="flex items-center space-x-2">
                  <TagIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    <span className="font-medium">Keywords:</span> {document.keywords.slice(0, 3).join(', ')}
                    {document.keywords.length > 3 && '...'}
                  </span>
                </div>
              )}
            </div>
            
            {document.metadata && Object.keys(document.metadata).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="font-medium text-gray-700 text-sm">Additional Metadata:</span>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(document.metadata).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="text-gray-600">
                      <span className="font-medium">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 