import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { 
  BeakerIcon, 
  MagnifyingGlassIcon, 
  QueueListIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <BeakerIcon className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                DataCollector
              </span>
            </div>
            
            <nav className="flex space-x-8">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Dashboard
              </NavLink>
              
              <NavLink
                to="/jobs"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <QueueListIcon className="h-4 w-4 mr-2" />
                Jobs
              </NavLink>
              
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Search
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sm:hidden safe-area-top">
        <div className="px-4">
          <div className="flex items-center justify-center h-14">
            <div className="flex items-center">
              <BeakerIcon className="h-6 w-6 text-blue-600" />
              <span className="ml-2 text-lg font-semibold text-gray-900">
                DataCollector
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 sm:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="nav-mobile safe-area-bottom">
        <div className="grid grid-cols-3 h-16">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `nav-mobile-item ${isActive ? 'active' : ''}`
            }
          >
            <DocumentTextIcon className="h-5 w-5 mb-1" />
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink
            to="/jobs"
            className={({ isActive }) =>
              `nav-mobile-item ${isActive ? 'active' : ''}`
            }
          >
            <QueueListIcon className="h-5 w-5 mb-1" />
            <span>Jobs</span>
          </NavLink>
          
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `nav-mobile-item ${isActive ? 'active' : ''}`
            }
          >
            <MagnifyingGlassIcon className="h-5 w-5 mb-1" />
            <span>Search</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
} 