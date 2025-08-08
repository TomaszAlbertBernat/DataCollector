## Test Plan

### 1) Objectives and Scope
- Ensure core user journeys and data pipeline work correctly and reliably:
  - Job lifecycle: creation → scraping/downloading → processing → embedding/indexing → searchability → status/metrics.
  - Frontend UX: create jobs, view progress, search, view documents.
  - Integrations: PostgreSQL, Redis/Bull, OpenSearch, ChromaDB, Socket.IO, OpenAI, scrapers (ArXiv, PubMed, Google Scholar).
- Minimize regressions with fast, reliable automation at multiple levels.
- Validate non-functional aspects: performance, security, accessibility, observability.

### 2) System Under Test Overview
- Backend: Node.js/TypeScript, Express routes (`documents`, `jobs`, `search`, `upload`), Bull queue, Socket.IO, scraping services, file processing, embeddings (OpenAI), hybrid search (OpenSearch + ChromaDB), PostgreSQL, metrics/logging.
- Frontend: React 18, Vite, Zustand, React Query, forms (react-hook-form + Zod), Document viewer, Socket.IO client.
- Infra: Docker Compose services (Postgres, Redis, OpenSearch, ChromaDB), Prometheus/Grafana, Loki/Promtail.

### 3) Test Levels and Types
- Unit Tests
  - Backend: pure functions, validators, job state transitions, search query builders, parsers, transformers.
  - Frontend: component logic, hooks (`useWebSocket`, stores), utility functions, form resolvers.
- Component Tests (Frontend)
  - React components with RTL: `JobCreationForm`, `JobProgressCard`, `DocumentViewer`, `ErrorBoundary`.
- Integration Tests (Backend)
  - Express routes with Supertest against ephemeral Postgres/Redis/OpenSearch/ChromaDB (Docker) or test containers.
  - Queue processing end-to-end (submit job → worker → status updates).
  - Scraper → downloader → file processor → embeddings → indexers (mocks for external sources in CI).
- Contract/API Tests
  - Validate request/response schemas for `jobs`, `search`, `upload`, `documents` using `packages/backend/src/types`.
- E2E Tests (Recommended)
  - Browser-driven flows (Playwright): job creation → progress → search → document view; WebSocket updates; error flows.
- Performance/Load
  - k6/Artillery: search latency under load, job throughput, queue delay, WebSocket event latency.
- Security
  - Input validation, CORS, headers, rate-limiting, SSRF defenses, safe file handling. Dependency scanning and ZAP baseline.
- Accessibility
  - axe-core checks on key pages/components; keyboard navigation, focus management, ARIA.
- Observability
  - Metrics presence/shape on `/metrics` and `/metrics/prometheus`; logging structure; error rates alarms.

### 4) Test Environments
- Local Dev
  - Bring up infra via `infrastructure/docker/docker-compose.yml`.
  - Run backend and frontend dev servers; run unit/integration tests locally.
- CI
  - Node 18; install deps; spin ephemeral service containers (Postgres/Redis/OpenSearch/ChromaDB).
  - Parallelize: backend unit+integration, frontend tests, lint, typecheck.
- Staging (if available)
  - Near-prod infra and data volume; scheduled nightly E2E/regression and performance smoke runs.

### 5) Tooling and Conventions
- Backend
  - Jest + ts-jest, Supertest; nock/MSW-node for HTTP; Docker test services or Testcontainers.
  - Coverage thresholds: lines 85%, branches 80% (gate CI).
- Frontend
  - Vitest + React Testing Library + user-event; MSW for API mocking.
  - Visual checks via Storybook; optional visual regression.
- E2E
  - Playwright: retries, traces/videos on failure.
- Performance
  - k6 scripts in `scripts/perf/`; run smoke in CI, full runs on schedule.
- Security
  - OWASP ZAP baseline (CI), npm audit (fail on high/critical).
- Quality Gates
  - ESLint + Prettier; TypeScript strict where feasible; commit hooks (husky/lint-staged).

### 6) Test Data and Fixtures
- Use `docs/TEST_DATA.md` and `packages/backend/test-downloads/*` as canonical fixtures.
- Seed minimal Postgres schema via `infrastructure/docker/postgres/init.sql` for local/CI.
- Create synthetic documents for PDFs, DOCX, CSV parsing edge cases.
- External API calls:
  - Scrapers: snapshot HTML fixtures; avoid live scraping in CI. Add nightly job with retries.
  - OpenAI: mock embeddings; record deterministic vectors for fixed texts.

### 7) Coverage by Subsystem (Key Scenarios)
- Backend Routes
  - `POST /jobs`: happy path, invalid payload, duplicate, rate-limited, queue failure.
  - `GET /jobs/:id`: states (queued, processing, completed, failed), progress %, errors.
  - `GET /jobs`: paging/filtering.
  - `POST /upload`: PDF/DOCX/TXT/CSV handling; mime validation; oversized; suspicious names; storage + processing.
  - `GET /documents/:id`: 404, content-type, byte ranges.
  - `GET /search`: query parsing, hybrid weights, empty results, pagination, ranking consistency.
- Queue and Processing
  - Enqueue with dedup/idempotency; retries/backoff; poison jobs; job timeout; cleanup.
  - JobProcessor emits Socket.IO events; order and content correctness.
- Scrapers/Downloader
  - Parsers (ArXiv, PubMed, Google Scholar) with fixture pages; network errors; rate limit handling.
- File Processing
  - PDF extraction edge cases; DOCX conversion errors; CSV delimiter/quote variants; encoding detection; MIME spoofing.
- Embeddings and Indexing
  - Embedding batching; token limits; provider error; index writes to OpenSearch/ChromaDB; consistency checks.
- Hybrid Search
  - Weighting/normalization; tie-breaking; result merging determinism; performance targets.
- Metrics/Logging
  - `/metrics` JSON shape; `/metrics/prometheus` exposition; counters/histograms increment at expected points.
- Frontend
  - `JobCreationForm`: Zod validation, disabled/enabled submit, error banners.
  - `JobsPage` + `JobDetailsPage`: WebSocket updates, progress rendering, failed states.
  - `SearchPage`: debounce, empty states, pagination/infinite load; hybrid results render.
  - `DocumentViewer`: PDF rendering success/failure, large doc paging, loading states.
  - Zustand stores and React Query cache interactions; `ErrorBoundary` fallback.
  - Accessibility: form labels, focus, keyboard nav, ARIA.

### 8) Non-Functional Targets (initial)
- Performance
  - Search p95 < 300ms warm, < 700ms under load.
  - WebSocket event delivery p95 < 200ms from state change.
  - Job throughput baseline to be established and tracked.
- Resilience
  - Transient Redis/Postgres outage auto-recovery; at-least-once processing without duplicates; graceful shutdown drains queues.
- Security
  - Validate all route payloads; correct CORS; secure headers; upload size/type limits; SSRF defenses.

### 9) CI Pipeline (per PR)
- Install, typecheck, lint.
- Spin infra services (Postgres, Redis, OpenSearch, ChromaDB).
- Backend: unit + integration (Supertest).
- Frontend: unit/component.
- Optional: Playwright E2E smoke.
- Coverage report; thresholds enforced.
- Security scans: `npm audit --audit-level=high`.
- Artifacts: junit, coverage lcov, Playwright traces/videos, k6 summary.

### 10) Entry/Exit Criteria
- Entry to test: feature branch with passing unit tests; feature flags toggled as needed.
- Exit for merge: CI green; coverage thresholds met; no high/critical vulnerabilities; no new flaky tests.
- Exit for release: staging E2E smoke passes; performance smoke within targets; dashboards green.

### 11) Defect Management
- Severity: Blocker, Major, Minor, Trivial.
- Priority: P0/P1/P2 by user impact and release proximity.
- Triage daily; link tests to regressions; add regression tests before closing.

### 12) Schedule and Cadence
- Per-PR automation mandatory.
- Nightly: extended integration (limited real scrapes), performance smoke, ZAP baseline.
- Weekly: full performance runs; dependency updates; flake report review.

### 13) Risks and Mitigations
- External source flakiness → fixtures; nightly live checks; retries/backoff.
- Vendor API limits (OpenAI) → mock in CI; batch requests; fallback paths.
- Search infra cold starts → warmup step in CI; cache priming in staging.
- PDF parsing variability → broaden fixture corpus; add heuristics and fallbacks.

### 14) Getting Started (Local)
- Start infra: `npm run setup:infrastructure`.
- Backend tests: `cd packages/backend && npm test`.
- Frontend tests: `cd packages/frontend && npm test`.
- E2E (after starting servers): `npm run e2e:install && npm run test:e2e`.
- Perf smoke (requires Docker or k6): `npm run perf:smoke`.

### 15) Deliverables
- Automated tests in `packages/backend/src/tests` and `packages/frontend/src/tests`.
- Playwright E2E scaffolding in `e2e/`.
- k6 perf scripts in `scripts/perf/`.
- CI config with jobs, coverage gating, reports, and artifacts.


