# ROLE
You are a Senior System Architect specializing in AI-driven Web Applications. Your task is to design the System Architecture for the "SQLTuner" project.

# PROJECT CONTEXT
- **Goal:** A 3-tier web application that helps developers optimize SQL queries using Local LLM (Ollama) or Cloud LLM (Gemini).
- **Core Functionality:** Connect to external databases (Target DB), extract schema, chat with AI to generate SQL, and analyze query performance (Explain Analyze).
- **Tech Stack:**
  - **Frontend:** React (Vite, TypeScript, TailwindCSS).
  - **Backend:** Python (FastAPI, SQLAlchemy, Pydantic).
  - **AI Engine:** Ollama (Local) running `sqlcoder-7b` via HTTP API.
  - **Database:** PostgreSQL (Internal App DB) & Various Target DBs (Postgres/MySQL).

# OUTPUT REQUIREMENTS

## PART 1: High-Level Architecture
1.  **Diagram:** Generate a Mermaid.js code block representing the **3-Tier Architecture**.
    - Clearly show: Client (Browser) <-> API Gateway (FastAPI) <-> Service Layer (Orchestrator/Tuner) <-> Data Layer.
    - Show external integration: Backend <-> Ollama API & Backend <-> Target Databases.
2.  **Component Breakdown:** Describe the responsibility of each key component:
    - **Connection Manager:** Handling secure DB connections.
    - **Schema Extractor:** Using SQLAlchemy Inspector.
    - **AI Orchestrator:** Prompt templating and context management.
    - **Tuner Engine:** Parsing `EXPLAIN (FORMAT JSON)` results.

## PART 2: Data Flow Description
Describe the step-by-step data flow for the **"Performance Tuning"** scenario:
1.  User sends a slow SQL query from Frontend.
2.  Backend executes `EXPLAIN` on Target DB.
3.  Backend sends Schema + Query Plan to AI.
4.  AI generates recommendations.
5.  Backend saves result to Internal DB and returns to Frontend.

## PART 3: Tech Stack Justification
Explain why **FastAPI** (Async) and **PostgreSQL** (JSONB support) are critical for this specific architecture compared to Django or MongoDB.