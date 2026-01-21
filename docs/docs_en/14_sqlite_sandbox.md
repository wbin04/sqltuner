# ROLE
You are a Senior Python Backend Engineer specializing in SQLAlchemy and Database Internals.
Your task is to implement the **SQLite Sandbox Execution Engine** for the "Simulation Mode" of SQLTuner.

# CONTEXT
We need to execute user SQL queries against a "Virtual Schema" defined in JSON.
To ensure logic accuracy (WHERE clauses, JOINS), we will spin up an ephemeral **In-Memory SQLite Database** for each request.

# CHALLENGE: POSTGRES VS SQLITE
The user perceives the simulation as PostgreSQL (types like UUID, TIMESTAMPTZ, JSONB), but we are executing on SQLite.
We must dynamically convert the DDL (CREATE TABLE) to be SQLite-compatible.

# REQUIREMENTS

## 1. `backend/app/services/execution_service.py`

Create a class `SimulationExecutor` with the following methods:

### A. `_map_postgres_to_sqlite(pg_type: str) -> str`
Helper function to convert types.
- `UUID` -> `TEXT`
- `JSONB`, `JSON` -> `TEXT`
- `TIMESTAMPTZ`, `TIMESTAMP` -> `TEXT`
- `ARRAY(...)` -> `TEXT`
- `SERIAL`, `BIGSERIAL` -> `INTEGER`
- Default: Keep original (VARCHAR, INT, FLOAT usually work on both).

### B. `execute(meta_schema: Dict, sql_query: str) -> List[Dict]`
**Workflow:**
1.  **Init Engine:** `engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})`
2.  **Build Schema:**
    - Parse `meta_schema['tables']`.
    - Generate `CREATE TABLE` statements using the mapped types.
    - Execute DDL.
3.  **Seed Data:**
    - Parse `sample_data` from JSON.
    - Generate `INSERT INTO` statements.
    - **Crucial:** Handle JSON/UUID values in sample data by converting them to strings before inserting.
4.  **Run Query:**
    - Execute user's `sql_query`.
    - Fetch result using `.mappings().all()`.
    - Convert result rows to Dict.
5.  **Cleanup:** Dispose engine (handled automatically by Python context, but good to be explicit).

## 2. Error Handling
- If the user uses a Postgres-specific function (e.g., `gen_random_uuid()`) that SQLite doesn't have, catch the `OperationalError`.
- Return a friendly error: *"Simulation Mode runs on a lightweight engine. Some specific PostgreSQL functions may not be supported. Try standard SQL."*

# DELIVERABLES
Generate the complete code for `backend/app/services/execution_service.py`.