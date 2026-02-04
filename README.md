# DataSync Ingestion Solution

This repository contains a production-ready data ingestion system designed to extract 3,000,000 events from the DataSync Analytics API and store them in PostgreSQL.

## 🚀 How to Run

The entire solution is containerized and automated.

1.  **Start Ingestion:**
    ```bash
    sh run-ingestion.sh
    ```
    This script will:
    - Build the Docker containers.
    - Start PostgreSQL and the Ingestion Service.
    - Monitor the ingestion progress until completion.

2.  **Verify Data:**
    Connect to the database locally on port `5434`:
    ```bash
    psql -h localhost -p 5434 -U postgres -d ingestion
    # Password: postgres
    SELECT count(*) FROM ingested_events;
    ```

## 🏗 Architecture

The solution uses a **single-threaded, rate-limit-aware worker** pattern to ensure safety and correctness.

-   **Service:** `ingestion` (Node.js/TypeScript)
-   **Database:** `postgres` (PostgreSQL 16)
-   **Communication:** REST API via Axios (with retries)

### Key Components

1.  **IngestionRunner (`runner.ts`):**
    -   Orchestrates the fetch-save-checkpoint loop.
    -   Manages rate limiting (proactive delay + reactive 429 handling).
    -   Ensures **idempotency** and **resumability** via database transactions.

2.  **DataSyncClient (`datasync.client.ts`):**
    -   Handles HTTP communication.
    -   Implements **exponential backoff** for network errors.
    -   Validates API responses using **Zod** schemas.

3.  **Repositories:**
    -   `EventsRepository`: Batch inserts events using `ON CONFLICT DO NOTHING` to prevent duplicates.
    -   `CheckpointsRepository`: Persists the last valid cursor to `ingestion_checkpoints` table.

4.  **Cursor Management (`cursor.ts`):**
    -   Decodes and refreshes the base64 cursor to extend its expiration time (`exp` claim), preventing `400 Bad Request` errors during long pauses or retries.

## 🔍 Discovered API Behaviors

During analysis, the following behaviors were confirmed and handled:

1.  **Global Rate Limit:**
    -   Strict limit of ~10 requests per 20-second window.
    -   Handled via a configured `RATE_LIMIT_DELAY_MS` of 2200ms (approx 1 request every 2.2s) and adherence to `X-RateLimit-Reset` headers.

2.  **Pagination & Cursors:**
    -   Max page size is **5000** items.
    -   Cursors are base64-encoded JSON objects containing an expiration timestamp (`exp`).
    -   Cursors expire after ~2 minutes. The system automatically refreshes them client-side.

3.  **Data Quality:**
    -   Timestamps appear in mixed formats (ISO strings and Epoch numbers).
    -   Normalized to `Date` objects using Zod transformers.

## ⚠️ Rate Limit & Pagination Realities

-   **Throughput:** The API allows effectively ~30 requests/minute. With a batch size of 5000, the theoretical max throughput is 150,000 events/minute.
-   **Safety First:** To strictly adhere to the `10 req / 20s` limit without risking 429s, the system adds a safety buffer, stabilizing at ~25-27 requests/minute.
-   **Resumability:** If the process is killed, it resumes from the last committed checkpoint. No data is lost, and no duplicates are created.

## 🔮 Future Improvements

With more time or relaxed constraints, the following could be improved:

1.  **Parallelism (if permitted):** If the API allowed concurrency > 1, we could partition the keyspace (if possible) or use multiple API keys to increase throughput.
2.  **Metrics:** Integrate Prometheus/Grafana to visualize ingestion rate and API latency.
3.  **Queueing:** Decouple fetching and insertion using a message queue (RabbitMQ/Kafka) if DB write latency becomes a bottleneck (though currently the API is the bottleneck).

---
*Submission Ready - 2026-02-04*
