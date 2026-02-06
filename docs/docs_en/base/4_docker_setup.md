# Context
I am building "SQLTuner", a Neuro-Symbolic SQL Optimization tool.
Refactoring the project to a Production-Ready structure where infrastructure is separated from source code.
The new directory structure is:
- root/
  - backend/ (Contains Python source code: app/, requirements.txt)
  - docker/
    - db/
      - Dockerfile (Custom Postgres with 'hypopg', 'vector')
      - init.sql
    - backend/
      - Dockerfile (FastAPI setup)
      - start.sh (Entrypoint script)
  - docker-compose.yml
  - .env

# Task
Generate the configuration files for this modular structure.

# Requirements

1. **docker/database/Dockerfile**:
   - Base image: `pgvector/pgvector:pg17`.
   - Install build dependencies (git, make, gcc, postgresql-server-dev-16).
   - Clone and install `hypopg` from source.
   - Copy `init.sql` to `/docker-entrypoint-initdb.d/`.

2. **docker/backend/Dockerfile**:
   - Base image: `python:3.10-slim`.
   - **Crucial Build Context Logic**: Assume the build context is the PROJECT ROOT.
   - Install system deps (`libpq-dev`, `gcc`, `curl`).
   - Copy `backend/requirements.txt` to `/app/` and install dependencies (Layer Caching).
   - Copy `backend/` source code to `/app/`.
   - Copy `docker/backend/start.sh` to `/app/`, make it executable.
   - Set Entrypoint to `./start.sh`.

3. **docker/backend/start.sh**:
   - A shell script to run migrations (alembic) if needed, then start Uvicorn with reload enabled.

4. **docker-compose.yml** (in root):
   - **Service 'db'**:
     - Build context: `./docker/db` (Self-contained).
     - Environment from `.env`.
     - Ports: `5432:5432`.
     - Volume: `postgres_data:/var/lib/postgresql/data`.
   - **Service 'backend'**:
     - **Build Context**: `.` (The Root Directory) <--- VERY IMPORTANT so it can access 'backend/' folder.
     - **Dockerfile**: `./docker/backend/Dockerfile`.
     - Volumes:
       - `./backend:/app` (Hot Reload for Dev).
     - Ports: `8000:8000`.
     - Depends on `db`.
     - Network: `sqltuner_net`.

# Output
Provide the content for:
1. `docker/database/Dockerfile`
2. `docker/backend/Dockerfile`
3. `docker/backend/start.sh`
4. `docker-compose.yml`