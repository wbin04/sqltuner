# ROLE
You are a Senior Fullstack Engineer (Python FastAPI + React TypeScript).
You are tasked with refining the **SQLTuner** application to support advanced Schema Inspection, Persistent Optimization History, and Multi-statement Execution.

# CURRENT STATE
1.  **SchemaViewer:** Only shows Columns/Keys, missing Database Indexes.
2.  **Optimization:** Currently transient. Users want to save `explain` and `optimize` results to the database to review later without calling the LLM again.
3.  **Simulation Workflow:** Currently, applying an optimization just sends a text prompt. The goal is to **directly execute** the suggested script (Index creation + Query) in the Sandbox.

# GOAL
Implement the following 4 features/refactors:

---

## PART 1: ENHANCED SCHEMA INSPECTION (Indexes)

### 1. Update Backend Models (`backend/app/schemas/schema_def.py`)
Add `IndexDef` to the Pydantic models.
```python
class IndexDef(BaseModel):
    name: str
    column_names: List[str]
    unique: bool = False

class TableDef(BaseModel):
    # ... existing fields ...
    indexes: List[IndexDef] = [] # New field
```

### 2. Update Inspector Service (`backend/app/services/inspector_service.py`)
In `sync_schema`, use SQLAlchemy's `inspector.get_indexes(table_name)` to populate the `indexes` list for each table.

### 3. Update Frontend `SchemaViewer.tsx`
Render the indexes in the UI. Add a collapsible section "Indexes" under each table, showing an icon (key/tag), index name, and columns covered.

---

## PART 2: PERSISTENT HISTORY & OPTIMIZATION LOGGING

### 1. Database Schema Update (Migration)
We need to distinguish between standard "Chat" logs and System "Action" logs.
- **Action:** Update `query_logs` table.
- **Add Column:** `action_type VARCHAR(50) DEFAULT 'chat'` (Enum values: `chat`, `explain`, `optimize`).
- **Logic:**
  - `chat`: Standard user-LLM conversation.
  - `explain`: User requested an EXPLAIN plan.
  - `optimize`: User requested AI optimization.

### 2. Refactor `OptimizationService` (`backend/app/services/optimization_service.py`)
Instead of just returning the analysis, **SAVE** it to the DB first.
- **Step 1:** Create a `query_log` entry with `action_type='optimize'` and `content=original_sql`.
- **Step 2:** Perform the AI Analysis.
- **Step 3:** Save the result into `performance_analysis` table, linked to the `query_log_id`.
- **Step 4:** Return the full object (Log + Analysis) to the Frontend.

### 3. Update History API
Ensure `GET /api/v1/history` returns the `action_type` so the Frontend knows how to render the item (Chat Bubble vs Optimization Card).

---

## PART 3: MULTI-STATEMENT EXECUTION (The "Batch" Logic)

To support the "Apply Index & Run" workflow in Simulation (SQLite Sandbox), the backend must support executing a script containing multiple statements (e.g., `CREATE INDEX...; SELECT...;`).

### 1. Update `ExecutionService` (`backend/app/services/execution_service.py`)
Refactor `execute_simulation` (and Real DB logic) to handle multiple statements.

**Logic Requirement:**
1.  Accept `sql_query` containing multiple statements separated by `;`.
2.  **Split** the string (use `sqlparse` or robust splitting).
3.  **Iterate & Execute:**
    ```python
    # Pseudo-code
    results = []
    with engine.connect() as conn:
        for stmt in split_sql(sql_query):
            res = conn.execute(text(stmt))
            if res.returns_rows:
                 results = fetch_rows(res) # Keep the result of the SELECT statement
    return results # Return the data from the final SELECT
    ```
4.  This allows the Sandbox to Create the Index and run the Select in the **same temporary session**.

---

## PART 4: "USE OPTIMIZATION" WORKFLOW (Frontend)

### 1. Update `OptimizationModal.tsx`
Change the behavior of the "Use Optimization" / "Apply Fix" button.
- **Current Behavior:** Sends a chat prompt (Bad).
- **New Behavior:**
  1.  Construct a **Combined Script**:
      ```typescript
      const script = `${analysis.index_recommendation};\n\n${analysis.optimized_sql};`;
      ```
  2.  **Update Editor:** Set the Monaco Editor value to this `script`.
  3.  **Auto-Run (Optional):** Automatically trigger the `handleRunQuery(script)` function.
  4.  **Close Modal.**

### 2. Update `SqlBlock` Component
Ensure the `Run` button and `handleRunQuery` logic can pass this multi-line script to the backend `POST /execute` endpoint without validation errors.

---

# DELIVERABLES
Please generate code for:
1.  `backend/app/schemas/schema_def.py` & `backend/app/services/inspector_service.py` (Indexes).
2.  `backend/app/services/execution_service.py` (Multi-statement logic).
3.  `backend/app/services/optimization_service.py` (Persistence logic).
4.  `src/components/editor/SchemaViewer.tsx` (UI Update).
5.  `src/components/editor/OptimizationModal.tsx` (New "Apply" logic).

# CONSTRAINTS
- Use `sqlparse` library in Python for robust statement splitting.
- Ensure strict error handling: if the `CREATE INDEX` fails in the script, stop execution and return the error.
- For `SchemaViewer`, make the UI compact (Indexes are secondary info).