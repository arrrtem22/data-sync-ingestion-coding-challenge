# DataSync Ingestion Service

## Overview

A production-grade TypeScript service designed for high-throughput data ingestion from the DataSync API. This service implements a resilient streaming pipeline that buffers events to disk before performing bulk ingestion into PostgreSQL, ensuring optimal performance and reliability under load.

## Project Structure

The codebase follows a domain-driven design pattern to ensure maintainability and separation of concerns:

```
src/
├── app/
│   ├── bootstrap.ts          # Application lifecycle & signal handling
│   ├── ingestion-job.ts      # Core ingestion orchestration
│   └── api-stream-reader.ts  # API client with automatic token management
├── core/
│   ├── config.ts             # Centralized configuration
│   ├── logger.ts             # Structured JSON logging
│   ├── metrics.ts            # Operational telemetry
│   └── ingestion-state-store.ts # Fault-tolerant state persistence
├── domain/
│   └── event.types.ts        # Type definitions
├── scripts/
│   └── start.sh              # Execution entrypoint
└── index.ts                  # Service entrypoint
```

## Architecture & Features

### Streaming Ingest Pipeline
The service leverages the platform's optimized streaming interface to achieve high throughput (~2000+ events/sec). It implements a robust backpressure handling mechanism that respects API rate limits and server capacity.

### Sequential Disk I/O Strategy
To decouple network throughput from database write latency, the service employs a buffered write strategy:
1.  Events are streamed and written sequentially to `events_buffer.tsv`.
2.  Data is bulk-loaded into PostgreSQL using the native `COPY` command.
This approach minimizes memory footprint and maximizes write throughput.

### Fault Tolerance & Resumability
-   **State Persistence**: Ingestion progress is checkpointed to `ingestion.state` (JSON).
-   **Automatic Recovery**: The service automatically resumes from the last confirmed cursor upon restart.
-   **Resilience**: Implements exponential backoff for rate limits (429) and transient server errors (5xx).

### Observability
-   **Telemetry**: Real-time tracking of throughput, latency, and error rates.
-   **Structured Logging**: Machine-readable JSON logs for integration with log aggregation systems.

## Operational Notes

-   **Environment**: Configurable via `.env` or environment variables.
-   **Graceful Shutdown**: Handles `SIGINT`/`SIGTERM` to ensure data integrity during shutdowns.
-   **Testing**: Comprehensive unit tests using Vitest ensure component reliability.

## How to Run

1.  **Start Dependencies**:
    ```bash
    docker-compose up -d postgres
    ```

2.  **Execute Ingestion**:
    ```bash
    sh packages/ingestion/src/scripts/start.sh
    # Or via Docker wrapper
    docker-compose run ingestion
    ```
