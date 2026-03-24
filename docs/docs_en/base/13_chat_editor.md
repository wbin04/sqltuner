# ROLE
You are a Senior Fullstack Engineer proficient in **FastAPI (Python)** and **React (TypeScript)**.
Your task is to implement the **End-to-End Logic** for the SQLTuner Editor, connecting the Backend APIs with the Frontend components (`SqlBlock`, `OptimizationModal`).

# CONTEXT
- **Frontend:**
  - `EditorPage` exists (Layout with Sidebar, Chat Area, Schema Panel).
  - `SqlBlock` component exists (has `onRun`, `onExplain`, `onOptimize` props).
  - `OptimizationModal` component exists (displays diff view and stats).
- **Backend:**
  - `db_connections` table stores `meta_schema` (JSONB).
  - Basic `LLMService` exists (for generic chat).

# GOAL
Implement the API Endpoints and Frontend Integration to support the following 4 workflows:
1.  **Chat:** User asks questions -> AI answers using DB Schema Context.
2.  **Execute:** User clicks "Run" -> Backend executes SQL (Real DB) or generates fake data (Simulation).
3.  **Explain:** User clicks "Explain" -> Backend runs `EXPLAIN (JSON)`.
4.  **Optimize:** User clicks "Optimize" -> AI analyzes and suggests improvements.

# REQUIREMENTS

## PART 1: BACKEND IMPLEMENTATION (FastAPI)

### 1. Chat Endpoint (`app/api/v1/endpoints/chat.py`)
- **POST** `/api/v1/chat/completion`
- **Input:** `{ connection_id: UUID, conversation_id: UUID, message: str }`
- **Logic:**
  1.  Fetch `meta_schema` from `db_connections` using `connection_id`.
  2.  Construct a **System Prompt** containing the Table/Column definitions (from `meta_schema`) to give the LLM context.
  3.  Call `LLMService` to generate a response.
  4.  Save the turn to `query_logs` table.
- **Output:** `{ role: "assistant", content: "Markdown response..." }`

### 2. SQL Execution Endpoint (`app/api/v1/endpoints/sql.py`)
- **POST** `/api/v1/sql/execute`
- **Input:** `{ connection_id: UUID, sql: str }`
- **Logic:**
  - **IF Real DB:** Create a synchronous connection (using SQLAlchemy `text`), execute the query, fetch results.
  - **IF Simulation:** Use `LLMService` to generate **Mock Data** (JSON) that matches the SQL structure.
- **Output:** `{ columns: List[str], rows: List[Dict], execution_time_ms: float }`

### 3. Optimization Endpoints (`app/api/v1/endpoints/sql.py`)
- **POST** `/api/v1/sql/explain`
  - **Logic:** Run `EXPLAIN (ANALYZE, FORMAT JSON) ...` on Real DB.
  - **Output:** `{ plan: JSON, total_cost: float, execution_time: float }`.
- **POST** `/api/v1/sql/optimize`
  - **Logic:**
    1.  Get `original_stats` (via Explain).
    2.  Ask LLM to rewrite SQL and suggest Indexes based on `meta_schema`.
    3.  (Optional) Run Explain on the new SQL to get `new_stats`.
  - **Output:**
    ```json
    {
       "original_sql": "...",
       "optimized_sql": "...",
       "explanation": "...",
       "index_recommendation": "CREATE INDEX...",
       "stats_comparison": { "old_cost": 100, "new_cost": 50 }
    }
    ```

## PART 2: FRONTEND INTEGRATION (React)

### 1. Services (`src/services/sqlService.ts`, `src/services/chatService.ts`)
- Implement Axios wrappers for the APIs above.
- Ensure strict typing for Requests/Responses.

### 2. `useEditorLogic` Hook (`src/hooks/useEditorLogic.ts`)
Create a unified hook to manage the complex state of the Editor:
- **State:** `messages` (Chat history), `isOptimizing` (boolean), `optimizationResult` (Object).
- **Functions:**
  - `handleSendMessage(text)`: Calls Chat API, appends response to `messages`.
  - `handleRunQuery(sql)`: Calls Execute API.
  - `handleOptimize(sql)`: Calls Optimize API, then opens the `OptimizationModal`.

### 3. Wiring Components (`src/pages/EditorPage.tsx` & `ChatArea.tsx`)
- Pass `handleRunQuery` to the `SqlBlock`'s `onRun` prop.
- Pass `handleOptimize` to the `SqlBlock`'s `onOptimize` prop.
- When `handleRunQuery` returns data, display a `<DataGrid />` immediately below the specific `SqlBlock`.
- When `handleOptimize` returns data, pass it to `<OptimizationModal />` and set `isOpen={true}`.

# DELIVERABLES
Please generate code for:
1.  `backend/app/api/v1/endpoints/chat.py`
2.  `backend/app/api/v1/endpoints/sql.py`
3.  `src/services/sqlService.ts`
4.  `src/hooks/useEditorLogic.ts`

# CONSTRAINTS
- Use `sqlalchemy` for DB interactions.
- Ensure error handling: If a query fails (syntax error), return a structured error message to be displayed in the UI, not a 500 Crash.
- For Simulation mode execution, the Mock Data generation should be simple (e.g., 5 rows of sample data).