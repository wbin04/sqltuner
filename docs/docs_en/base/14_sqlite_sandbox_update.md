# ROLE
You are a Senior Backend Engineer.
The user wants to improve the **Schema Sync** and **Execution Logic**.
Current issues:
1.  Sync only fetches the first 5 rows, which is not representative for large tables. Fetching ALL rows (10k+) into JSON is not feasible for performance.
2.  Execution on "Real Database Workspaces" is incorrectly using the "SQLite Simulation" path (returning 0 rows if not synced), instead of querying the live DB directly.

# TASK
Refactor `InspectorService` for better sampling and `ExecutionService` for correct routing.

# REQUIREMENTS

## 1. Refactor `InspectorService.sync_schema`
**File:** `backend/app/services/inspector_service.py`

Update the logic to accept a `sample_size` parameter (Default: 50, Max: 500).
Instead of `SELECT * FROM table LIMIT 5`, use a randomization strategy to get diverse data.

**Logic:**
- **PostgreSQL:** Use `SELECT * FROM {table} ORDER BY RANDOM() LIMIT {sample_size}`.
- **MySQL:** Use `SELECT * FROM {table} ORDER BY RAND() LIMIT {sample_size}`.
- **Safety:** Hard cap `sample_size` at 500 to prevent JSON bloating/OOM errors.
- **Serialization:** Ensure all fetched rows are strictly converted to JSON-safe formats (Stringify UUIDs, Dates, Decimals).

## 2. Refactor `ExecutionService.execute_sql`
**File:** `backend/app/services/execution_service.py`

Implement a **Strict Routing Mechanism**:

### Path A: LIVE EXECUTION (The "Real" Path)
**Condition:** If `db_connection.db_type` is IN `['postgres', 'mysql']`.
**Action:**
1.  Construct the SQLAlchemy Connection String using credentials from `db_connection`.
2.  Create a **Direct Connection** to the external database.
3.  Execute the query `text(sql)`.
4.  **Benefit:** This accesses ALL 10,000+ rows in the real DB, regardless of what is stored in `meta_schema`.

### Path B: SANDBOX EXECUTION (The "Simulation" Path)
**Condition:** If `db_connection.db_type` == `'simulation'`.
**Action:**
1.  Use the **SQLite In-Memory** strategy (create engine -> hydrate schema from JSON -> seed data from JSON -> execute).
2.  **Benefit:** Safe playground for virtual schemas.

# DELIVERABLES
Generate code for:
1.  `backend/app/services/inspector_service.py` (Updated Sampling Logic).
2.  `backend/app/services/execution_service.py` (Updated Routing Logic).

# CONSTRAINTS
- Handle connection errors gracefully in Path A (e.g., if Real DB is offline, return a clear error, DO NOT fall back to Simulation silently).
- Ensure `pymysql` and `psycopg2` drivers are handled correctly in the connection string builder.