# ROLE
You are a Senior DevOps Engineer & System Architect. Your task is to generate a fully automated, production-ready Docker infrastructure for the "SQLTuner" project (Neuro-Symbolic SQL Optimization Tool).

# PROJECT CONTEXT
- **Architecture:** Monorepo structure with separated infrastructure code.
- **Tech Stack:** Python 3.10 (FastAPI), PostgreSQL 17.
- **Critical Requirement:** The Backend Dockerfile is located in a subdirectory (`docker/backend/`) but MUST be built using the **Project Root** as the context to access the `backend/` source code.

# DIRECTORY STRUCTURE
(The agent must generate files matching this exact structure)
root/
├── .env                  # Environment variables
├── docker-compose.yml    # Orchestration
├── backend/              # Source code (already exists, do not generate content, just reference)
│   ├── app/
│   └── requirements.txt
└── docker/               # Infrastructure Code (YOU GENERATE THIS)
    ├── db/
    │   ├── Dockerfile    # Custom PG image with extensions
    │   └── init.sql      # Enable extensions script
    └── backend/
        ├── Dockerfile    # FastAPI container
        └── start.sh      # Entrypoint script

# DELIVERABLES & REQUIREMENTS

Please generate the content for the following 5 files. Use code blocks for each.

## 1. `docker/db/Dockerfile`
- **Base Image:** `pgvector/pgvector:pg17` (Official image with vector support).
- **Goal:** Install `hypopg` (Hypothetical Indexes) from source.
- **Steps:**
  1. Install build deps: `git`, `make`, `gcc`, `postgresql-server-dev-16`.
  2. Clone `https://github.com/hypopg/hypopg`.
  3. Build and install (`make && make install`).
  4. Copy `init.sql` to `/docker-entrypoint-initdb.d/`.

## 2. `docker/db/init.sql`
- Write the SQL commands to enable the required extensions inside the DB container:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS hypopg;
  ```

## 3. `docker/backend/Dockerfile`
- **Base Image:** `python:3.10-slim`.
- **Build Context Assumption:** The build command will be run from `root/` (e.g., `docker build -f docker/backend/Dockerfile .`).
- **Steps:**
  1. Install system deps: `libpq-dev`, `gcc`, `curl` (for healthchecks), `netcat-openbsd` (for waiting DB).
  2. Set `WORKDIR /app`.
  3. **Crucial:** Copy `backend/requirements.txt` to `/app/` (Note the path: source is `backend/requirements.txt`).
  4. Install Python dependencies (no cache).
  5. Copy the entire `backend/` directory to `/app/backend`.
  6. Copy `docker/backend/start.sh` to `/app/start.sh` and make it executable (`chmod +x`).
  7. Set `PYTHONPATH` to `/app`.
  8. Set `ENTRYPOINT` to `./start.sh`.

## 4. `docker/backend/start.sh`
- Write a bash script that:
  1. Checks if the variable `Reload` is true.
  2. (Optional but recommended) Waits for Postgres port 5432 to be open (using `nc` or a sleep loop).
  3. Runs database migrations: `alembic upgrade head` (fail safe: `|| echo "Migration failed or not configured"`).
  4. Starts Uvicorn:
     - If `DEV_MODE=true`: Run with `--reload` and host `0.0.0.0`.
     - Else: Run standard production start.

## 5. `docker-compose.yml`
- Define 2 services: `db` and `backend`.
- **Service: db**
  - Build context: `./docker/db`.
  - Load env file: `.env`.
  - Ports: `5432:5432`.
  - Volumes: `postgres_data:/var/lib/postgresql/data`.
  - **Healthcheck:** Add a `pg_isready` check to ensure DB is up.
- **Service: backend**
  - **Build Context:** `.` (Current directory/Root) <--- CRITICAL.
  - **Dockerfile:** `./docker/backend/Dockerfile`.
  - Load env file: `.env`.
  - Volumes: `./backend:/app/backend` (For Hot Reloading).
  - Ports: `8000:8000`.
  - Depends on: `db` (condition: `service_healthy`).
  - Environment: `DEV_MODE=true`.
- **Networks:** Define a custom bridge network `sqltuner_net`.
- **Volumes:** Define `postgres_data`.

## 6. `.env.example`
- Provide a template for necessary variables:
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
  - `DATABASE_URL` (Connection string format).

# CONSTRAINTS
- Ensure `start.sh` has Unix line endings (LF).
- Ensure Dockerfile `COPY` commands respect the relative paths from the Project Root.