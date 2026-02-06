# ROLE
You are a Senior Backend Engineer specializing in Database Performance Tuning (PostgreSQL/MySQL) and LLM Integration.
Your task is to implement the **SQL Optimization Service** (`backend/app/services/optimization_service.py`).

# GOAL
When a user clicks "Optimize" on a SQL query, the system must:
1.  **Analyze:** Run `EXPLAIN` to understand why the query is slow.
2.  **Reason:** Use LLM to interpret the Explain Plan and Table Schema.
3.  **Recommend:** Suggest a rewritten query and optimal Indexes.

# REQUIREMENTS

## 1. `OptimizationService` Class
**File:** `backend/app/services/optimization_service.py`

### Method: `analyze_query(connection_id: UUID, sql_query: str)`
**Workflow:**

1.  **Fetch Context:**
    - Get `db_connection` details.
    - Get `meta_schema` (to understand table sizes/indexes).

2.  **Get Execution Plan (Real DB Only):**
    - If `db_type` is Postgres: Run `EXPLAIN (ANALYZE, FORMAT JSON) {sql_query}`.
    - If `db_type` is MySQL: Run `EXPLAIN FORMAT=JSON {sql_query}`.
    - **Note:** If `db_type` is Simulation, skip this step (AI will analyze based on static schema only).

3.  **LLM Analysis (The Brain):**
    - Construct a prompt including:
      - The User's SQL.
      - The JSON Explain Plan (identify `Seq Scan`, high cost nodes).
      - The Table Schema (Columns, existing Indexes).
    - **Prompt Task:**
      > "Analyze the query plan. Identify bottlenecks (e.g., full table scans). Rewrite the SQL for better performance. Suggest specific CREATE INDEX commands if missing."

4.  **Save Results:**
    - Store the analysis in the `performance_analysis` table (linked to a `query_log`).

5.  **Return JSON:**
    ```json
    {
      "original_cost": 1200.5,
      "bottlenecks": ["Full Table Scan on 'users'", "Inefficient Join"],
      "optimized_sql": "SELECT ...",
      "index_recommendation": "CREATE INDEX idx_users_email ON users(email);",
      "explanation": "Adding an index on email avoids the sequential scan..."
    }
    ```

## 2. API Endpoint
**File:** `backend/app/api/v1/endpoints/sql.py`
- **POST** `/api/v1/sql/optimize`
- **Input:** `{ connection_id: UUID, sql: str }`
- **Output:** The JSON response above.

# DELIVERABLES
Generate code for:
1.  `backend/app/services/optimization_service.py`.
2.  `backend/app/api/v1/endpoints/sql.py` (Update).

# CONSTRAINTS
- Handle cases where `EXPLAIN` fails (e.g., syntax error) by returning the raw error.
- Ensure the LLM output is parsed strictly (JSON mode) so the Frontend can render the "Diff View".