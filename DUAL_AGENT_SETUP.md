# 🤖 Dual Agent Setup Guide

This guide will help you set up two Cursor IDE instances to work on the DataCollector project - one for backend development and one for frontend development.

## 🚀 Quick Setup

### 1. **First Terminal/Tab - Backend Agent Setup**

```bash
# Navigate to project root
cd "C:\Users\tomasz\Documents\Programowanie lapek\DataCollector"

# Open first Cursor instance for BACKEND development
cursor . --new-window

# In the backend Cursor instance:
# 1. Open CURSOR_AGENTS_CONTEXT.md and pin it as a tab
# 2. Focus primarily on packages/backend/ directory  
# 3. Set up your workspace to highlight backend files
```

**Backend Agent Context:**
- 🎯 **Primary Focus**: `packages/backend/`
- 📋 **Key Responsibility**: API server, jobs, database, AI services
- 🔧 **Main Technologies**: Express.js, TypeScript, PostgreSQL, Redis, OpenAI

### 2. **Second Terminal/Tab - Frontend Agent Setup**

```bash
# Navigate to project root (same directory)
cd "C:\Users\tomasz\Documents\Programowanie lapek\DataCollector"

# Open second Cursor instance for FRONTEND development
cursor . --new-window

# In the frontend Cursor instance:
# 1. Open CURSOR_AGENTS_CONTEXT.md and pin it as a tab
# 2. Focus primarily on packages/frontend/ directory
# 3. Set up your workspace to highlight frontend files
```

**Frontend Agent Context:**
- 🎯 **Primary Focus**: `packages/frontend/`
- 📋 **Key Responsibility**: React UI, real-time updates, search interface
- 🎨 **Main Technologies**: React, TypeScript, Tailwind CSS, Socket.io

## 🔧 Initial Setup (Run Once)

Before starting development with both agents:

```bash
# 1. Install all dependencies
npm install

# 2. Start infrastructure services  
npm run setup:infrastructure

# 3. Wait for services to be ready (2-3 minutes)
npm run test:infrastructure

# 4. Copy environment file and configure
cp env.example .env
# Edit .env with your OPENAI_API_KEY and other settings

# 🚨 CRITICAL SECURITY WARNING
# ⚠️ API KEYS ARE FORBIDDEN TO MODIFY
# - DO NOT modify, remove, or alter any API keys in the .env file
# - API keys are essential for system functionality
# - If API keys are missing, restore them from your secure backup immediately
```

## 🚀 Daily Development Workflow

### Option 1: Coordinated Development (Recommended)
```bash
# Terminal 1 (Backend Agent)
npm run dev:backend

# Terminal 2 (Frontend Agent)  
npm run dev:frontend
```

### Option 2: Full Stack (Either Agent)
```bash
# Start both frontend and backend together
npm run dev
```

## 📋 Agent Coordination Rules

### 🤝 **Communication Protocol**

1. **Always reference** `CURSOR_AGENTS_CONTEXT.md` before making changes
2. **Check your agent-specific TODO file** for current sprint priorities:
   - **Backend Agent**: Review `TODO_BACKEND.md` for backend tasks
   - **Frontend Agent**: Review `TODO_FRONTEND.md` for frontend tasks
3. **Backend Agent** updates API types in `packages/backend/src/types/api.ts` FIRST
4. **Frontend Agent** uses those types for consistency
5. **Both agents** update the context file when making breaking changes
6. **Update task status** in your TODO file: `[ ]` → `[🚧]` → `[✅]`

### 🔄 **File Ownership**

| Area | Primary Agent | Secondary Agent |
|------|---------------|-----------------|
| `packages/backend/` | Backend Agent | Can review/suggest |
| `packages/frontend/` | Frontend Agent | Can review/suggest |
| `CURSOR_AGENTS_CONTEXT.md` | Both agents | Update together |
| `packages/backend/src/types/` | Backend Agent | Frontend reads |
| `infrastructure/` | Backend Agent | Both use |

### 📋 **TODO Management & Daily Workflow**

#### **Agent-Specific Task Lists**
- **Backend Agent**: Focus on `TODO_BACKEND.md` - API, jobs, AI services, database
- **Frontend Agent**: Focus on `TODO_FRONTEND.md` - React UI, real-time updates, UX

#### **Daily Workflow Commands**
```bash
# Morning Standup (Check Priorities)
cat TODO_BACKEND.md | grep "🔥\|⚡"     # Backend priorities  
cat TODO_FRONTEND.md | grep "🔥\|⚡"    # Frontend priorities
grep -n "DEPENDENCY\|BLOCKER" TODO_*.md  # Shared blockers

# During Development (Update Status)
# Mark tasks as: [ ] → [🚧] → [✅]

# End of Day (Sync Progress)  
# Update completed tasks and add new discoveries
```

#### **Task Status Symbols**
- `[ ]` Not started | `[🚧]` In progress | `[✅]` Completed
- `[🔥]` High priority | `[⚡]` Urgent | `[📋]` Needs planning
- `[🤝]` Requires both agents | `[❌]` Cancelled

### ⚡ **Quick Commands Reference**

```bash
# Backend Agent Commands
cd packages/backend
npm run dev                 # Start backend server
npm run test               # Run backend tests
npm run typecheck          # Type checking

# Frontend Agent Commands  
cd packages/frontend
npm run dev                # Start frontend dev server
npm run test               # Run frontend tests
npm run storybook          # Component library

# Shared Commands (Either Agent)
npm run setup:infrastructure    # Start Docker services
npm run test:infrastructure     # Check service health
npm run logs                   # View infrastructure logs
```

## 🎯 Agent-Specific Prompting

### Backend Agent Prompt Example:
```
I'm the BACKEND agent for DataCollector. I focus on:
- Express.js API development in packages/backend/
- Job processing and queue management  
- Database operations and AI service integration
- WebSocket real-time updates

My current sprint priorities (from TODO_BACKEND.md):
🔥 LangChain integration and AI agent development
🔥 Job queue setup with Bull.js  
⚡ Core API endpoints for job management

Please help me [your specific backend task]. 
Check CURSOR_AGENTS_CONTEXT.md for API contracts and TODO_BACKEND.md for current priorities.
```

### Frontend Agent Prompt Example:
```
I'm the FRONTEND agent for DataCollector. I focus on:
- React UI development in packages/frontend/
- Real-time job monitoring and search interface
- Tailwind CSS styling and responsive design
- Socket.io client for real-time updates

My current sprint priorities (from TODO_FRONTEND.md):
🔥 Job management dashboard with real-time updates
🔥 React Router and TanStack Query setup
⚡ WebSocket integration for live progress

Please help me [your specific frontend task].
Use types from packages/backend/src/types/api.ts and check TODO_FRONTEND.md for current priorities.
```

## 🔍 Monitoring Both Agents

### Development URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001  
- **API Health**: http://localhost:3001/health

### Service URLs (Shared)
- **OpenSearch**: http://localhost:9200
- **ChromaDB**: http://localhost:8000  
- **PgAdmin**: http://localhost:8080
- **Redis Commander**: http://localhost:8081

## 🚨 Troubleshooting

### Both Agents Not Working?
```bash
# Check if services are running
npm run test:infrastructure

# Restart infrastructure if needed
npm run reset:infrastructure
```

### API Connection Issues?
```bash
# Check if backend is running
curl http://localhost:3001/health

# Check WebSocket connection
# Frontend should show real-time connection status
```

### Type Conflicts Between Agents?
1. **Backend Agent**: Update `packages/backend/src/types/api.ts`
2. **Frontend Agent**: Run `npm run typecheck` to see new types
3. **Both**: Sync via `CURSOR_AGENTS_CONTEXT.md`

---

## 🎉 You're Ready!

Both agents should now be able to work in parallel with:
- ✅ Shared context and coordination
- ✅ Clear responsibility boundaries  
- ✅ Type safety and consistency
- ✅ Real-time development feedback

**🔗 Next Step**: Open `CURSOR_AGENTS_CONTEXT.md` in both Cursor instances and start developing! 