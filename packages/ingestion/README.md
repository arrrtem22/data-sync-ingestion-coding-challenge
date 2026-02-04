# Ingestion Service

This service is responsible for reliably ingesting event data from the DataSync API into our local PostgreSQL database. It is built to be robust, fault-tolerant, and capable of resuming from where it left off in case of interruptions.

## 🚀 How to Run

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (for the database)

### Quick Start

1. **Start the Infrastructure** (Postgres):
   ```bash
   # From project root
   docker-compose up -d db
   ```

2. **Configure Environment**:
   Ensure `.env` exists in `packages/ingestion` (see `.env.example`).
   Key variables:
   - `API_BASE_URL`: The source API URL.
   - `DATABASE_URL`: Postgres connection string.
   - `BATCH_SIZE`: Events per fetch (default: 100).

3. **Run the Ingestion**:
   ```bash
   # From packages/ingestion
   npm install
   npm start
   ```
   *Note: The service automatically runs database migrations on startup.*

---

## 🏗 Architecture & Data Flow

The ingestion service follows a **Sequential Fetch-and-Commit** pattern to ensure data integrity and exactly-once processing (at-least-once with idempotency handling).

### Core Components
1. **Runner (`IngestionRunner`)**: The orchestrator that manages the main loop, state, and coordination between the API and Database.
2. **Client (`DataSyncClient`)**: A robust HTTP client wrapping Axios with:
   - Automatic retries (exponential backoff) for 5xx errors.
   - Zod schema validation to ensure runtime type safety.
   - Rate limit handling.
3. **Storage Layer**:
   - **Events Repository**: Bulk inserts events into Postgres.
   - **Checkpoints Repository**: Persists the pagination cursor transactionally (or immediately after) the data commit.

### Data Flow
1. **Boot**: Connect to DB, run migrations.
2. **Resume**: Query `checkpoints` table for the last successful cursor.
3. **Loop**:
   - **Fetch**: Request batch from API using current cursor.
   - **Validate**: Ensure response matches `EventSchema` via Zod.
   - **Transform**: Map API response to DB model.
   - **Persist**: Insert events into `events` table.
   - **Checkpoint**: Save `nextCursor` to `checkpoints` table.
   - **Throttle**: Wait `RATE_LIMIT_DELAY_MS` to respect API limits.

---

## 🔍 API Discovery vs. Documentation

During implementation, we discovered significant discrepancies between the provided documentation and the actual API behavior.

| Feature | Documentation claims | Actual Implementation |
|---------|----------------------|-----------------------|
| **Response Structure** | Flat structure:<br>`{ "data": [...], "hasMore": true, "nextCursor": "..." }` | Nested pagination object:<br>`{ "data": [...], "pagination": { "hasMore": true, "nextCursor": "..." } }` |
| **Endpoint** | `/api/v1/events` | `/events` (relative to the configured base URL) |

**Resolution**: The `DataSyncClient` uses a Zod schema (`ResponseSchema`) that matches the *actual* observed structure (nested pagination) to ensure parsing succeeds.

---

## 🛡 Pagination & Rate-Limit Handling

### Pagination
We use **Cursor-based pagination**.
- The cursor is opaque and provided by the API in the `nextCursor` field.
- We persist this cursor **only after** successfully saving the associated batch of events.
- This ensures that if the service crashes mid-batch, we restart from the previous valid cursor, re-fetching the batch (at-least-once delivery).

### Rate-Limiting Strategy
We employ a **Dual-Layer Strategy**:

1. **Proactive Throttling (Client-side)**:
   - We enforce a minimum delay (`RATE_LIMIT_DELAY_MS`) between requests to avoid accidental flooding.
   
2. **Reactive Backoff (Server-side)**:
   - If a `429 Too Many Requests` is received, the client intercepts the error.
   - It parses the `X-RateLimit-Reset` header.
   - It pauses execution until the reset time has passed, then retries the **same request** automatically.

---

## 🔁 Failure & Resume Scenarios

| Scenario | Behavior |
|----------|----------|
| **Service Crash / Restart** | On boot, the runner checks the `checkpoints` table. If a cursor exists, it resumes fetching from that exact point. No manual intervention required. |
| **Network Flakiness (502/503)** | `axios-retry` automatically retries the request up to 5 times with exponential backoff. |
| **Invalid Data / Schema Change** | Zod validation will fail, logging the specific structure mismatch. The service will log the error and retry after a delay (preventing crash loops but alerting on persistent issues). |
| **Rate Limit (429)** | The service pauses and respects the `Retry-After` / `X-RateLimit-Reset` window. |

---

## ⚡ Throughput Strategy

The current implementation prioritizes **reliability over raw speed**.

- **Sequential Processing**: We process one batch at a time (Fetch -> Save -> Checkpoint). This eliminates race conditions and simplifies error handling.
- **Batching**: We fetch events in chunks (configurable via `BATCH_SIZE`) to minimize network overhead and database transaction costs.

---

## ⚖️ Tradeoffs & Future Improvements

### Tradeoffs
- **Sequential Latency**: Since we wait for the DB write before fetching the next batch, throughput is limited by `RTT + DB_Write_Time`.
- **Single Worker**: The current architecture is single-threaded/single-instance. It cannot be horizontally scaled (multiple workers would race on the same cursor).

### Future Improvements
1. **Parallel Ingestion**: Partition the source data (if API supports sharding) to allow multiple workers.
2. **Prefetching**: Implement a producer-consumer pattern where one thread fetches pages into a queue while another drains the queue into the DB.
3. **Dead Letter Queue (DLQ)**: If a specific batch consistently fails validation or DB insertion, move it to a DLQ for manual inspection instead of blocking the pipeline indefinitely.

---

## 🤖 AI Tools Used

This solution was accelerated using the following AI tools and Agents:

- **Trae AI**: Primary IDE assistant for code generation, refactoring, and context management.
- **ChatGPT**: Used for prompt engineering and high-level architectural reasoning.
- **Claude Code**: (Mentioned as a preferred tool for future iterations).

**Agent Roles:**
1. **API DISCOVERY & PAGINATION TRUTH**: Responsible for identifying the mismatch between docs and actual API response structure.
2. **AGENT 2 — DATABASE & CHECKPOINTING ARCHITECT**: Designed the schema, repository pattern, and resume logic.
3. **AGENT 3 — INGESTION ENGINE & RATE LIMIT CONTROL**: Implemented the `IngestionRunner`, loop logic, and backoff strategies.
4. **AGENT 4 — DOCKER & EXECUTION SAFETY**: Handled containerization, environment setup, and startup scripts.
