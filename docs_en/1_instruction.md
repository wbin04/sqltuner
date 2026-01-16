# ROLE
You are a Senior Full-stack Architect & DevOps Engineer. Your task is to guide the setup of the development environment for the "Smart SQL Assistant & Performance Tuner" project (FastAPI + React + PostgreSQL).

# PROJECT CONTEXT
- **Goal:** Build a tool to support SQL optimization using RAG and LLM (Gemini/SQLCoder).
- **Status:** Currently in MVP stage, need rapid development.
- **Special Requirements:** Developer wants to prioritize running **Local Native** (no Docker) for faster debugging initially, but still wants to keep **Docker** configuration for reference or later deployment.

# OUTPUT REQUIREMENTS
Write detailed technical documentation, divided into 2 distinct parts:

## PART 1: LOCAL ENVIRONMENT SETUP (Priority to execute first)
Step-by-step guide to run the project directly on the machine (Bare Metal):

1.  **Database (PostgreSQL Local):**
    - Guide to install PostgreSQL 15/16.
    - Guide to install `pgvector` and `hypopg` extensions on Local environment (Note: Warn about differences between Linux/macOS and Windows installation. If Windows is too difficult to install `hypopg`, suggest alternatives like WSL2).
    - Provide SQL script `init_db_local.sql` to manually create tables and extensions.

2.  **Backend (FastAPI Local):**
    - List minimal `requirements.txt` file (needs: `fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `google-generativeai`, `psycopg2-binary`, `pgvector`).
    - Command to run server with reload mode: `uvicorn app:app --reload`.

3.  **Frontend (React Local):**
    - Guide to initialize Vite + TypeScript.
    - Configure `.env.local` file to point to localhost API Backend.

## PART 2: DOCKER ENVIRONMENT SETUP (For later/Reference)
Write ready configurations for when environment standardization is needed:
- `Dockerfile` for Backend.
- `docker-compose.yml`:
    - DB Service: Use `postgres:16` image and auto-install extensions via script.
    - Backend & Frontend Services.

## PART 3: FIRST TEST FLOW (Hello World)
Test scenario to ensure everything is connected in Local environment:
1.  Create a sample `products` table in Local DB.
2.  Backend creates API `/api/test-db` to query that table.
3.  Frontend calls API and displays results.

---
Present clearly, separate command blocks (Code blocks) for Terminal, SQL, and Python.