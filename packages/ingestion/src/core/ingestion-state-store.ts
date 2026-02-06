import { existsSync, readFileSync, writeFileSync } from 'fs';
import { config } from './config.js';
import { logger } from './logger.js';

export interface Checkpoint {
  cursor: string | null;
  updatedAt: string;
}

export class IngestionStateStore {
  load(): Checkpoint | null {
    if (!existsSync(config.checkpointFile)) {
      return null;
    }
    try {
      const content = readFileSync(config.checkpointFile, 'utf-8');
      // Handle legacy plain text cursor if needed, or assume fresh start for new format
      // To be safe, try JSON parse, if fail, assume it's legacy text
      try {
        return JSON.parse(content);
      } catch {
        // Legacy fallback: treat whole file content as cursor
        const legacyCursor = content.trim();
        if (legacyCursor) {
            logger.info('Detected legacy cursor file, upgrading to JSON format');
            return { cursor: legacyCursor, updatedAt: new Date().toISOString() };
        }
        return null;
      }
    } catch (e) {
      logger.warn('Failed to load checkpoint file', { error: e });
      return null;
    }
  }

  save(cursor: string) {
    const checkpoint: Checkpoint = {
      cursor,
      updatedAt: new Date().toISOString()
    };
    try {
        writeFileSync(config.checkpointFile, JSON.stringify(checkpoint));
    } catch (e) {
        logger.error('Failed to save checkpoint', { error: e });
    }
  }
}
