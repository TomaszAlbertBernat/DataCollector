# 🤖 DataCollector - Dual Agent Development Context

> **IMPORTANT**: This file is shared between TWO Cursor agents - one developing the **Backend** and one developing the **Frontend**. Always coordinate through this document and maintain consistency across both development streams.

## 🎯 Project Overview

**DataCollector** is an AI-powered system that combines web scraping, AI analysis, and advanced search capabilities to automatically discover, download, and index academic papers, datasets, and research documents.

### Core Features
- 🤖 **AI-Powered Query Analysis** - Uses OpenAI to understand and strategize data collection
- 🌐 **Multi-Source Scraping** - Google Scholar, PubMed, arXiv, and other academic sources  
- 📄 **Intelligent File Processing** - Extracts text from PDFs, Word docs, and other formats
- 🔍 **Hybrid Search** - Combines OpenSearch (full-text) and ChromaDB (semantic)
- ⚡ **Asynchronous Processing** - Background jobs with real-time progress updates
- 📊 **Real-time Monitoring** - WebSocket-powered live updates

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Express.js API │    │  Job Queue      │
│   Port: 3000     │◄───┤  Port: 3001     │◄───┤  Redis + Bull   │
│   - Search UI    │    │  - REST API     │    │  - Background   │
│   - Real-time    │    │  - WebSocket    │    │  - Processing   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌─────────────────┐              │
         │              │  AI Services    │              │
         └──────────────┤  - OpenAI GPT   │◄─────────────┘
                        │  - LangChain    │
                        │  - Embeddings   │
                        └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Data Storage   │    │   Search Layer  │    │  External APIs  │
│  - PostgreSQL   │    │  - OpenSearch   │    │  - Google Scholar│
│  - File System  │    │  - ChromaDB     │    │  - PubMed       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
DataCollector/
├── packages/
│   ├── backend/                 # 🔧 BACKEND AGENT FOCUS
│   │   ├── src/
│   │   │   ├── config/         # Configuration modules (environment, etc.)
│   │   │   ├── types/          # Shared type definitions
│   │   │   ├── models/         # Database entities
│   │   │   ├── services/       # Core services
│   │   │   ├── routes/         # API endpoints
│   │   │   ├── agents/         # AI collection agents
│   │   │   └── tests/          # 🧪 Backend test files
│   │   └── package.json
│   └── frontend/               # 🎨 FRONTEND AGENT FOCUS
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── pages/          # Page components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── services/       # API clients
│       │   ├── types/          # Frontend-specific types
│       │   └── tests/          # 🧪 Frontend test files
│       └── package.json
├── infrastructure/             # 🐳 SHARED INFRASTRUCTURE
│   └── docker/                 # Docker services
├── docs/                       # 📚 DOCUMENTATION
├── scripts/                    # 🛠️ UTILITY SCRIPTS
│   ├── check-environment.js    # Environment validation (SAFE FOR AGENTS)
│   └── test-infrastructure.js  # Infrastructure testing
├── Transcriptions_All/         # 🧠 TEST DATA (Mental Health Content)
│   └── DRK/                    # Dr. K / Healthy Gamer transcriptions
│       ├── Meditation ｜ Healthy Gamer/  # 13 meditation transcripts
│       └── Best Lectures ｜ Healthy Gamer/ # 19 lecture transcripts
└── CURSOR_AGENTS_CONTEXT.md   # 🤖 THIS FILE
```

## 🔗 Shared API Contracts

### 🌐 REST API Endpoints

| Method | Endpoint | Purpose | Request | Response |
|--------|----------|---------|---------|----------|
| `POST` | `/api/jobs/collection` | Start collection job | `CreateCollectionRequest` | `CreateJobResponse` |
| `GET` | `/api/jobs/:id` | Get job status | - | `JobStatusResponse` |
| `GET` | `/api/jobs` | List jobs | `ListJobsRequest` | `PaginatedResponse<JobStatusResponse>` |
| `DELETE` | `/api/jobs/:id` | Cancel job | `CancelJobRequest` | `SuccessResponse` |
| `GET` | `/api/search` | Search documents | `SearchRequest` | `SearchResponse` |
| `GET` | `/api/documents/:id` | Get document | - | `DocumentResponse` |
| `GET` | `/api/health` | Health check | - | `HealthCheckResponse` |

### 🔌 WebSocket Events

| Event | Direction | Data Type | Purpose |
|-------|-----------|-----------|---------|
| `job_status_update` | Server → Client | `JobStatusUpdateMessage` | Job status changes |
| `job_progress_update` | Server → Client | `JobProgressUpdateMessage` | Progress updates |
| `system_notification` | Server → Client | `SystemNotificationMessage` | System alerts |

### 📋 Core Data Types

```typescript
// Job Status Flow
enum JobStatus {
  PENDING → RUNNING → ANALYZING → SEARCHING → 
  DOWNLOADING → PROCESSING → INDEXING → COMPLETED
  // Or → FAILED/CANCELLED at any stage
}

// Main API Request/Response Types
interface CreateCollectionRequest {
  query: string;
  sources?: string[];
  options?: CollectionOptions;
}

interface JobStatusResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  message?: string;
  // ... see types/api.ts for complete interface
}

interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  searchMode?: 'hybrid' | 'fulltext' | 'semantic' | 'fuzzy';
  // ... see types/api.ts for complete interface
}
```

## 🔧 Backend Agent Guidelines

### 🎯 Primary Responsibilities
- Express.js API server with TypeScript
- Job processing and queue management
- Database operations (PostgreSQL)
- AI service integration (OpenAI, LangChain)
- Web scraping and data collection
- Search service integration (OpenSearch, ChromaDB)
- WebSocket real-time updates

### 📂 Key Directories to Focus On
```
packages/backend/src/
├── routes/          # API endpoint definitions
├── services/        # Core business logic
│   ├── jobs/        # Job processing implementations
│   ├── queue/       # Queue management
│   ├── search/      # Search service integration
│   └── ai/          # AI service wrappers
├── agents/          # Data collection agents
├── models/          # Database entities
├── types/           # Shared type definitions
└── tests/           # 🧪 Test files (organized)
```

### 🛠️ Tech Stack & Dependencies
```json
{
  "core": ["express", "typescript", "cors", "helmet"],
  "database": ["pg", "redis"],
  "jobs": ["bull", "node-cron"],
  "ai": ["openai", "langchain"],
  "scraping": ["playwright", "cheerio", "axios"],
  "search": ["@opensearch-project/opensearch", "chromadb"],
  "realtime": ["socket.io"],
  "files": ["pdf-parse", "mammoth", "multer"],
  "logging": ["winston"]
}
```

### 🚀 Development Commands
```bash
# Backend development
cd packages/backend
npm run dev                 # Start development server
npm run build              # Build TypeScript
npm run test               # Run all tests
npm run test:pipeline      # Run pipeline tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
npm run lint:fix           # Fix linting issues
npm run typecheck          # Type checking
```

### 🔌 Integration Points
- **Database**: PostgreSQL schema management
- **Queue**: Redis + Bull job processing
- **WebSocket**: Socket.io for real-time updates
- **AI**: OpenAI API integration
- **Search**: OpenSearch + ChromaDB hybrid search

## 🎨 Frontend Agent Guidelines

### 🎯 Primary Responsibilities
- React + TypeScript application
- Modern UI with Tailwind CSS
- Real-time job monitoring via WebSocket
- Search interface with filters and facets
- File upload and document viewing
- Responsive design and accessibility

### 📂 Key Directories to Focus On
```
packages/frontend/src/
├── components/      # Reusable UI components
│   ├── ui/          # Base UI components
│   ├── forms/       # Form components
│   ├── layouts/     # Layout components
│   └── features/    # Feature-specific components
├── pages/           # Page-level components
├── hooks/           # Custom React hooks
├── services/        # API client services
├── stores/          # State management (Zustand)
├── types/           # Frontend-specific types
├── utils/           # Utility functions
└── tests/           # 🧪 Test files (organized)
```

### 🛠️ Tech Stack & Dependencies
```json
{
  "core": ["react", "react-dom", "typescript"],
  "routing": ["react-router-dom"],
  "state": ["zustand", "@tanstack/react-query"],
  "ui": ["tailwindcss", "@headlessui/react", "@heroicons/react"],
  "forms": ["react-hook-form", "@hookform/resolvers", "zod"],
  "realtime": ["socket.io-client"],
  "http": ["axios"],
  "utils": ["clsx", "tailwind-merge", "date-fns"],
  "animations": ["framer-motion"],
  "notifications": ["react-hot-toast"]
}
```

### 🚀 Development Commands
```bash
# Frontend development
cd packages/frontend
npm run dev                 # Start Vite dev server
npm run build              # Build for production
npm run test               # Run all tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage
npm run lint:fix           # Fix linting issues
npm run typecheck          # Type checking
npm run storybook          # Start Storybook
```

### 🎨 UI Components Architecture
```typescript
// Component structure example
interface ComponentProps {
  // Always use TypeScript interfaces for props
}

export const Component: React.FC<ComponentProps> = ({ ...props }) => {
  // Use custom hooks for logic
  const { data, loading, error } = useApiData();
  
  // Use Zustand stores for global state
  const { jobs, updateJob } = useJobStore();
  
  return (
    // Tailwind CSS for styling
    <div className="flex flex-col space-y-4">
      {/* Component JSX */}
    </div>
  );
};
```

## 🌐 Infrastructure Services

### 🐳 Docker Services (Shared)
| Service | Port | Purpose | URL |
|---------|------|---------|-----|
| PostgreSQL | 5432 | Primary database | - |
| Redis | 6379 | Job queue & cache | - |
| OpenSearch | 9200 | Full-text search | http://localhost:9200 |
| ChromaDB | 8000 | Vector embeddings | http://localhost:8000 |
| PgAdmin | 8080 | DB management | http://localhost:8080 |
| Redis Commander | 8081 | Redis management | http://localhost:8081 |

### 🚀 Setup Commands (Shared)
```bash
# Initial setup
npm install                           # Install all dependencies
npm run setup:infrastructure          # Start Docker services

# Development
npm run dev                          # Start both frontend & backend
npm run dev:backend                  # Backend only
npm run dev:frontend                 # Frontend only

# Infrastructure management
npm run stop:infrastructure          # Stop services
npm run reset:infrastructure         # Reset all data
npm run test:infrastructure          # Test services
```

## 📋 Development Workflow

### 🤝 Coordination Protocol

#### 1. **Before Starting Work**
- Check this file for latest API contracts
- Review `packages/backend/src/types/api.ts` for type definitions
- Ensure infrastructure is running: `npm run test:infrastructure`

#### 2. **When Adding New Features**
- **Backend Agent**: Update API types in `types/api.ts` FIRST
- **Frontend Agent**: Use the types from `types/api.ts` for consistency
- Test integration early and often

#### 3. **When Making Breaking Changes**
- Update this context file with changes
- Communicate through code comments
- Ensure backward compatibility where possible

### 🧪 Testing Strategy

### 📁 Test Organization
All test files have been organized into dedicated `tests/` directories for better maintainability:

#### Backend Tests (`packages/backend/src/tests/`)
- **Pipeline Tests**: `test-pipeline-simple.ts`, `test-complete-pipeline.ts`, `test-phase3.ts`
- **Job Processing Tests**: `test-job-processor.ts`, `test-active-job-processing.ts`, `test-job-processing.ts`
- **Queue Tests**: `test-queue-status.ts`
- **Search Tests**: `test-search-integration.ts`, `test-minimal-search.ts`, `test-index-documents.ts`
- **File Processing Tests**: `test-local-files.ts`, `test-local-files-simple.ts`, `test-quick-fixes.ts`
- **Job Management Tests**: `test-job-registration.ts`, `test-job-data.ts`, `test-manual-job.ts`

#### Frontend Tests (`packages/frontend/src/tests/`)
- **Component Tests**: `JobProgressCard.test.tsx`
- **Integration Tests**: `test-search-integration.ts`
- **Setup**: `setup.ts`

#### Backend Testing
```bash
# Run pipeline test
npm run test:pipeline

# Run all tests with Jest
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Manual API testing
curl -X POST http://localhost:3001/api/jobs/collection \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "sources": ["scholar"]}'
```

#### Frontend Testing
```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test -- --watch

# Visual testing
npm run storybook

# E2E testing (when implemented)
npm run test:e2e
```

## 🔒 Environment Configuration & Security

### 🚨 **CRITICAL SECURITY GUIDELINES FOR AGENTS**

#### **⚠️ .ENV FILE ACCESS RESTRICTIONS**
- **FORBIDDEN**: Agents CANNOT directly read, modify, or access `.env` files for security reasons
- **FORBIDDEN**: Agents CANNOT use `read_file` tool on `.env` files
- **FORBIDDEN**: Agents CANNOT modify environment variables or API keys
- **SAFE ALTERNATIVE**: Use the provided environment configuration module

#### **✅ AGENT-SAFE ENVIRONMENT HANDLING**

**1. Use the Environment Configuration Module**
```typescript
// ✅ SAFE - Use this in backend code
import { ENV_CONFIG, ENV_STATUS, getEnvironmentInfo } from './config/environment';

// ✅ SAFE - Access configuration through module
const openaiKey = ENV_CONFIG.OPENAI_API_KEY;
const databaseUrl = ENV_CONFIG.DATABASE_URL;

// ✅ SAFE - Check environment status
const envInfo = getEnvironmentInfo();
console.log('Environment ready:', envInfo.hasOpenAIKey);
```

**2. Use Environment Validation Script**
```bash
# ✅ SAFE - Agents can run this command
npm run check:env
# or
node scripts/check-environment.js
```

**3. Handle Missing Environment Variables Gracefully**
```typescript
// ✅ SAFE - The environment module handles missing .env files
// It will automatically:
// - Try multiple .env file locations
// - Use system environment variables as fallback
// - Provide default values for development
// - Warn about missing critical variables
// - Continue operation when possible
```

#### **🛠️ ENVIRONMENT TROUBLESHOOTING FOR AGENTS**

**When Environment Issues Occur:**
1. **First**: Run environment check: `npm run check:env`
2. **Check**: Environment status through the module:
   ```typescript
   import { getEnvironmentHealth } from './config/environment';
   const health = getEnvironmentHealth();
   console.log('Environment status:', health.status);
   ```
3. **Verify**: Required files exist without accessing .env:
   ```typescript
   import { getEnvironmentInfo } from './config/environment';
   const info = getEnvironmentInfo();
   console.log('Services configured:', info.servicesConfigured);
   ```

**Error Messages Agents Might See:**
- `⚠️ No .env file found` → **OK for agents**, system will use fallbacks
- `CRITICAL: Missing required environment variables` → Run `npm run check:env` for details
- `Could not access .env file` → **Normal for agents**, system continues with environment variables

#### **📋 ENVIRONMENT VALIDATION COMMANDS**

```bash
# ✅ SAFE for agents - Check environment configuration
npm run check:env                    # Full environment validation
npm run check:environment            # Alternative command
node scripts/check-environment.js    # Direct script execution

# ✅ SAFE for agents - Test infrastructure connectivity  
npm run test:infrastructure          # Test Docker services

# ✅ SAFE for agents - Development commands
npm run dev:backend                  # Start backend (uses environment module)
npm run dev:frontend                 # Start frontend
```

### 🔑 Environment Configuration Details

#### **Environment File Locations** (Auto-detected)
The environment module automatically searches these locations:
1. `C:\Users\tomasz\Documents\Programowanie lapek\DataCollector\.env` (Primary)
2. Project root: `./env`
3. Relative paths: `../env`, `../../env`
4. Backend directory: `packages/backend/.env`

#### **Critical Environment Variables**
- `OPENAI_API_KEY` - **REQUIRED** for AI features
- `DATABASE_URL` - PostgreSQL connection (has fallback)
- `REDIS_URL` - Redis connection (has fallback)
- `OPENSEARCH_URL` - Search service (has fallback)
- `CHROMADB_URL` - Vector database (has fallback)

#### **Environment Status Indicators**
- 🟢 **Healthy**: All required variables present
- 🟡 **Warning**: Using fallback values or missing non-critical variables
- 🔴 **Error**: Missing critical variables (OPENAI_API_KEY)

### ✅ Environment Setup Status
**Environment File**: ✅ **CONFIGURED**
- **Location**: `C:\Users\tomasz\Documents\Programowanie lapek\DataCollector\.env`
- **Relative Path**: `./.env` (from project root)
- **Status**: ✅ **ACTIVE** - OpenAI API key and all required variables configured
- **Backend Loading**: ✅ **CONFIRMED** - Server loads environment from absolute path

**Key Configuration**:
- ✅ **OPENAI_API_KEY**: Configured and loaded successfully
- ✅ **Database URLs**: PostgreSQL and Redis connections configured
- ✅ **Infrastructure URLs**: OpenSearch, ChromaDB, and other services configured
- ✅ **Application Settings**: Ports, CORS, and security settings configured

### 🚨 **CRITICAL SECURITY WARNING**
**⚠️ API KEYS ARE FORBIDDEN TO MODIFY**
- **DO NOT** modify, remove, or alter any API keys in the `.env` file
- **DO NOT** commit API keys to version control (already in `.gitignore`)
- **DO NOT** share API keys in logs, documentation, or communications
- **API keys are essential for system functionality** - modifying them will break the application
- **If API keys are missing or corrupted**, restore them from your secure backup immediately

**Verification Commands**:
```bash
# Check if .env file exists
ls -la .env

# Verify OpenAI API key is loaded (from backend logs)
npm run dev:backend
# Should show: "OPENAI_API_KEY loaded: true, Length: [key_length]"
```

## 🚨 Critical Guidelines

### ✅ DO
- **Always use TypeScript** with strict mode enabled
- **Follow the established patterns** in existing code
- **Update type definitions** when changing APIs
- **Test API integration** between frontend and backend
- **Use proper error handling** with consistent error types
- **Document complex logic** with comments
- **Keep dependencies up to date** and secure

### ❌ DON'T
- **Make breaking API changes** without updating both sides
- **Hardcode URLs or ports** (use environment variables)
- **Skip type checking** (`npm run typecheck`)
- **Ignore linting errors** (`npm run lint:fix`)
- **Commit uncommented complex code**
- **Add dependencies** without considering impact on the other agent

## 🔄 State Synchronization

### 📊 Real-time Updates
- **WebSocket connection** for job progress updates
- **React Query** for server state caching and synchronization
- **Zustand** for client-side state management
- **Bull dashboard** for queue monitoring (Backend)

### 🔄 Data Flow
```
User Action (Frontend) 
  → API Request (Frontend) 
  → Route Handler (Backend) 
  → Service Layer (Backend) 
  → Database/Queue (Backend) 
  → WebSocket Update (Backend) 
  → Real-time UI Update (Frontend)
```

## 📚 Additional Resources

### 📖 Documentation
- [Architecture Guide](docs/ARCHITECTURE.md) - Detailed architectural patterns
- [Setup Guide](docs/SETUP.md) - Windows installation instructions
- [API Types](packages/backend/src/types/api.ts) - Complete API interface definitions
- [Job Types](packages/backend/src/types/job.ts) - Job processing interfaces

### 🔗 External Documentation
- [Express.js](https://expressjs.com/) - Backend framework
- [React](https://react.dev/) - Frontend framework
- [TypeScript](https://www.typescriptlang.org/) - Type system
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [Socket.io](https://socket.io/) - Real-time communication
- [React Query](https://tanstack.com/query/latest) - Server state management

---
## 🎯 Current Development Status

### ✅ Completed
- [x] **Project Structure and Architecture**: A clear and scalable monorepo structure is in place.
- [x] **Type Definitions**: Shared API contracts and type definitions are well-defined.
- [x] **Docker Infrastructure**: All services (PostgreSQL, Redis, OpenSearch, ChromaDB) are containerized and operational.
- [x] **Backend Server**: The Express.js server is fully functional with robust middleware and error handling.
- [x] **Job Processing System**: An asynchronous job processing system with a queue and state management is implemented.
- [x] **Search Services**: A hybrid search engine combining OpenSearch and ChromaDB is fully functional.
- [x] **Frontend Foundation**: The React application is set up with routing, state management, and API integration.

### 🚧 In Progress
- [ ] **UI/UX Refinement**: The frontend is functional but requires further improvements to the search results display and overall user experience.
- [ ] **Additional Scrapers**: The backend is designed for extensibility, with new scrapers for PubMed and arXiv planned.
- [ ] **Testing Coverage**: While a testing framework is in place, more comprehensive unit and integration tests are needed.

### 📋 TODO
- [ ] **Document Viewer**: The document viewer needs to be integrated with the backend to display real processed files.
- [ ] **Authentication**: A complete authentication system with protected routes and user management is yet to be implemented.
- [ ] **Monitoring and Observability**: Integration with monitoring tools like Grafana, Loki, and Prometheus is planned.
- [ ] **Performance Optimization**: Further optimization of both frontend and backend for production use.
---
**🤖 Remember**: This file is your single source of truth for coordination. Update it when you make significant changes that affect the other agent! 