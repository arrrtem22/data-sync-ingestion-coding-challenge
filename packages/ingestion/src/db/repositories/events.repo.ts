import { pool } from '../connection';
import { IngestedEvent } from '../../models/event';

export class EventsRepository {
  async saveBatch(events: IngestedEvent[]): Promise<void> {
    if (events.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const values: any[] = [];
      const placeholders: string[] = [];
      
      events.forEach((event, index) => {
        const offset = index * 7;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
        values.push(
          event.id,
          event.user_id,
          event.session_id,
          event.type,
          event.name,
          JSON.stringify(event.properties),
          event.timestamp
        );
      });

      const query = `
        INSERT INTO ingested_events (id, user_id, session_id, type, name, properties, timestamp)
        VALUES ${placeholders.join(',')}
        ON CONFLICT (id) DO NOTHING
      `;

      await client.query(query, values);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
