#!/bin/bash
set -e

# Extract DB connection details from DATABASE_URL or use defaults
DB_HOST="${DB_HOST:-sqltuner-server}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for database to be ready..."
# Wait for PostgreSQL to be ready using netcat
while ! nc -z "$DB_HOST" "$DB_PORT"; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"

# Change to backend directory for alembic
cd /app/backend

echo "Running database migrations..."
alembic upgrade head || echo "Migration failed or not configured yet"

# Return to app directory
cd /app

echo "Starting FastAPI application..."
# Check if DEV_MODE is enabled
if [ "${DEV_MODE}" = "true" ]; then
  echo "Running in development mode with auto-reload..."
  exec uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
else
  echo "Running in production mode..."
  exec uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
fi
