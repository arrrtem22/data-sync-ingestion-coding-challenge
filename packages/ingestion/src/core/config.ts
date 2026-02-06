import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env before defining config
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const DATA_DIR = process.env.DATA_DIR || (process.env.NODE_ENV === 'test' ? '/tmp' : '/data');

export const config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1',
  apiKey: process.env.TARGET_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5434/ingestion',
  
  // Ingestion settings
  batchSize: parseInt(process.env.BATCH_SIZE || '5000', 10),
  targetEventCount: 3000000,
  
  // Retry settings
  maxRetries: 3,
  retryDelayMs: 1000,
  
  // File paths
  dataDir: DATA_DIR,
  checkpointFile: resolve(DATA_DIR, 'ingestion.state'),
  outputFile: resolve(DATA_DIR, 'events_buffer.tsv'),
};
