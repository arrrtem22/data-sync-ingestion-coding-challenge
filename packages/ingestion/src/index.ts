import { IngestionRunner } from './ingestion/runner';
import { runMigrations, closeDb } from './db/connection';
import { logger } from './utils/logger';

async function main() {
  try {
    logger.info('Starting Ingestion Service...');
    await runMigrations();
    
    const runner = new IngestionRunner();
    await runner.run();
    
  } catch (err) {
    logger.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
