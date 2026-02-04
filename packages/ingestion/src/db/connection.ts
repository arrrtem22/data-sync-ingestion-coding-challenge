import { Pool } from 'pg';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const runMigrations = async () => {
  const migrationFile = path.join(__dirname, 'migrations', '001_initial_schema.sql');
  // Adjust path if needed depending on where this is called from vs compiled output
  // Actually, standard way is to read file content
  const sql = fs.readFileSync(path.resolve(__dirname, 'migrations/001_initial_schema.sql'), 'utf8');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migrations applied successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed', err);
    throw err;
  } finally {
    client.release();
  }
};

export const closeDb = async () => {
  await pool.end();
};
