# ROLE
You are a Senior DevOps Engineer & System Architect.
Your task is to expand the existing Docker infrastructure to include the **Frontend Service** (React + Vite).

# PROJECT CONTEXT
- **Architecture:** Monorepo.
- **Build Strategy:** All services must be built using the **Project Root** as the context.
- **Current Directory Structure:**
  root/
  ├── .env
  ├── docker-compose.yml    # Currently has 'database' and 'backend'
  ├── backend/              # Python FastAPI source
  ├── frontend/             # React + Vite source (Already exists)
  │   ├── package.json
  │   └── vite.config.ts
  └── docker/
      ├── database/         # Renamed from 'db'
      │   ├── Dockerfile
      │   └── init.sql
      ├── backend/
      │   ├── Dockerfile
      │   └── start.sh
      └── frontend/         # NEW DIRECTORY FOR THIS TASK
          └── Dockerfile    # YOU NEED TO GENERATE THIS

# DELIVERABLES

Please generate the content for the following 2 files using the specifications below.

## 1. `docker/frontend/Dockerfile`
- **Base Image:** `node:20-alpine`.
- **Build Context Assumption:** The build command will be run from `root/`.
- **Instructions:**
  1. Set `WORKDIR /app`.
  2. Copy `frontend/package.json` and `frontend/package-lock.json` to `./` (Leverage Docker cache).
  3. Run `npm install`.
  4. Copy the entire `frontend/` directory to `./`.
  5. Expose port `5173`.
  6. **CMD:** Run the dev server enabling host access: `npm run dev -- --host`.

## 2. `docker-compose.yml` (Update)
- Keep the existing `database` and `backend` services (ensure `database` points to `./docker/database`).
- **Add a new service: `frontend`**.
  - **Build Context:** `.` (Root).
  - **Dockerfile:** `./docker/frontend/Dockerfile`.
  - **Ports:** `5173:5173`.
  - **Volumes (Crucial for Hot Reload):**
    - Mount `./frontend` to `/app` (Sync code changes).
    - **Volume Trick:** Mount `/app/node_modules` as an anonymous volume to prevent host OS overriding container dependencies.
  - **Environment:**
    - `VITE_API_URL=http://localhost:8000/api/v1` (Browser-side access to Backend).
  - **Networks:** Connect to `sqltuner_net`.

# CONSTRAINTS
- Ensure correct relative paths since the Dockerfile is inside `docker/frontend/` but accesses `frontend/` source from Root.
- The `database` service definition in `docker-compose.yml` must match the new path `docker/database`.