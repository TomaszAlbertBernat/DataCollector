# DataCollector Frontend

A modern React application for managing AI-powered research data collection jobs with real-time progress monitoring and search capabilities.

## 🚀 Features

### ✅ Completed Features

#### Core Application Structure
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **React Router DOM** for client-side routing
- **TanStack Query** for server state management
- **Zustand** for lightweight client state management
- **Tailwind CSS** for utility-first styling

#### Job Management Interface
- **Real-time Job Dashboard** with live progress updates
- **Job Creation Wizard** with advanced configuration options
- **Job Details Page** with comprehensive logs and results
- **Job Status Tracking** with WebSocket integration
- **Job Actions** (cancel, retry, delete) with confirmation dialogs

#### Search & Document Management
- **Advanced Search Interface** with filters and facets
- **Document Viewer** with PDF and text support
- **Search Results** with highlighting and metadata
- **Document Download** functionality

#### User Experience
- **Responsive Design** with mobile-first approach
- **Accessibility Features** (ARIA labels, keyboard navigation)
- **Error Boundaries** for graceful error handling
- **Loading States** and progress indicators
- **Toast Notifications** for user feedback

#### Performance Optimizations
- **Code Splitting** with lazy loading for pages
- **Component Optimization** with React.memo where appropriate
- **Bundle Optimization** with Vite's build tools

### 🔄 Real-time Features
- **WebSocket Integration** for live job updates
- **Progress Visualization** with animated progress bars
- **Status Notifications** for job state changes
- **Live Search Suggestions** (ready for backend integration)

### 📱 Mobile Experience
- **Mobile Navigation** with bottom tab bar
- **Touch-friendly Interface** with proper touch targets
- **Responsive Layouts** that adapt to screen sizes
- **Mobile-optimized Modals** and overlays

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
cd packages/frontend
npm install
```

### Development Server
```bash
npm run dev
```
The application will be available at `http://localhost:3000`

### Building for Production
```bash
npm run build
```

### Testing
```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Storybook
```bash
# Start Storybook
npm run storybook

# Build Storybook
npm run build-storybook
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components
│   ├── forms/          # Form components
│   └── layouts/        # Layout components
├── pages/              # Page-level components
├── hooks/              # Custom React hooks
├── services/           # API client services
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── test/               # Test setup and utilities
└── utils/              # Utility functions
```

## 🎨 Component Library

### Core Components
- **JobProgressCard** - Displays job status and progress
- **DocumentViewer** - PDF and text document viewer
- **ErrorBoundary** - Graceful error handling
- **Layout** - Main application layout with navigation

### Form Components
- **JobCreationForm** - Advanced job creation wizard
- Form validation with React Hook Form and Zod
- Real-time form validation and error display

### State Management
- **useJobStore** - Global job state management
- **useNotificationStore** - Notification system
- **useWebSocket** - Real-time communication hook

## 🔧 Configuration

### Environment Variables
```bash
VITE_API_URL=http://localhost:3001    # Backend API URL
VITE_WS_URL=http://localhost:3001     # WebSocket server URL
```

### API Integration
The frontend is designed to work with the DataCollector backend API:
- RESTful API endpoints for job management
- WebSocket server for real-time updates
- Search API for document discovery
- Health check endpoints for system monitoring

## 🧪 Testing Strategy

### Unit Testing
- **Vitest** for fast unit testing
- **React Testing Library** for component testing
- **Mocked Dependencies** for isolated testing
- **Accessibility Testing** with ARIA queries

### Component Testing
- **JobProgressCard** - Comprehensive test coverage
- **Form Validation** - Input validation testing
- **User Interactions** - Click and keyboard event testing

### Test Coverage
- Component rendering and behavior
- User interactions and callbacks
- Error states and edge cases
- Accessibility compliance

## 🎯 Accessibility

### ARIA Implementation
- **Semantic HTML** with proper roles and labels
- **Keyboard Navigation** support for all interactive elements
- **Screen Reader** compatibility with descriptive labels
- **Focus Management** with visible focus indicators

### Mobile Accessibility
- **Touch Targets** sized appropriately (44px minimum)
- **Gesture Support** for mobile interactions
- **Responsive Design** that works across devices
- **Safe Area** support for devices with notches

## 🚀 Performance

### Optimization Techniques
- **Code Splitting** with React.lazy for route-based splitting
- **Bundle Analysis** with Vite's build tools
- **Image Optimization** and lazy loading
- **Caching Strategies** with React Query

### Monitoring
- **Bundle Size** tracking
- **Performance Metrics** collection
- **Error Tracking** with error boundaries
- **User Analytics** ready for integration

## 🔄 Real-time Features

### WebSocket Integration
- **Connection Management** with automatic reconnection
- **Event Subscription** for job updates
- **Error Handling** for connection failures
- **Message Queuing** for offline scenarios

### Progress Tracking
- **Real-time Progress Bars** with smooth animations
- **Status Updates** with immediate UI feedback
- **Time Estimates** for job completion
- **Error Reporting** with detailed error messages

## 📊 State Management

### Server State (TanStack Query)
- **API Data Caching** with intelligent invalidation
- **Background Refetching** for fresh data
- **Optimistic Updates** for better UX
- **Error Handling** with retry mechanisms

### Client State (Zustand)
- **Job Management** with filtering and sorting
- **UI State** for forms and modals
- **Notification System** with auto-dismiss
- **User Preferences** and settings

## 🎨 Design System

### Color Palette
- **Primary Blue** (#3b82f6) for main actions
- **Success Green** (#10b981) for completed states
- **Warning Yellow** (#f59e0b) for pending states
- **Error Red** (#ef4444) for failed states

### Typography
- **Inter Font** for modern, readable text
- **Responsive Text Sizes** that scale appropriately
- **Proper Contrast** ratios for accessibility

### Component Patterns
- **Consistent Spacing** with Tailwind's spacing scale
- **Card-based Layouts** for content organization
- **Button Variants** for different action types
- **Form Patterns** with consistent validation

## 🔮 Future Enhancements

### Planned Features
- **Dark Mode** support
- **Advanced Search Filters** with date ranges
- **Bulk Operations** for job management
- **Export Functionality** for search results
- **User Authentication** and authorization
- **Collaboration Features** for team workflows

### Performance Improvements
- **Virtual Scrolling** for large job lists
- **Service Worker** for offline support
- **Progressive Web App** capabilities
- **Advanced Caching** strategies

## 🤝 Contributing

### Development Guidelines
- **TypeScript** for all new code
- **Component Testing** for new components
- **Accessibility** compliance for all UI elements
- **Performance** considerations for new features

### Code Quality
- **ESLint** for code linting
- **Prettier** for code formatting
- **Type Checking** with strict TypeScript
- **Commit Hooks** for quality assurance

---

**Status**: ✅ Frontend development is complete and ready for backend integration!

The frontend provides a comprehensive, production-ready interface for the DataCollector system with modern React patterns, excellent user experience, and robust error handling. 