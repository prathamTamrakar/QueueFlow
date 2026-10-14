# QueueFlow: Distributed Job Processing System
## Comprehensive Technical Architecture & Engineering Manual

---

## 1. Executive Summary & Problem Solved

Modern web applications must handle long-running, resource-intensive, or unreliable third-party tasks (such as sending transactional emails, generating PDF reports, performing heavy data computation, and integrating with external payment gateways). Executing these tasks synchronously within HTTP request cycles causes:
1. **HTTP connection timeouts and thread starvation.**
2. **Cascading failures:** If an external downstream service fails or is slow, the entire user-facing API crashes or becomes unresponsive.
3. **Duplicate side effects:** If an API client retries a timed-out request, an email might be sent twice or a customer billed multiple times.
4. **Data loss:** If an API process restarts mid-request, pending jobs vanish from memory.

**QueueFlow** solves these challenges by implementing an asynchronous, decoupled, distributed background job processing system. It separates fast HTTP ingestion from durable background worker execution, guarantees **atomic idempotency**, enforces **exponential backoff with jitter**, preserves audit history, isolates unrecoverable errors into a **durable Dead-Letter Queue (DLQ)** with manual replay capabilities, and exposes real-time telemetry through **Prometheus, Grafana, and a ChaiUI React Dashboard**.

---

## 2. Technology Stack & Architectural Decisions

| Layer | Technology | Version | Architectural Rationale |
|---|---|---|---|
| **Runtime & Language** | Node.js + TypeScript | Node v22, TS v5 | Strict compile-time type safety across payloads, database models, and API responses. Non-blocking asynchronous I/O ideal for high-throughput queuing. |
| **REST API Server** | Express.js | v4.21 | Minimal, reliable HTTP layer with low latency, helmet security headers, and structured middleware chaining. |
| **Message Broker** | Redis | v7.2-alpine | In-memory data store with atomic sorted sets (`ZSET`), hashes, and streams. Provides microsecond-level latency for job status transitions and scheduling. |
| **Queue Engine** | BullMQ | v5.41 | Modern Redis-backed queue system for Node.js. Built-in support for delayed jobs, rate limiters, parent-child flows, stalled-job detection, and worker locks. |
| **Database & Persistence** | PostgreSQL | v16-alpine | Authoritative relational store for long-term metadata, job attempts, execution duration percentiles, audit trails, and atomic unique idempotency constraints. |
| **ORM** | Prisma | v6.4 | Type-safe schema definition, automated migrations, and compile-time validated database client. |
| **Validation** | Zod | v3.24 | Runtime schema validation for untrusted user inputs, preventing payload tampering or ill-formatted queue messages. |
| **Telemetry & Metrics** | Prometheus (`prom-client`) | v15.1 | Industry standard pull-based time-series metrics. Collects throughput, queue depth, percentiles, and error counters without high-cardinality bloat. |
| **Dashboards & Alerting** | Grafana | Latest | Pre-provisioned visual monitoring panels with automated alerting rules for queue backlogs and failure rate anomalies. |
| **Frontend UI** | React 18, Vite, Tailwind CSS, Recharts | React 18, Vite 6 | Fast SPA with ChaiUI aesthetics, real-time polling, interactive job dispatching, and DLQ management. |
| **Load Testing** | k6 (Grafana) | Latest | Developer-friendly performance testing tool capable of generating high arrival rates, measuring p50/p95/p99 latencies and simulating traffic storms. |
| **Testing** | Vitest, Supertest | Vitest 3 | Fast ESM-compatible unit and integration test runner with in-memory service isolation. |
| **Containerization** | Docker, Docker Compose | Spec v2 | Reproducible multi-container topology (PostgreSQL, Redis, API, Worker, Frontend, Prometheus, Grafana). |

---

## 3. End-to-End System Workflow (Step-by-Step Lifecycle)

```
[ Client / Producer ]
       │  (1) POST /api/jobs + Idempotency-Key
       ▼
[ Express API Server ] ──► (2) Zod Validation ──► (3) SHA-256 Idempotency Check
       │                                                      │
       ├──────────────────────────────────────────────────────┴── If duplicate: Return cached job ID
       │  (4) Begin Transaction
       ▼
[ PostgreSQL DB ] ──► Inserts `Job` (PENDING) & `JobAuditLog` (ENQUEUED)
       │
       ▼  (5)
[ Redis Broker (BullMQ) ] ──► Enqueues Job (Payload + Priority + Max Attempts + Backoff)
       │
       ▼  (6) Immediate HTTP 201 Response returned to Client { id: "job-uuid", status: "PENDING" }
       │
═══════════════════════════════════════════════════════════════════════════════════
                    ASYNCHRONOUS WORKER PROCESSING BOUNDARY
═══════════════════════════════════════════════════════════════════════════════════
       │
       ▼  (7) BRPOPLPUSH / Worker poll
[ BullMQ Worker Process ] ──► Acquires job lock (30s timeout)
       │
       ├─► (8) DB Update: `Job` -> ACTIVE, `JobAttempt` -> RUNNING
       │
       ├─► (9) Workload Router: Dispatches to Email, PDF, CPU, or Failure Handler
       │       │
       │       ▼ (10) Side-Effect Guard (e.g. SideEffectLog check)
       │              Guarantees external action happens exactly once.
       │
       ├──► CASE A: SUCCESS
       │      │
       │      ├─► Writes `JobResult` (output JSON + executionDurationMs)
       │      ├─► Updates `JobAttempt` -> SUCCESS
       │      ├─► Updates `Job` -> COMPLETED
       │      └─► Records Prometheus Metrics: `jobs_completed_total`, `job_processing_duration_seconds`
       │
       ├──► CASE B: TRANSIENT FAILURE (RetryableError)
       │      │
       │      ├─► Updates `JobAttempt` -> FAILED (records errorName, errorMessage, stack)
       │      ├─► If attempt < maxAttempts:
       │      │     ├─► BullMQ schedules retry with exponential backoff: delay = baseDelay * 2^(attempt-1)
       │      │     └─► Increments `jobs_retried_total`
       │      │
       │      └─► If attempt >= maxAttempts:
       │            └─► Route to CASE C (Exhausted Retries)
       │
       └──► CASE C: PERMANENT FAILURE (NonRetryableError OR Retries Exhausted)
              │
              ├─► Updates `Job` -> FAILED
              ├─► Persists `DeadLetterRecord` in PostgreSQL (originalPayload, failureCount, stack)
              ├─► Pushes failed task to BullMQ `dead-letter-jobs` stream
              ├─► Throws BullMQ `UnrecoverableError` (halts further retries)
              └─► Increments `dead_letter_jobs_total`
```

---

## 4. Deep-Dive Component Breakdown

### A. API Layer (`backend/src/api/`)

#### 1. Server Bootstrap (`server.ts`)
- Configures security headers using `helmet()`.
- Enables Cross-Origin Resource Sharing (`cors()`) for the dashboard.
- Configures JSON and URL-encoded body parsers with a 10MB payload limit.
- Mounts request latency tracking middleware (`metricsMiddleware.ts`) for Prometheus.
- Implements graceful shutdown listeners (`SIGINT`, `SIGTERM`), allowing in-flight HTTP connections, database pools, and Redis clients to terminate cleanly.

#### 2. Middleware (`middleware/`)
- **`errorHandler.ts`**: Intercepts all thrown exceptions. Maps `ZodError` to HTTP 422 with issue details, `AppError` subclasses to their explicit HTTP status codes, and unhandled errors to HTTP 500 with sanitized messages.
- **`metricsMiddleware.ts`**: High-resolution timer (`process.hrtime()`) that calculates request durations and updates `http_request_duration_seconds` labeled by method, normalized route pattern, and status code.
- **`auth.ts`**: Enforces administrative role-based access for Dead-Letter Queue management and replay endpoints. Validates incoming requests against `ADMIN_API_KEY` via `x-admin-key` header or `Authorization: Bearer <key>`.

#### 3. Controllers & Routes (`controllers/` & `routes/`)
- **`JobsController` (`jobs.controller.ts`)**:
  - `POST /api/jobs`: Accepts job specification, parses with `CreateJobSchema`, extracts optional `Idempotency-Key`, calls `JobService.createJob()`, and returns HTTP 201.
  - `GET /api/jobs`: Parses pagination (`page`, `limit`) and filters (`status`, `type`, `search`, `startDate`, `endDate`), returning matching jobs with metadata.
  - `GET /api/jobs/:id`: Fetches single job with complete attempt history, results, and audit timeline.
  - `GET /api/jobs/:id/result`: Returns output data for completed jobs or pending status indicator.
  - `POST /api/jobs/:id/cancel`: Cancels enqueued/delayed jobs in BullMQ and marks status `CANCELLED` in PostgreSQL.
- **`AdminController` (`admin.controller.ts`)**:
  - `GET /api/admin/jobs/failed`: Lists all failed jobs residing in the Dead-Letter Queue.
  - `GET /api/admin/jobs/:id`: Detailed inspection of an unresolvable job and its failure traces.
  - `POST /api/admin/jobs/:id/replay`: Replays an unresolvable job from DLQ, resetting attempt counts and adding it back to the active queue.
- **`QueuesController` (`queues.controller.ts`)**:
  - `GET /api/queues/stats`: Combines live BullMQ Redis counts (waiting, active, completed, failed, delayed) with PostgreSQL audit totals and calculates p50/p95/p99 execution percentiles.
- **`HealthController` (`health.controller.ts`)**:
  - `GET /health`: Liveness probe (HTTP 200).
  - `GET /ready`: Readiness probe verifying PostgreSQL query `SELECT 1` and Redis `PING` response.
  - `GET /metrics`: Serializes Prometheus metrics into standard Prometheus exposition format.

---

### B. Business Logic & Services Layer (`backend/src/services/`)

#### 1. `JobService` (`job.service.ts`)
- Manages transactional job creation:
  - Validates idempotency key (if present) against `IdempotencyRecord`.
  - Persists `Job` record in PostgreSQL with initial `PENDING` or `DELAYED` status.
  - Creates an initial `JobAuditLog` entry with action `ENQUEUED`.
  - Enqueues the job in BullMQ using `jobQueue.add(type, data, opts)`.
  - Stores the BullMQ generated job ID on the PostgreSQL `Job` model.
  - Updates Prometheus `jobs_enqueued_total` counter.

#### 2. `IdempotencyService` (`idempotency.service.ts`)
- Computes a deterministic SHA-256 hash of the incoming request payload (`hashPayload`).
- Inspects `IdempotencyRecord` table:
  - If the key exists and matches the stored hash, returns the cached HTTP status code and response payload.
  - If the key exists but the hash differs (payload collision or tampering), throws `IdempotencyConflictError` (HTTP 409).
  - If the key does not exist, allows job creation and records the response atomically with a 24-hour expiration TTL.

#### 3. `SideEffectService` (`side-effect.service.ts`)
- Protects external business actions (e.g. sending emails or debiting accounts) from executing twice during worker crashes or retries.
- Checks `SideEffectLog` for unique `dedupKey = ${effectType}:${jobId}:${hash}`.
- If already recorded, skips execution and returns cached result.
- If not recorded, executes the asynchronous action and records the completion status in a single database transaction.

#### 4. `DLQService` (`dlq.service.ts`)
- Responsible for durable Dead-Letter Queue management:
  - `recordToDLQ`: Upserts `DeadLetterRecord`, increments failure count, records failure timestamps, writes `MOVED_TO_DLQ` audit log, and pushes task to `dead-letter-jobs` Redis stream.
  - `replayJob`: Re-enqueues failed job into BullMQ with increased priority, resets attempt counters, marks `lastReplayedAt`, and logs `REPLAYED` audit entry.

#### 5. `StatsService` (`stats.service.ts`)
- Queries BullMQ's Redis memory broker via `jobQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')`.
- Queries PostgreSQL canonical state for status aggregations.
- Calculates mathematical percentiles (`p50`, `p95`, `p99`) across recent `JobResult.executionDurationMs` values.
- Updates Prometheus `queue_depth` gauges for each state.

#### 6. `AuditService` (`audit.service.ts`)
- Writes append-only historical records to `JobAuditLog` tracking actor identity (`SYSTEM`, `WORKER`, `API_USER`, `ADMIN`), action type, and JSON metadata.

---

### C. Queue & Broker Layer (`backend/src/queues/`)

- **Connection Pool (`redisConnection`)**: Single shared `ioredis` instance configured with `maxRetriesPerRequest: null` (required by BullMQ) and `enableReadyCheck: false`.
- **Primary Queue (`jobQueue`)**:
  - Name: `default-jobs`.
  - Default Job Options: 3 attempts, exponential backoff (1000ms base delay), retention policies (completed jobs kept 24 hours, failed jobs kept 7 days for audit).
- **Dead-Letter Queue (`dlqQueue`)**: Dedicated queue broker instance (`dead-letter-jobs`) for exhausted tasks.
- **Queue Events (`getQueueEvents()`)**: Lazily initialized subscriber for distributed event listening.

---

### D. Worker Layer (`backend/src/workers/`)

#### 1. Worker Daemon (`worker.ts`)
- Initializes BullMQ `Worker` instance listening to `default-jobs`.
- **Configurable Concurrency**: Defaults to 5 parallel worker threads per process instance.
- **Rate Limiting**: Built-in token bucket limiter (defaults to 100 operations per 1000ms).
- **Stalled Job Recovery**: Maintains a 30-second lock duration (`lockDuration: 30000`). If a worker container crashes or gets killed, peer workers detect the orphaned lock and recover the stalled job up to `maxStalledCount: 2` times.
- **Active Worker Tracking**: Updates Prometheus `worker_active_count` gauge during job processing lifecycle.
- **Graceful Shutdown**: Listens to termination signals (`SIGINT`, `SIGTERM`), allowing active tasks to finish before closing Redis connections and database pools.

#### 2. Central Processor (`processor.ts`)
- Coordinates the execution lifecycle of every job received from BullMQ:
  1. Creates `JobAttempt` in PostgreSQL with status `RUNNING` and captures start timestamp.
  2. Updates `Job` status to `ACTIVE`.
  3. Writes `ATTEMPT_STARTED` audit entry.
  4. Wraps execution in `Promise.race` against the job's configurable `timeoutMs` (defaults to 30,000ms). If exceeded, throws `JobTimeoutError`.
  5. Dispatches to workload handlers based on `job.data.type`.
  6. **On Success**:
     - Saves output to `JobResult`.
     - Updates `JobAttempt` -> `SUCCESS` with execution duration.
     - Updates `Job` -> `COMPLETED`.
     - Resolves any pending DLQ records (`isResolved = true`).
     - Observes Prometheus `jobs_completed_total` and duration histogram.
  7. **On Failure**:
     - Inspects error classification (`RetryableError` vs `NonRetryableError`).
     - Updates `JobAttempt` -> `FAILED` with error name, message, and stack trace.
     - Writes `ATTEMPT_FAILED` audit entry.
     - If non-retryable OR attempts exhausted: Marks `Job` -> `FAILED`, routes to `DLQService.recordToDLQ()`, and throws BullMQ `UnrecoverableError`.
     - If retryable and attempts remain: Increments `jobs_retried_total` and rethrows error to trigger BullMQ exponential backoff.

#### 3. Workload Handlers (`workers/handlers/`)
- **`email.handler.ts`**: Simulates SMTP delivery latency (150–300ms) and uses `SideEffectService` to guarantee that duplicate emails are never sent upon retries.
- **`pdf.handler.ts`**: Simulates CPU-heavy document rendering (proportional to page count), generates simulated PDF artifacts, calculates byte sizes, and produces SHA-256 checksums.
- **`cpu-light.handler.ts`**: Performs in-memory cryptographic hashing over partition records to benchmark raw CPU execution.
- **`failure-sim.handler.ts`**: Configurable failure simulator:
  - Demonstrates **3rd-attempt recovery**: Fails twice with transient `RetryableError` and succeeds on the 3rd attempt.
  - Demonstrates **immediate DLQ transition**: Fails with fatal `NonRetryableError` and skips retries directly to the Dead-Letter Queue.

---

### E. PostgreSQL Relational Model (`backend/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id              String             @id @default(uuid())
  bullMqJobId     String?            @unique
  type            JobType
  queueName       String             @default("default-jobs")
  payload         Json
  priority        Int                @default(0)
  status          JobStatus          @default(PENDING)
  maxAttempts     Int                @default(3)
  attemptCount    Int                @default(0)
  backoffType     String             @default("exponential")
  backoffDelayMs  Int                @default(1000)
  timeoutMs       Int                @default(30000)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  startedAt       DateTime?
  completedAt     DateTime?
  failedAt        DateTime?

  idempotencyRecord IdempotencyRecord?
  attempts          JobAttempt[]
  result            JobResult?
  deadLetterRecord  DeadLetterRecord?
  auditLogs         JobAuditLog[]

  @@index([status])
  @@index([type])
  @@index([createdAt])
  @@index([queueName, status])
}

model IdempotencyRecord {
  key            String    @id
  jobId          String?   @unique
  requestHash    String
  responseStatus Int
  responseBody   Json
  createdAt      DateTime  @default(now())
  expiresAt      DateTime
  job            Job?      @relation(fields: [jobId], references: [id], onDelete: SetNull)

  @@index([expiresAt])
}

model JobAttempt {
  id            String        @id @default(uuid())
  jobId         String
  attemptNumber Int
  status        AttemptStatus
  workerId      String?
  errorName     String?
  errorMessage  String?
  errorStack    String?
  isRetryable   Boolean       @default(true)
  durationMs    Int?
  startedAt     DateTime      @default(now())
  finishedAt    DateTime?
  job           Job           @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, attemptNumber])
  @@index([status])
}

model JobResult {
  id                  String   @id @default(uuid())
  jobId               String   @unique
  data                Json
  executionDurationMs Int
  createdAt           DateTime @default(now())
  job                 Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
}

model DeadLetterRecord {
  id              String    @id @default(uuid())
  jobId           String    @unique
  originalPayload Json
  errorReason     String
  errorDetails    Json?
  failureCount    Int
  firstFailedAt   DateTime  @default(now())
  lastFailedAt    DateTime  @default(now())
  replayCount     Int       @default(0)
  lastReplayedAt  DateTime?
  isResolved      Boolean   @default(false)
  resolvedAt      DateTime?
  resolvedBy      String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  job             Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([isResolved])
  @@index([lastFailedAt])
}

model JobAuditLog {
  id        String      @id @default(uuid())
  jobId     String
  action    AuditAction
  actor     ActorType   @default(SYSTEM)
  actorId   String?
  details   Json?
  timestamp DateTime    @default(now())
  job       Job         @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@index([timestamp])
  @@index([action])
}

model SideEffectLog {
  id          String   @id @default(uuid())
  dedupKey    String   @unique
  jobId       String
  effectType  String
  recipient   String?
  status      String   @default("COMPLETED")
  executedAt  DateTime @default(now())

  @@index([jobId])
  @@index([dedupKey])
}
```

---

### F. Observability & Telemetry

#### 1. Prometheus Metrics (`backend/src/metrics/`)
All metrics are registered on a dedicated Prometheus Registry:
- `queueflow_jobs_enqueued_total{queue, job_type}` (Counter)
- `queueflow_jobs_completed_total{queue, job_type}` (Counter)
- `queueflow_jobs_failed_total{queue, job_type, is_final}` (Counter)
- `queueflow_jobs_retried_total{queue, job_type}` (Counter)
- `queueflow_queue_depth{queue, state}` (Gauge across waiting, active, delayed, failed)
- `queueflow_job_processing_duration_seconds{queue, job_type, status}` (Histogram with buckets `[0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]`)
- `queueflow_http_request_duration_seconds{method, route, status_code}` (Histogram)
- `queueflow_worker_active_count{worker_id}` (Gauge)
- `queueflow_idempotency_conflicts_total` (Counter)
- `queueflow_dead_letter_jobs_total{queue, job_type}` (Counter)

#### 2. Alert Rules (`docker/prometheus/alert_rules.yml`)
- `HighQueueBacklog`: Alerts when waiting queue backlog exceeds 500 jobs for over 2 minutes.
- `ElevatedJobFailureRate`: Alerts when 5-minute failure rate exceeds 10%.
- `DeadLetterQueueSpike`: Triggers when new unresolvable jobs enter the Dead-Letter Queue.
- `NoActiveWorkers`: Triggers when active worker count drops to zero for over 3 minutes.

---

### G. React Monitoring Dashboard & ChaiUI System (`frontend/`)

- Built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Recharts**.
- Designed according to the **ChaiUI** opinionated design system (`https://ui.chaicode.com`):
  - **Backdrop**: Subtle ambient top warm hexagon glow (`ChaiBackdrop`).
  - **Asymmetric Buttons**: Solid white on dark with asymmetric corner cuts (`btn-asym`: `rounded-none rounded-tr-lg rounded-bl-lg`) and `ArrowUpRight` icon.
  - **Animated Badge**: 1px spinning border glint (`AnimatedBadge`).
  - **Hairline Cards**: `chai-card` with warm hairlines (`border-orange-50/15`), zero box-shadows, and slight hover brightening.
  - **Typography**: Manrope for UI text, Montserrat for headings, Onest for the wordmark, and Geist Mono for code/identifiers.
  - **Highlight Phrases**: Exactly one pale-cream highlight phrase per paragraph (`<span className="highlight">`).
- **Dashboard Views**:
  1. **Live Overview**: Key metric cards, real-time Recharts area distribution graph, p50/p95/p99 latency cards, and recent executions table.
  2. **Job Explorer**: Searchable and filterable job table with pagination and inspection triggers.
  3. **Dead-Letter Queue**: Filterable list of unresolvable jobs with stack traces and one-click replay controls with confirmation modals.
  4. **Enqueue Modal**: Interactive form allowing instant dispatching of Email, PDF, CPU, and Failure Simulation jobs with custom idempotency keys and retry options.

---

## 5. k6 Performance & Load Testing Suite (`load-tests/`)

The repository contains 7 specialized test scenarios:

1. **`01-enqueue-throughput.js`**: Ramps traffic from 50 to 1,000 requests/second to measure maximum API ingestion capacity.
2. **`02-sustained-load.js`**: Sends a steady 150 requests/second for 3 minutes to verify memory stability and connection pool resilience.
3. **`03-spike-traffic.js`**: Injects a sudden 16x traffic burst (from 50 req/s to 800 req/s) to test queue buffering and event loop recovery.
4. **`04-stress-test.js`**: Ramps up to 1,000 concurrent Virtual Users to establish system breaking points.
5. **`05-idempotency-duplicate.js`**: Floods 500 concurrent requests across 5 shared idempotency keys to verify zero duplicate jobs are created.
6. **`06-failure-retry.js`**: Tests transient failure retries alongside permanent failures routing to DLQ.
7. **`07-end-to-end-latency.js`**: Submits a job and polls `/api/jobs/:id/result` until completed, measuring full round-trip execution latency.

---

## 6. Failure Recovery & Error Handling Flowchart

```
            [ Worker Picks Up Job ]
                       │
                       ▼
             [ Execute Workload ]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
     [ Success ]                 [ Throws Error ]
         │                           │
         │                     Is error an instance of
         │                     NonRetryableError?
         │                           │
         │                  ┌────────┴────────┐
         │             YES (Fatal)       NO (Transient)
         │                  │                 │
         │                  │          Attempts < MaxAttempts?
         │                  │                 │
         │                  │           ┌─────┴─────┐
         │                  │          YES          NO (Exhausted)
         │                  │           │           │
         │                  ▼           │           ▼
         │             ┌────────────────┴───────────────┐
         │             │  Route to Dead-Letter Queue    │
         │             │  - Mark Job as FAILED          │
         │             │  - Upsert DeadLetterRecord     │
         │             │  - Throw UnrecoverableError    │
         │             └────────────────────────────────┘
         │
         │ (Transient Retry Path)
         ▼
    ┌────────────────────────────────────────┐
    │  BullMQ Exponential Backoff Delay      │
    │  delay = baseDelay * 2^(attempt - 1)   │
    │  Re-enqueued for next attempt          │
    └────────────────────────────────────────┘
```

---

## 7. Local & Docker Execution Commands

### Full Stack Docker Startup (Recommended)
```bash
# Start all 7 services in detached mode
docker compose up -d --build

# Verify all containers are healthy
docker ps

# Seed sample jobs
docker exec queueflow-api npx ts-node prisma/seed.ts
```

### Access URLs
- **Monitoring Dashboard:** `http://localhost:3000`
- **REST API:** `http://localhost:4000`
- **Prometheus:** `http://localhost:9090`
- **Grafana:** `http://localhost:3001` (User: `admin` / Pass: `admin`)

### Run Automated Tests
```bash
cd backend
npm test
```

### Run k6 Load Tests via Docker (Zero Install)
```powershell
powershell -File load-tests/run-k6.ps1 01-enqueue-throughput.js
powershell -File load-tests/run-k6.ps1 02-sustained-load.js
powershell -File load-tests/run-k6.ps1 05-idempotency-duplicate.js
```
