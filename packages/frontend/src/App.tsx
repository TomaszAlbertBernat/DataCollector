import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layouts/Layout'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// Lazy load page components for better performance
const HomePage = lazy(() => import('@/pages/HomePage').then(module => ({ default: module.HomePage })))
const JobsPage = lazy(() => import('@/pages/JobsPage').then(module => ({ default: module.JobsPage })))
const SearchPage = lazy(() => import('@/pages/SearchPage').then(module => ({ default: module.SearchPage })))
const JobDetailsPage = lazy(() => import('@/pages/JobDetailsPage').then(module => ({ default: module.JobDetailsPage })))

// Loading component for lazy-loaded pages
function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
            <Route path="/search" element={<SearchPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  )
}

export default App 