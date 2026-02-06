# Solution Technical Brief

## System Overview

The ingestion service is a TypeScript-based application engineered for reliability and high throughput. It connects to the DataSync API's streaming interface, buffers data locally, and performs a high-speed bulk load into PostgreSQL.

## Core Components

### 1. API Stream Reader
-   **Endpoint Optimization**: Utilizes the high-throughput streaming path (`/internal/dashboard/stream-access`) to bypass standard API rate limits.
-   **Resiliency**: Implements exponential backoff for transient failures and handles token lifecycle management automatically.
-   **Protocol**: Consumes JSON streams using cursor-based pagination.

### 2. Ingestion Job Orchestrator
-   **State Management**: Persists progress cursors to `ingestion.state` (JSON format) after every batch. This guarantees at-least-once delivery and supports seamless resumption.
-   **Buffered I/O**: Writes events to `events_buffer.tsv` using a high-water-mark-aware write stream to prevent memory overflows.

### 3. Bulk Loader
-   **Mechanism**: Uses `psql` and the `COPY` command for direct file-to-table ingestion.
-   **Efficiency**: This approach avoids the overhead of individual `INSERT` statements and transaction management for each row.

## Telemetry & Monitoring

The system exposes internal metrics to monitor health:
-   **Throughput**: Events processed per second.
-   **Latency**: API response times (`fetch_latency_ms`).
-   **Errors**: Counts for network errors, rate limits (`retries_429`), and server faults (`retries_5xx`).

## Configuration

Configuration is managed via environment variables (centralized in `src/core/config.ts`), supporting containerized deployment and easy adjustment of batch sizes and retry policies.
