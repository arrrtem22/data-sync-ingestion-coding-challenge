import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { metrics } from '../core/metrics.js';
import { EventBatch, StreamAccess } from '../domain/event.types.js';

export class ApiStreamReader {
  private streamAccess: StreamAccess | null = null;

  private async getStreamToken(): Promise<StreamAccess> {
    const start = Date.now();
    try {
        const baseUrl = config.apiBaseUrl.replace('/api/v1', '');
        const tokenRes = await fetch(`${baseUrl}/internal/dashboard/stream-access`, {
        method: 'POST',
        headers: {
            'X-API-Key': config.apiKey,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        });
        
        if (!tokenRes.ok) {
        throw new Error(`Failed to get stream token: ${tokenRes.status}`);
        }
        
        const tokenData = await tokenRes.json() as any;
        
        if (!tokenData.streamAccess || !tokenData.streamAccess.token) {
        throw new Error(`Invalid stream access response`);
        }
        
        metrics.timing('token_fetch_ms', Date.now() - start);
        return {
        token: tokenData.streamAccess.token,
        endpoint: `${baseUrl}${tokenData.streamAccess.endpoint}`,
        expiresIn: tokenData.streamAccess.expiresIn,
        fetchedAt: Date.now()
        };
    } catch (error) {
        metrics.increment('token_fetch_errors');
        throw error;
    }
  }

  private async ensureToken(): Promise<StreamAccess> {
    if (!this.streamAccess || (Date.now() - this.streamAccess.fetchedAt) > 270000) { // 4.5 minutes
      this.streamAccess = await this.getStreamToken();
    }
    return this.streamAccess;
  }

  async fetchChunk(cursor: string | null): Promise<EventBatch> {
    const start = Date.now();
    try {
        const access = await this.ensureToken();
        
        const url = new URL(access.endpoint);
        url.searchParams.set('limit', config.batchSize.toString());
        if (cursor) url.searchParams.set('cursor', cursor);

        const res = await fetch(url.toString(), {
        headers: {
            'X-API-Key': config.apiKey,
            'X-Stream-Token': access.token
        }
        });

        metrics.increment('batches_fetched');

        if (res.status === 403 || res.status === 401) {
            logger.warn('Token expired or invalid, refreshing...');
            this.streamAccess = await this.getStreamToken();
            return this.fetchChunk(cursor);
        }

        if (res.status === 400) {
            const errorText = await res.text();
            if (errorText.includes('CURSOR_EXPIRED') || errorText.includes('CURSOR_INVALID')) {
                logger.warn('Cursor expired or invalid, resetting stream', { error: errorText });
                metrics.increment('cursor_resets');
                return this.fetchChunk(null);
            }
            throw new Error(`HTTP 400: ${errorText}`);
        }

        if (res.status === 429) {
            logger.warn('Rate limited (429), waiting...');
            metrics.increment('retries_429');
            await new Promise(r => setTimeout(r, config.retryDelayMs * 5)); 
            return this.fetchChunk(cursor);
        }

        if (res.status >= 500) {
            logger.error(`Server error ${res.status}, retrying...`);
            metrics.increment('retries_5xx');
            await new Promise(r => setTimeout(r, config.retryDelayMs * 5));
            return this.fetchChunk(cursor);
        }

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await res.json() as any;
        metrics.timing('fetch_latency_ms', Date.now() - start);
        
        return {
            events: data.data || [],
            cursor: data.nextCursor || data.cursor || null,
            hasMore: data.hasMore ?? true
        };

    } catch (error) {
        metrics.increment('fetch_errors');
        throw error;
    }
  }

  async *consume(startCursor: string | null): AsyncGenerator<EventBatch> {
    let cursor = startCursor;
    while (true) {
      const batch = await this.fetchChunk(cursor);
      yield batch;
      
      if (!batch.hasMore && !batch.cursor) {
        break;
      }
      cursor = batch.cursor;
    }
  }
}
