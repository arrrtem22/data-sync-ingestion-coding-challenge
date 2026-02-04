import { IngestionRunner } from './ingestion/runner';
import { runMigrations, closeDb } from './db/connection';
import { logger } from './utils/logger';

async function main() {
  try {
    logger.info('Starting Ingestion Service...');
    await runMigrations();
    
    const runner = new IngestionRunner();
    await runner.run();
    
    logger.info('Ingestion finished. Holding process open.');
    await new Promise(() => {}); // Block forever
  } catch (err) {
    logger.error('Fatal error:', err);
    process.exit(1);
  }
  // Do not close DB in finally block to keep container alive
}

main();
