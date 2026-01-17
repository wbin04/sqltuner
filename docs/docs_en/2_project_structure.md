# ROLE
You are a Senior Full-stack Developer specializing in Python (FastAPI) and React (TypeScript). Your task is to initialize the project structure (Project Scaffolding) for the "SQLTuner" application.

# CONTEXT & TECHNICAL REQUIREMENTS
1.  **Goal:** Build a system to support SQL optimization using Local LLM (Ollama). The system needs to handle load well, have clear code, and separate logic (Separation of Concerns).
2.  **Runtime Environment:** - Backend runs on Python venv local.
    - Frontend runs on Node.js local.
    - LLM Server: Ollama already running at `http://localhost:11434`.
3.  **Tech Stack:**
    - **Backend:** Python 3.10+, FastAPI, Uvicorn.
    - **Database ORM:** SQLAlchemy (Async), Alembic (Migration), Asyncpg (Driver).
    - **LLM Integration:** `httpx` (Async Client to call Ollama without blocking requests).
    - **Frontend:** React 18+, TypeScript, Vite, TailwindCSS, Shadcn/UI.

# DELIVERABLES

Perform the following 4 tasks in detail:

## TASK 1: Directory Structure
Draw a standard Monorepo directory tree. Detailed requirements in `/backend`:
- `app/core`: Config (env loading), Security, Constants.
- `app/api/v1/endpoints`: Contains routers (e.g.: `sql.py`, `db_inspector.py`).
- `app/db`: Contains `base.py` (SQLAlchemy Base), `session.py` (Async engine).
- `app/models`: Contains SQLAlchemy Classes (Mapping with DB tables).
- `app/schemas`: Contains Pydantic Classes (Request/Response validation).
- `app/services`:
    - `llm_service.py`: Logic to call Ollama.
    - `inspector_service.py`: Logic to read DB structure.
- `alembic/`: Automatic migration directory.

## TASK 2: Backend Setup (FastAPI)
1.  **Dependencies:** Create `backend/requirements.txt` including:
    `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `asyncpg`, `alembic`, `pydantic-settings`, `python-dotenv`, `httpx` (instead of requests).
2.  **Configuration:** - Create `backend/app/core/config.py` using `BaseSettings`.
    - Load variables: `API_V1_STR`, `PROJECT_NAME`, `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `OLLAMA_BASE_URL` (default: http://localhost:11434), `MODEL_NAME` (default: sqlcoder-thesis).
3.  **Environment:** Create sample `backend/.env.example`.
4.  **Main App:** Write `backend/app/main.py`:
    - Setup CORS (allow `http://localhost:5173`).
    - Include sample router.
    - Endpoint `/health` returns status and current model name in use.

## TASK 3: Frontend Setup (React + TS)
1.  **Initialization:** Guide commands to create Vite + React + TS.
2.  **Tailwind & UI:** Guide commands to install TailwindCSS and basic configuration.
3.  **API Client:** - Create file `frontend/src/lib/axios.ts`: Configure basic Axios Interceptor (handle common errors).
    - Get `VITE_API_URL` from `.env`.
4.  **Integration Test:** - Write component `App.tsx` using `useEffect` to call `/health`.
    - Display: "Backend Status: Online | Model: sqlcoder-thesis" (green if OK, red if error).

## TASK 4: Run Instructions
Write a concise `README.md` file containing commands:
1.  Backend: Create venv -> Install reqs -> Run migration (alembic upgrade head) -> Start server.
2.  Frontend: Install deps -> Dev server.