## Tech Stack

A concise overview of the technologies used across the project.

### Backend
- **Language/Runtime**: Node.js (>= 18), TypeScript
- **Web Framework**: Express
- **Realtime**: Socket.IO
- **Security & Middleware**: helmet, cors, compression, express-rate-limit
- **Auth/Validation**: jsonwebtoken, bcryptjs, joi, express-validator
- **Persistence**: PostgreSQL (via `pg`)
- **Queue & Caching**: Bull (Redis-backed), Redis client
- **Scraping**: Playwright, Cheerio
- **AI/LLM**: OpenAI SDK, LangChain
- **Embeddings**: Custom `EmbeddingGenerator` using OpenAI `text-embedding-3-small`
- **Vector Store**: ChromaDB client
- **Search**: OpenSearch client; Hybrid engine (OpenSearch + ChromaDB)
- **File Processing**: pdf-parse, mammoth (DOCX → HTML), csv-parser, mime-types, multer
- **Scheduling**: node-cron
- **Logging**: Winston
- **HTTP**: axios

### Frontend
- **Language**: TypeScript
- **Framework**: React 18
- **Bundler/Dev Server**: Vite
- **Styling/UI**: Tailwind CSS, Headless UI, Radix UI, Heroicons, Lucide React
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query, axios
- **Forms & Validation**: react-hook-form, Zod
- **Routing**: react-router-dom
- **Realtime**: socket.io-client
- **UX & Lists**: react-hot-toast, framer-motion, react-window (+ infinite loader)
- **Documents**: react-pdf
- **Component Workshop**: Storybook

### Infrastructure & Operations
- **Container Orchestration**: Docker Compose
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7 (alpine)
- **Search**: OpenSearch 2.9 + OpenSearch Dashboards
- **Vector Database**: ChromaDB
- **Monitoring**: Prometheus, Grafana
- **Logging**: Loki, Promtail
- **Admin UIs**: PgAdmin 4, Redis Commander
- **Networking**: Bridge network `datacollector-network`

### Observability
- **App Metrics**: Custom `MetricsService`, JSON metrics at `/metrics`, Prometheus endpoint at `/metrics/prometheus`
- **Logs**: Winston (app-side), Promtail → Loki (stack)

### Testing & Quality
- **Backend Tests**: Jest, ts-jest, Supertest
- **Frontend Tests**: Vitest, @testing-library/react, @testing-library/user-event, jsdom
- **Component Testing/Docs**: Storybook + @storybook/testing-library
- **Linting/Formatting**: ESLint (+ @typescript-eslint), Prettier

### Developer Tooling
- **Type System**: TypeScript
- **Git Hooks**: Husky, lint-staged
- **Script Orchestration**: concurrently
- **Environment Management**: dotenv, `.env` (see `env.example`)

### Domain-Specific Integrations
- **Academic Sources**: Scrapers for ArXiv, PubMed, Google Scholar
- **Search Architecture**: Hybrid full-text (OpenSearch) + semantic (ChromaDB) with configurable weights

### Notes
- Node and npm engines are pinned in the workspace (`node >= 18`, `npm >= 9`).
- Local infrastructure is provisioned via `infrastructure/docker/docker-compose.yml` and can be started with workspace scripts.



