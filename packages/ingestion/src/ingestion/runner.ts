import { DataSyncClient } from '../api/datasync.client';
import { CheckpointsRepository } from '../db/repositories/checkpoints.repo';
import { EventsRepository } from '../db/repositories/events.repo';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { refreshCursor } from '../utils/cursor';
import { IngestedEvent } from '../models/event';
import { pool } from '../db/connection';

const SERVICE_ID = 'main_ingestion_loop';

export class IngestionRunner {
  private client: DataSyncClient;
  private checkpointsRepo: CheckpointsRepository;
  private eventsRepo: EventsRepository;

  constructor() {
    this.client = new DataSyncClient();
    this.checkpointsRepo = new CheckpointsRepository();
    this.eventsRepo = new EventsRepository();
  }

  async run() {
    logger.info('Starting ingestion...');
    
    // Resume
    let cursor = await this.checkpointsRepo.getCheckpoint(SERVICE_ID);
    if (cursor) {
      logger.info('Resuming from checkpoint found in DB.');
      // Refresh cursor to avoid expiration
      cursor = refreshCursor(cursor);
    } else {
      logger.info('No checkpoint found. Starting from scratch.');
    }

    let totalIngested = 0;

    while (true) {
      const startTime = Date.now();
      
      try {
        // Always refresh cursor to prevent expiration during retries or delays
        const activeCursor = cursor ? refreshCursor(cursor) : undefined;
        const result = await this.client.getEvents(env.BATCH_SIZE, activeCursor);
        
        // FIX: 1. Terminate on empty page or less than requested batch size
        // If we get fewer items than requested, this is implicitly the last page (or empty)
        if (result.events.length === 0) {
          logger.info('Received 0 events. Ingestion complete.');
          break;
        }

        const eventsToSave: IngestedEvent[] = result.events.map(e => ({
          id: e.id,
          user_id: e.userId,
          session_id: e.sessionId,
          type: e.type,
          name: e.name,
          properties: e.properties,
          timestamp: e.timestamp
        }));

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          await this.eventsRepo.saveBatch(eventsToSave, client);
          
          totalIngested += eventsToSave.length;
          
          // FIX: 2. Cursor advancement safety
          if (result.nextCursor) {
            cursor = result.nextCursor;
            // We save the cursor we just got. It is fresh.
            await this.checkpointsRepo.saveCheckpoint(SERVICE_ID, cursor, eventsToSave.length, client);
          } else {
            // FIX: 3. Terminate if no cursor provided (prevent infinite loop on same page)
            logger.info('Received events but no nextCursor. Ingestion complete.');
            await client.query('COMMIT');
            break;
          }

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }

        logger.info(`Ingested ${eventsToSave.length} events. Total this run: ${totalIngested}.`);

        // Terminate if we received fewer events than the batch size (implicit end of stream)
        if (result.events.length < env.BATCH_SIZE) {
            logger.info(`Received partial batch (${result.events.length} < ${env.BATCH_SIZE}). Ingestion complete.`);
            break;
        }

        // Rate Limit Handling
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, env.RATE_LIMIT_DELAY_MS - elapsed);
        if (delay > 0) {
          logger.info(`Waiting ${delay}ms for rate limit...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        if (error.response?.status === 429) {
          const resetHeader = error.response.headers['x-ratelimit-reset'];
          const resetSec = resetHeader ? parseInt(resetHeader, 10) : 60;
          logger.warn(`Rate limited! Waiting ${resetSec} seconds (plus buffer)...`);
          await new Promise(resolve => setTimeout(resolve, (resetSec + 2) * 1000));
          continue; // Retry same iteration
        }
        
        logger.error('Error in ingestion loop:', error);
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    logger.info('ingestion complete'); // Exact string required by run-ingestion.sh
  }
}
