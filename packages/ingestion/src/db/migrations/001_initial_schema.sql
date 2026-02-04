CREATE TABLE IF NOT EXISTS ingested_events (
    id UUID PRIMARY KEY,
    user_id UUID,
    session_id UUID,
    type VARCHAR(50),
    name VARCHAR(100),
    properties JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON ingested_events(timestamp);

CREATE TABLE IF NOT EXISTS ingestion_checkpoints (
    service_id VARCHAR(50) PRIMARY KEY,
    cursor TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    total_events_ingested BIGINT DEFAULT 0
);
