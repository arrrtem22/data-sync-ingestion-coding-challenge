import { createWriteStream } from 'fs';
import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { metrics } from '../core/metrics.js';
import { IngestionStateStore } from '../core/ingestion-state-store.js';
import { ApiStreamReader } from './api-stream-reader.js';

export class IngestionJob {
  private stateStore: IngestionStateStore;
  private streamReader: ApiStreamReader;

  constructor() {
    this.stateStore = new IngestionStateStore();
    this.streamReader = new ApiStreamReader();
  }

  async run() {
    logger.info('Starting ingestion...', { 
        output: config.outputFile, 
        target: config.targetEventCount 
    });

    const checkpoint = this.stateStore.load();
    let currentCursor = checkpoint?.cursor || null;
    let totalIngested = 0;

    if (currentCursor) {
        logger.info('Resuming from checkpoint', { cursor: currentCursor.substring(0, 20) + '...' });
    }

    const stream = createWriteStream(config.outputFile, { flags: 'a', highWaterMark: 1024 * 1024 });

    try {
        while (totalIngested < config.targetEventCount) {
            try {
                 const generator = this.streamReader.consume(currentCursor);
                 
                 for await (const batch of generator) {
                     if (batch.events.length === 0) continue;

                     const lines = batch.events.map(e => `${e.id}\t${JSON.stringify(e)}\n`).join('');
                     
                     if (!stream.write(lines)) {
                         await new Promise<void>(resolve => stream.once('drain', resolve));
                     }

                     totalIngested += batch.events.length;
                     metrics.increment('events_ingested', batch.events.length);
                     
                     if (batch.cursor) {
                         currentCursor = batch.cursor;
                         this.stateStore.save(currentCursor);
                     }
                     
                     this.logProgress(totalIngested);

                     if (totalIngested >= config.targetEventCount) break;
                 }

                 if (totalIngested < config.targetEventCount) {
                     logger.info('Stream ended, waiting before resuming...');
                     await new Promise(r => setTimeout(r, 5000));
                 }

            } catch (err) {
                logger.error('Stream error', { error: err });
                logger.info('Waiting 5s before retrying...');
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    } finally {
        stream.end();
        logger.info('Ingestion complete', metrics.getSnapshot());
    }
  }

  private logProgress(total: number) {
      const snapshot = metrics.getSnapshot();
      logger.info('Progress', { total, ...snapshot });
  }
}
