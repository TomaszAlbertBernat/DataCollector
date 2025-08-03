# DataCollector - Academic Research Document Collection System

A comprehensive platform for collecting, processing, and searching academic documents from multiple sources including Google Scholar, PubMed, and arXiv.

## 🚀 **Current Status: MVP Complete**

### ✅ **Fully Implemented Features**

#### **Core Infrastructure**
- ✅ **Backend API** - Complete REST API with job management, search, and document processing
- ✅ **Frontend UI** - Modern React application with real-time updates
- ✅ **Database Integration** - PostgreSQL with proper migrations and job state management
- ✅ **Queue System** - Redis-based job queue with multiple processors
- ✅ **Search Engine** - Hybrid search combining vector and full-text search

#### **Academic Scrapers**
- ✅ **Google Scholar Scraper** - Academic papers and citations
- ✅ **PubMed Scraper** - Medical and life sciences literature  
- ✅ **arXiv Scraper** - Preprint server for physics, math, CS
- ✅ **ScraperManager** - Unified management with rate limiting and error handling

#### **Document Processing**
- ✅ **File Processing** - PDF, text, and document parsing
- ✅ **Content Extraction** - Text extraction with metadata preservation
- ✅ **Vector Embeddings** - OpenAI embeddings for semantic search
- ✅ **Indexing** - OpenSearch and ChromaDB integration

#### **User Interface**
- ✅ **Job Management** - Create, monitor, and manage collection jobs
- ✅ **Search Interface** - Advanced search with filters and highlighting
- ✅ **Document Viewer** - Real document content display with download
- ✅ **Real-time Updates** - WebSocket-based job progress updates

## 🏗️ **Architecture**

```
DataCollector/
├── packages/
│   ├── backend/          # Node.js/Express API
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   ├── scrapers/     # Academic scrapers
│   │   │   │   ├── processing/   # Document processing
│   │   │   │   ├── search/       # Search engine
│   │   │   │   └── queue/        # Job queue system
│   │   │   └── routes/           # API endpoints
│   │   └── infrastructure/       # Docker & monitoring
│   └── frontend/         # React/TypeScript UI
│       ├── src/
│       │   ├── components/       # UI components
│       │   ├── pages/           # Application pages
│       │   ├── services/        # API integration
│       │   └── stores/          # State management
│       └── tests/               # Component tests
└── infrastructure/       # Docker compose setup
```

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ and npm
- Docker and Docker Compose
- OpenAI API key

### **1. Clone and Setup**
```bash
git clone <repository-url>
cd DataCollector
cp env.example .env
# Edit .env with your OpenAI API key and other settings
```

### **2. Start Infrastructure**
```bash
cd infrastructure/docker
docker-compose up -d
```

### **3. Start Backend**
```bash
cd packages/backend
npm install
npm run dev
# Backend will start on port 3005
```

### **4. Start Frontend**
```bash
cd packages/frontend
npm install
npm run dev
# Frontend will start on port 3000
```

### **5. Access Application**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3005
- **API Documentation**: http://localhost:3005/api/docs

## 📚 **Usage Guide**

### **Creating Collection Jobs**
1. Navigate to the Home page
2. Enter your search query (e.g., "machine learning algorithms")
3. Select data sources (Google Scholar, PubMed, arXiv)
4. Configure advanced options (max results, file types, date range)
5. Click "Create Job" to start collection

### **Searching Documents**
1. Go to the Search page
2. Enter your search terms
3. Choose search mode (Hybrid, Full-text, Semantic)
4. Apply filters (source, file type, date range)
5. View results with highlighting and metadata

### **Viewing Documents**
1. Click on any search result
2. View document content with syntax highlighting
3. Download original files
4. See metadata (authors, publication date, keywords)

## 🔧 **Configuration**

### **Environment Variables**
Key configuration options in `.env`:

```bash
# OpenAI API (Required)
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/datacollector

# Redis
REDIS_URL=redis://:redis123@localhost:6379

# Search Engines
OPENSEARCH_URL=http://localhost:9200
CHROMADB_URL=http://localhost:8000
```

### **Scraper Configuration**
Each scraper can be configured independently:

```bash
# Google Scholar
GOOGLE_SCHOLAR_MAX_RESULTS=50

# PubMed  
PUBMED_API_KEY=your_pubmed_api_key_here
PUBMED_MAX_RESULTS=100

# arXiv
ARXIV_MAX_RESULTS=50
```

## 🧪 **Testing**

### **Backend Tests**
```bash
cd packages/backend
npm test
```

### **Frontend Tests**
```bash
cd packages/frontend
npm test
```

### **Integration Tests**
```bash
npm run test:integration
```

## 📊 **Monitoring**

### **Health Checks**
- **Backend**: http://localhost:3005/api/health
- **Database**: Automatic connection monitoring
- **Queue**: Real-time job queue statistics

### **Metrics**
- Job success/failure rates
- Search performance metrics
- Scraper statistics
- System resource usage

## 🔒 **Security**

### **API Security**
- Rate limiting on all endpoints
- CORS configuration
- Input validation and sanitization
- Error handling without information leakage

### **Data Protection**
- API keys stored securely
- Database connection encryption
- File upload validation
- Access control for sensitive operations

## 🚀 **Deployment**

### **Production Setup**
1. Configure production environment variables
2. Set up SSL certificates
3. Configure reverse proxy (nginx)
4. Set up monitoring and logging
5. Configure backup strategies

### **Docker Deployment**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 **Contributing**

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### **Code Standards**
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Comprehensive test coverage

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 **Support**

### **Common Issues**
- **Backend won't start**: Check database and Redis connections
- **Scrapers failing**: Verify rate limits and network connectivity
- **Search not working**: Ensure OpenSearch and ChromaDB are running

### **Getting Help**
- Check the logs for detailed error messages
- Review the configuration in `.env`
- Test individual components
- Open an issue with detailed information

---

**🎯 DataCollector is now a fully functional academic research platform ready for production use!** 