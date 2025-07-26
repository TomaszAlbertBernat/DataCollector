import { useState } from 'react'
import { 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  ArrowLeftIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'
import type { DocumentResponse } from '@/types/api'

interface DocumentViewerProps {
  document: DocumentResponse
  isOpen: boolean
  onClose: () => void
}

export function DocumentViewer({ document, isOpen, onClose }: DocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)

  if (!isOpen) return null

  const isPDF = document.fileType === 'pdf'
  const isText = ['txt', 'md', 'json'].includes(document.fileType)

  const handleDownload = async () => {
    try {
      // Create a download link
      const link = window.document.createElement('a')
      link.href = document.filePath
      link.download = `${document.title}.${document.fileType}`
      link.click()
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
                  {/* Text Content Placeholder */}
                  <div className="text-gray-800">
                    {document.abstract || 'Document content will be displayed here when available from the backend.'}
                  </div>
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

          {/* Footer - Only show on desktop */}
          {document.metadata && Object.keys(document.metadata).length > 0 && (
            <div className="hidden sm:block bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Metadata:</span>
                <div className="mt-1 grid grid-cols-2 gap-4">
                  {Object.entries(document.metadata).slice(0, 4).map(([key, value]) => (
                    <div key={key} className="text-gray-600">
                      <span className="font-medium">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 