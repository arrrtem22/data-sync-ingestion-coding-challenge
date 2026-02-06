#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./submit.sh <github-repo-url>"
  echo "Example: ./submit.sh https://github.com/username/repo"
  exit 1
fi

GITHUB_REPO="$1"

# Check if event_ids.txt exists
if [ ! -f "event_ids.txt" ]; then
  echo "Error: event_ids.txt not found"
  echo "Run: docker exec assignment-ingestion npm run export-ids"
  echo "Then: docker cp assignment-ingestion:/app/event_ids.txt ."
  exit 1
fi

# Read API key from .env
if [ ! -f ".env" ]; then
  echo "Error: .env file not found"
  exit 1
fi

API_KEY=$(grep TARGET_API_KEY .env | cut -d '=' -f2)

if [ -z "$API_KEY" ]; then
  echo "Error: TARGET_API_KEY not found in .env"
  exit 1
fi

echo "Submitting results to DataSync API..."
echo "GitHub Repo: $GITHUB_REPO"
echo "Event count: $(wc -l < event_ids.txt | tr -d ' ')"

curl -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: text/plain" \
  --data-binary @event_ids.txt \
  "http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions?github_repo=$GITHUB_REPO"

echo ""
echo "Submission complete!"
