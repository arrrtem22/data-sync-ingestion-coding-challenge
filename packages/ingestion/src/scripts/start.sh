#!/bin/sh
set -e

echo "Building..."
npm run build

echo "Starting Ingestion..."
node dist/index.js

echo "Loading data to Postgres..."
export PGPASSWORD=postgres

# DATABASE_URL is postgresql://postgres:postgres@postgres:5432/ingestion
# psql can handle the URL directly

psql "$DATABASE_URL" <<EOF
CREATE UNLOGGED TABLE IF NOT EXISTS ingested_events (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);
CREATE TEMP TABLE temp_load (id TEXT, data JSONB);
\COPY temp_load FROM '/data/events_buffer.tsv';
INSERT INTO ingested_events (id, data) 
SELECT id, data FROM temp_load 
ON CONFLICT (id) DO NOTHING;
DROP TABLE temp_load;
EOF

echo "Ingestion Complete!"
