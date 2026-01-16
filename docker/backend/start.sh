#!/bin/bash
set -e

echo "Waiting for database to be ready..."
until python -c "import psycopg2; psycopg2.connect(host='sqltuner-server', port=5432, user='postgres', password='123', dbname='sqltuner_db')" 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"
echo "Running database migrations..."
alembic upgrade head || echo "Migration failed or not configured yet"

echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
