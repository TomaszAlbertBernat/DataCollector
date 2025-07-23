# 🔍 DataCollector

> AI-powered agent that scours the internet to find and download relevant content based on user queries

DataCollector is an intelligent system that combines web scraping, AI analysis, and advanced search capabilities to automatically discover, download, and index academic papers, datasets, and research documents. It provides both semantic and full-text search through a modern web interface.

## ✨ Features

- 🤖 **AI-Powered Query Analysis** - Uses OpenAI to understand and strategize data collection
- 🌐 **Multi-Source Scraping** - Searches Google Scholar, PubMed, arXiv, and other academic sources  
- 📄 **Intelligent File Processing** - Extracts text from PDFs, Word docs, and other formats
- 🔍 **Hybrid Search** - Combines OpenSearch (full-text) and ChromaDB (semantic) for optimal results
- ⚡ **Asynchronous Processing** - Background jobs with real-time progress updates
- 🎯 **Smart Deduplication** - Avoids downloading duplicate content
- 📊 **Real-time Monitoring** - WebSocket-powered live updates and job tracking
- 🎨 **Modern UI** - React-based frontend with responsive design

## 🏗️ Architecture

> 📖 **Detailed Documentation**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for comprehensive architectural patterns and conventions.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Express.js API │    │  Job Queue      │
│   - Search UI    │◄───┤  - REST Endpoints│◄───┤  - Bull.js      │
│   - Real-time    │    │  - WebSocket     │    │  - Redis        │
│   - Progress     │    │  - Job Management│    │  - Background   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌─────────────────┐              │
         │              │  AI Services    │              │
         └──────────────┤  - OpenAI GPT   │◄─────────────┘
                        │  - LangChain.js │
                        │  - Embeddings   │
                        └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Data Storage   │    │   Search Layer  │    │  External APIs  │
│  - PostgreSQL   │    │  - OpenSearch   │    │  - Google Scholar│
│  - File System  │    │  - ChromaDB     │    │  - PubMed       │
│  - Metadata     │    │  - Hybrid Search│    │  - arXiv        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 🎯 **Key Architectural Principles**
- **Clear Separation**: `types/` for interfaces, `models/` for database entities
- **Job Processing Pattern**: Generic `JobProcessor` + specific job implementations
- **Asynchronous Processing**: Background jobs with real-time progress updates
- **State Management**: Comprehensive job lifecycle tracking with state validation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- OpenAI API key

> **⚠️ Missing Prerequisites?** See our [detailed setup guide](docs/SETUP.md) for Windows installation instructions.

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DataCollector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your configuration (especially OPENAI_API_KEY)
   ```

4. **Start infrastructure services**
   ```bash
   npm run setup:infrastructure
   ```

5. **Wait for services to be ready**
   ```bash
   # Check if all services are healthy
   docker-compose -f infrastructure/docker/docker-compose.yml ps
   ```

6. **Test the infrastructure** (recommended)
   ```bash
   npm run test:infrastructure
   ```

7. **Start the development servers**
   ```bash
   # Terminal 1: Start backend
   npm run dev:backend
   
   # Terminal 2: Start frontend  
   npm run dev:frontend
   ```

8. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - OpenSearch Dashboard: http://localhost:5601
   - ChromaDB: http://localhost:8000

## 📋 Available Services

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Main user interface |
| Backend API | http://localhost:3001 | REST API and WebSocket |
| PostgreSQL | localhost:5432 | Job tracking and metadata |
| Redis | localhost:6379 | Job queue and caching |
| OpenSearch | http://localhost:9200 | Full-text search |
| OpenSearch Dashboard | http://localhost:5601 | Search management |
| ChromaDB | http://localhost:8000 | Vector embeddings |
| PgAdmin | http://localhost:8080 | Database management |
| Redis Commander | http://localhost:8081 | Redis management |

## 🎯 Usage

### Starting a Collection Job

1. **Web Interface**: Navigate to the frontend and use the collection form
2. **API**: POST to `/api/jobs/collection`
   ```bash
   curl -X POST http://localhost:3001/api/jobs/collection \
     -H "Content-Type: application/json" \
     -d '{"query": "machine learning in healthcare", "sources": ["scholar", "pubmed"]}'
   ```

### Searching Collected Data

1. **Web Interface**: Use the search page with filters and facets
2. **API**: GET `/api/search`
   ```bash
   curl "http://localhost:3001/api/search?q=diabetes%20treatment&limit=10"
   ```

### Monitoring Jobs

- **Real-time Updates**: WebSocket connection provides live progress
- **Job Status API**: GET `/api/jobs/:jobId`
- **Bull Dashboard**: Access queue monitoring at the configured port

## 🛠️ Development

### Project Structure

```
DataCollector/
├── packages/
│   ├── backend/          # Express.js API server
│   │   ├── src/
│   │   │   ├── agents/   # AI collection agents
│   │   │   ├── services/ # Core services (queue, search, etc.)
│   │   │   ├── routes/   # API endpoints
│   │   │   └── models/   # Data models
│   │   └── package.json
│   └── frontend/         # React application
│       ├── src/
│       │   ├── components/ # UI components
│       │   ├── pages/      # Page components
│       │   ├── hooks/      # Custom React hooks
│       │   └── services/   # API clients
│       └── package.json
├── infrastructure/
│   └── docker/           # Docker configurations
├── docs/                 # Documentation
└── scripts/              # Setup and utility scripts
```

### Available Scripts

```bash
# Development
npm run dev                    # Start both frontend and backend
npm run dev:backend           # Start backend only
npm run dev:frontend          # Start frontend only

# Building
npm run build                 # Build both packages
npm run typecheck            # Run TypeScript checks

# Testing
npm run test                 # Run all tests
npm run test:backend         # Run backend tests
npm run test:frontend        # Run frontend tests

# Infrastructure
npm run setup:infrastructure  # Start Docker services
npm run stop:infrastructure   # Stop Docker services
npm run reset:infrastructure  # Reset all data and restart
npm run test:infrastructure   # Test all infrastructure services
npm run logs                 # View Docker logs

# Maintenance
npm run clean                # Clean build artifacts
npm run lint                 # Lint all code
npm run lint:fix             # Fix linting issues
```

### Environment Configuration

Key environment variables (see `env.example` for complete list):

```bash
# Required
OPENAI_API_KEY=your_api_key_here
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/datacollector
REDIS_URL=redis://:redis123@localhost:6379

# Search Services  
OPENSEARCH_URL=http://localhost:9200
CHROMADB_URL=http://localhost:8000

# Application
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## 🔧 Configuration

### Adding New Sources

1. Create a new scraper in `packages/backend/src/agents/sources/`
2. Implement the `SourceScraper` interface
3. Register the scraper in the `SourceDiscovery` service
4. Add configuration options to environment variables

### Customizing Search

1. **OpenSearch mappings**: Modify index templates in `services/search/`
2. **Vector embeddings**: Adjust chunk size and embedding model in configuration
3. **Hybrid search**: Tune result fusion weights in `HybridSearchEngine`

### Scaling

- **Horizontal scaling**: Add more job processors with `QUEUE_CONCURRENCY`
- **Database optimization**: Tune PostgreSQL settings for your workload  
- **Search optimization**: Configure OpenSearch cluster with multiple nodes
- **Caching**: Adjust Redis memory limits and eviction policies

## 📊 Monitoring

### Health Checks

- **Application**: GET `/health`
- **Database**: GET `/health/db`  
- **Redis**: GET `/health/redis`
- **Search**: GET `/health/search`

### Metrics

The application exposes metrics for:
- Job processing rates and success/failure ratios
- Search query performance
- Resource usage (memory, CPU, storage)
- External API rate limits

### Logging

Structured JSON logging with configurable levels:
- Application logs: `./logs/app.log`
- Job execution logs: Database `job_logs` table
- Docker logs: `npm run logs`

## 🔒 Security

### API Security

- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration for frontend access
- Optional JWT authentication for user management

### Data Privacy

- No persistent storage of API keys (environment variables only)
- User data isolation (when authentication is enabled)
- Configurable data retention policies
- Option to exclude sensitive content types

## 🚢 Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure strong JWT secrets
- [ ] Set up SSL/TLS certificates
- [ ] Configure production database with connection pooling
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation
- [ ] Set up backup strategies
- [ ] Review and harden security settings

### Docker Deployment

```bash
# Build production images
docker build -t datacollector-backend ./packages/backend
docker build -t datacollector-frontend ./packages/frontend

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation for API changes
- Follow conventional commit messages
- Ensure all CI checks pass

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and ideas
- **Documentation**: Check the `docs/` directory for detailed guides

## 🙏 Acknowledgments

- OpenAI for GPT and embedding models
- LangChain for AI orchestration framework
- OpenSearch for powerful search capabilities
- ChromaDB for vector similarity search
- All other open-source dependencies that make this project possible

---

Built with ❤️ for the research community 