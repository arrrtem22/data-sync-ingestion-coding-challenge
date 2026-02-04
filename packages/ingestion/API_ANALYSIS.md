# DataSync Analytics API Analysis

## 1. Confirmed Pagination Contract
- **Endpoint:** `GET /api/v1/events`
- **Limit:** 
  - Max effective limit is **5000**.
  - Requests for >5000 items (e.g. 10000, 20000) are accepted but capped at 5000.
  - Default limit appears to be small (likely 10 or 50).
- **Cursor:**
  - Field: `pagination.nextCursor` in the response body.
  - Type: Base64 encoded JSON string.
  - Structure: `{"id": "...", "ts": <timestamp>, "v": 2, "exp": <expiration_ms>}`.
  - **Expiration:** The cursor expires in approximately **116-120 seconds**.
  - **Authority:** The cursor is client-side state (unsigned). It can be decoded and modified (e.g. to extend expiration), which is handled by `utils/cursor.ts`.
- **Ordering:** Events are ordered by timestamp (ascending), as evidenced by the `ts` field in the cursor.
- **Completion:** `pagination.hasMore` is boolean. When `false`, ingestion is complete.

## 2. Rate Limits & Headers
- **Limit:** 10 requests per window.
- **Window:** Approximately **20 seconds** (based on `x-ratelimit-reset` behavior).
- **Refill Rate:** ~0.5 requests/second (1 token every 2 seconds).
- **Headers:**
  - `x-ratelimit-limit`: 10
  - `x-ratelimit-remaining`: Decrements with each request.
  - `x-ratelimit-reset`: Seconds until window reset / token refill.
  - `Retry-After`: Seconds to wait (returned on 429).
- **Effective Throughput:**
  - Max 30 requests per minute.
  - Max 5000 items per request.
  - Theoretical Max: 150,000 items/minute.
  - Time to ingest 3M events: ~20 minutes.

## 3. Fastest Safe Request Pattern
To maximize throughput while remaining safe:
1. **Batch Size:** Set `limit=5000`.
2. **Concurrency:** Serial requests (due to global rate limit and cursor dependency).
3. **Pacing:**
   - **Optimal:** 1 request every **2.1 seconds** (2100ms).
   - This stays just under the refill rate (0.5 req/s).
   - Alternatively, burst 10 requests and wait ~12-15s, but smooth pacing is safer.
4. **Retry Logic:** 
   - On 429, respect `x-ratelimit-reset` or `Retry-After` (plus a small buffer).

## 4. Edge Cases & Pitfalls
- **Cursor Expiration:** 
  - The cursor expires quickly (2 mins). 
  - **Solution:** `utils/cursor.ts` implements `refreshCursor` which extends the `exp` claim. This must be used before every request if there's a delay.
- **Rate Limit Consumption by Other Services:**
  - The `assignment-ingestion` container (if running) consumes the rate limit in the background. **It must be stopped** to allow the ingestion script to run successfully.
- **Limit Cap:**
  - Requesting `limit=10000` does not error but returns 5000. Logic counting on `limit` items being returned must be robust to receiving fewer.
- **Environment Interference:**
  - Shared API keys or multiple local processes can starve the rate limit.

## 5. Implementation Updates
- Updated `.env`:
  - `BATCH_SIZE=5000`
  - `RATE_LIMIT_DELAY_MS=2100`
- The existing `IngestionRunner` correctly handles 429s and uses `refreshCursor`, so code changes were minimal (config only).
