#!/bin/bash
set -e

echo "=============================================="
echo "DataSync Ingestion - Running Solution"
echo "=============================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "Error: .env file not found"
  echo "Please create .env file with your API key:"
  echo "  echo 'TARGET_API_KEY=your_key_here' > .env"
  exit 1
fi

# Check if API key is set
if ! grep -q "TARGET_API_KEY=" .env; then
  echo "Error: TARGET_API_KEY not found in .env"
  echo "Please add your API key to .env:"
  echo "  echo 'TARGET_API_KEY=your_key_here' >> .env"
  exit 1
fi

# Start the ingestion services
echo "Starting services..."
docker compose up -d --build

echo ""
echo "Waiting for services to initialize..."
sleep 10

# Monitor progress
echo ""
echo "Monitoring ingestion progress..."
echo "(Press Ctrl+C to stop monitoring)"
echo "=============================================="

while true; do
    COUNT=$(docker exec assignment-postgres psql -U postgres -d ingestion -t -c "SELECT COUNT(*) FROM ingested_events;" 2>/dev/null | tr -d ' ' || echo "0")
    
    # Check for fetch progress in logs
    FETCH_PROGRESS=$(docker logs --tail 1 assignment-ingestion 2>&1 | grep "Progress" | cut -c 1-120)
    if [ ! -z "$FETCH_PROGRESS" ]; then
       echo "[$(date '+%H:%M:%S')] $FETCH_PROGRESS"
    else
       CSV_COUNT=$(docker exec assignment-ingestion wc -l /data/events_buffer.tsv 2>/dev/null | awk '{print $1}' || echo "0")
       echo "[$(date '+%H:%M:%S')] Events in DB: $COUNT | Events in Buffer: $CSV_COUNT"
    fi

    if docker logs assignment-ingestion 2>&1 | grep -iq "ingestion complete"; then
        # Update count one last time
        COUNT=$(docker exec assignment-postgres psql -U postgres -d ingestion -t -c "SELECT COUNT(*) FROM ingested_events;" 2>/dev/null | tr -d ' ' || echo "0")
        echo ""
        echo "=============================================="
        echo "INGESTION COMPLETE!"
        echo "Total events: $COUNT"
        echo "=============================================="
        exit 0
    fi

    sleep 5
done
