import { IngestionJob } from './ingestion-job.js';
import { logger } from '../core/logger.js';

export async function bootstrap() {
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    process.exit(0);
  });

  try {
    const job = new IngestionJob();
    await job.run();
  } catch (error) {
    logger.error('Fatal error during ingestion', { error });
    process.exit(1);
  }
}
