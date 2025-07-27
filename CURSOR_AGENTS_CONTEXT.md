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
│   │   │   ├── types/          # Shared type definitions
│   │   │   ├── models/         # Database entities
│   │   │   ├── services/       # Core services
│   │   │   ├── routes/         # API endpoints
│   │   │   └── agents/         # AI collection agents
│   │   └── package.json
│   └── frontend/               # 🎨 FRONTEND AGENT FOCUS
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── pages/          # Page components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── services/       # API clients
│       │   └── types/          # Frontend-specific types
│       └── package.json
├── infrastructure/             # 🐳 SHARED INFRASTRUCTURE
│   └── docker/                 # Docker services
├── docs/                       # 📚 DOCUMENTATION
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
└── types/           # Shared type definitions
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
npm run test               # Run tests
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
└── utils/           # Utility functions
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
npm run test               # Run Vitest tests
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

#### Backend Testing
```bash
# API endpoint testing
npm run test:backend

# Manual API testing
curl -X POST http://localhost:3001/api/jobs/collection \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "sources": ["scholar"]}'
```

#### Frontend Testing
```bash
# Component testing
npm run test:frontend

# Visual testing
npm run storybook

# E2E testing (when implemented)
npm run test:e2e
```

## 🔒 Environment Configuration

### 🔑 Required Environment Variables
```bash
# Required for both agents
OPENAI_API_KEY=your_api_key_here
NODE_ENV=development

# Database (Backend)
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/datacollector
REDIS_URL=redis://:redis123@localhost:6379

# Search Services (Backend)
OPENSEARCH_URL=http://localhost:9200
CHROMADB_URL=http://localhost:8000

# Application (Backend)
PORT=3001
FRONTEND_URL=http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

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

## 📋 TODO Management & Task Priorities

### 📍 Main Project Roadmap
The complete project roadmap is maintained in **`TODO.md`** with detailed phases and timelines. This roadmap is organized into 14 phases spanning infrastructure setup through post-launch maintenance.

### 🎯 Agent-Specific Task Lists

#### 🔧 **Backend Agent Tasks** → See `TODO_BACKEND.md`
Focus on server-side development, API implementation, job processing, and data infrastructure:
- ✅ **COMPLETED**: Core AI agent development (LangChain integration)
- ✅ **COMPLETED**: Asynchronous job processing system  
- ❌ **CRITICAL MISSING**: Search & storage systems (OpenSearch, ChromaDB)
- ✅ **COMPLETED**: Backend API development
- ✅ **COMPLETED**: Infrastructure and monitoring

#### 🎨 **Frontend Agent Tasks** → See `TODO_FRONTEND.md`  
Focus on user interface, real-time updates, and user experience:
- React application development
- Real-time job monitoring interface
- Search and results display
- Component library and design system
- Frontend optimization and testing

### 🚀 Current Sprint Priorities

#### Phase 2-3: Core AI Agent Development (✅ COMPLETED - Backend)
```typescript
// ✅ COMPLETED - Backend Agent
[✅] LangChain Integration
[✅] Data Collection Agent implementation  
[✅] Web scraping infrastructure with Playwright
[✅] Content discovery and filtering logic

// ✅ COMPLETED - Required for Frontend
[✅] Job processing API endpoints
[✅] WebSocket real-time status updates
```

#### Phase 6: Search & Storage Systems (🔥 CRITICAL MISSING - Backend)
```typescript
// 🔥 URGENT - Backend Agent
[ ] OpenSearch integration for full-text search
[ ] ChromaDB integration for vector embeddings
[ ] Hybrid search engine implementation
[ ] Document indexing pipeline

// DEPENDENCY - Required for Frontend
[ ] Search API endpoints with hybrid results
[ ] Document retrieval and display capabilities
```

#### Phase 3: File Processing Pipeline (🔥 CRITICAL MISSING - Backend)
```typescript
// 🔥 URGENT - Backend Agent
[ ] Content downloader with multi-threading
[ ] File processing system (PDF, Word, CSV, JSON)
[ ] Text extraction and chunking
[ ] Embedding generation pipeline

// DEPENDENCY - Required for Frontend
[ ] Document viewer and download capabilities
[ ] File upload and processing interface
```

### 🔄 Daily Workflow Integration

#### 1. **Morning Standup (Both Agents)**
```bash
# Check current tasks and priorities
cat TODO_BACKEND.md | grep "🔥\|⚡"     # Backend priorities  
cat TODO_FRONTEND.md | grep "🔥\|⚡"    # Frontend priorities
grep -n "DEPENDENCY\|BLOCKER" TODO_*.md  # Shared blockers

# Check for critical issues
grep -n "URGENT\|CRITICAL" TODO_BACKEND.md
```

#### 2. **Before Starting Work (Each Agent)**
- Review your agent-specific TODO file
- Check for new `🔥 HIGH PRIORITY` or `⚡ URGENT` tasks
- Verify dependencies are met in the other agent's TODO
- Update task status: `[ ]` → `[🚧]` → `[✅]`

#### 3. **End of Day (Both Agents)**
- Mark completed tasks as `[✅]` in appropriate TODO file
- Add new tasks discovered during development
- Update dependencies and blockers
- Sync progress in this context file

### 📊 Task Status Conventions

| Symbol | Meaning | When to Use |
|--------|---------|-------------|
| `[ ]` | Not started | Default state for new tasks |
| `[🚧]` | In progress | Currently working on |
| `[✅]` | Completed | Task finished and tested |
| `[❌]` | Cancelled | Task no longer needed |
| `[🔥]` | High priority | Critical path items |
| `[⚡]` | Urgent | Blocking other work |
| `[📋]` | Needs planning | Requires breakdown |
| `[🤝]` | Collaboration needed | Requires both agents |

### 🎯 Milestone Tracking

#### **Current Milestone**: Phase 6 Implementation (Search & Storage)
**Target**: Complete search infrastructure and file processing
**Estimated Completion**: [Update weekly]

**Backend Progress** (Updated by Backend Agent):
- [✅] 🔥 LangChain integration [✅]
- [✅] 🔥 Data collection agent [✅]  
- [✅] ⚡ Job queue system [✅]
- [✅] WebSocket real-time updates [✅]
- [✅] TypeScript compilation errors [✅] **JUST COMPLETED**
- [✅] Database migration system [✅] **JUST COMPLETED**
- [✅] Job management API [✅] **JUST COMPLETED**
- [ ] 🔥 OpenSearch integration [🚧 URGENT]
- [ ] 🔥 ChromaDB integration [🚧 URGENT]
- [ ] 🔥 File processing pipeline [🚧 URGENT]

**Frontend Progress** (Updated by Frontend Agent):
- [ ] 🔥 Job monitoring interface [📋]
- [ ] Real-time progress components [📋]
- [ ] Search UI components [📋]
- [ ] WebSocket client integration [📋]

**Shared Dependencies**:
- [ ] 🤝 Search API contract finalization [🚧 URGENT]
- [ ] 🤝 Document processing integration [🚧 URGENT]
- [ ] Infrastructure health validation [✅]

### 🚨 Critical Task Coordination

#### **Search Infrastructure** (Backend → Frontend dependency)
```typescript
// Backend Agent MUST complete first:
1. Implement OpenSearch service for full-text search
2. Implement ChromaDB service for vector search
3. Create hybrid search engine
4. Update search API endpoints
5. Update this context file with search capabilities

// Then Frontend Agent can:
1. Implement search interface components
2. Add search result display
3. Create document viewer
4. Add search filters and facets
```

#### **File Processing** (Backend → Frontend dependency)
```typescript
// Backend Agent MUST complete first:
1. Implement content downloader
2. Create file processing pipeline
3. Add document parsing services
4. Implement embedding generation
5. Update document API endpoints

// Then Frontend Agent can:
1. Add file upload interface
2. Create document viewer
3. Implement download functionality
4. Add processing progress display
```

#### **Type Safety** (Shared responsibility)
```typescript
// Process for type changes:
1. Backend Agent: Update types/api.ts
2. Backend Agent: Update exports and documentation
3. Frontend Agent: Import updated types
4. Frontend Agent: Update components using changed types
5. Both: Test integration and update TODO status
```

---

## 🎯 Current Development Status

### ✅ Completed
- [x] Project structure and architecture
- [x] Type definitions for API contracts
- [x] Docker infrastructure setup
- [x] Express.js server structure with TypeScript
- [x] React application foundation
- [x] Database schema planning and implementation
- [x] **Environment configuration** (OpenAI API key and all services configured)
- [x] **LangChain integration and AI agent development**
- [x] **Job processing system with Bull.js**
- [x] **WebSocket real-time updates**
- [x] **Google Scholar scraper implementation**
- [x] **REST API endpoints for job management**
- [x] **TypeScript compilation errors fixed** (29 errors resolved - 17 backend + 12 frontend)
- [x] **Database migration system implemented**
- [x] **Job persistence and API functionality verified**
- [x] **Test data integration** (Mental health transcriptions from Healthy Gamer/Dr. K)

### 🚧 In Progress
- [ ] **Search services implementation** (OpenSearch + ChromaDB) 🔥 **NEXT PRIORITY**
- [ ] **File processing pipeline** 🔥 **NEXT PRIORITY**
- [ ] **Additional scrapers** (PubMed, arXiv) 📋 **PLANNED**

### 📋 TODO
- [ ] **Authentication system**
- [ ] **Advanced search filters**
- [ ] **Document viewer**
- [ ] **Admin dashboard**
- [ ] **Performance optimization**
- [ ] **Production deployment**
- [ ] **Mental health content processing** (Test data from Transcriptions_All folder)

### ✅ Critical Issues Resolved
1. **TypeScript compilation errors** in all services ✅ **FIXED** (29 errors resolved - 17 backend + 12 frontend)
2. **Missing search services** (OpenSearch, ChromaDB) 🔥 **NEXT PRIORITY**
3. **Missing file processing pipeline** 🔥 **NEXT PRIORITY**
4. **Missing database migration scripts** ✅ **FIXED**
5. **Missing additional scrapers** (PubMed, arXiv) 📋 **PLANNED**
6. **Test data integration** ✅ **COMPLETED** (Mental health transcriptions from Healthy Gamer/Dr. K)

---

**🤖 Remember**: This file is your single source of truth for coordination. Update it when you make significant changes that affect the other agent! 