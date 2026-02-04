import { pool } from '../connection';

export class CheckpointsRepository {
  async getCheckpoint(serviceId: string): Promise<string | null> {
    const res = await pool.query(
      'SELECT cursor FROM ingestion_checkpoints WHERE service_id = $1',
      [serviceId]
    );
    return res.rows[0]?.cursor || null;
  }

  async saveCheckpoint(serviceId: string, cursor: string, batchCount: number): Promise<void> {
    await pool.query(
      `INSERT INTO ingestion_checkpoints (service_id, cursor, total_events_ingested)
       VALUES ($1, $2, $3)
       ON CONFLICT (service_id) DO UPDATE SET
         cursor = EXCLUDED.cursor,
         last_updated = NOW(),
         total_events_ingested = ingestion_checkpoints.total_events_ingested + EXCLUDED.total_events_ingested`,
      [serviceId, cursor, batchCount]
    );
  }
}
