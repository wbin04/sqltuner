# VAI TRÒ
Bạn là Senior Fullstack Engineer (Python FastAPI + React TypeScript).
Bạn được giao nhiệm vụ tinh chỉnh ứng dụng **SQLTuner** để hỗ trợ advanced Schema Inspection, Persistent Optimization History, và Multi-statement Execution.

# TRẠNG THÁI HIỆN TẠI
1.  **SchemaViewer:** Chỉ hiển thị Columns/Keys, thiếu Database Indexes.
2.  **Optimization:** Hiện tại transient. Người dùng muốn lưu kết quả `explain` và `optimize` vào database để review sau mà không gọi LLM lại.
3.  **Simulation Workflow:** Hiện tại, applying optimization chỉ gửi text prompt. Mục tiêu là **directly execute** suggested script (Index creation + Query) trong Sandbox.

# MỤC TIÊU
Triển khai 4 features/refactors sau:

---

## PHẦN 1: ENHANCED SCHEMA INSPECTION (Indexes)

### 1. Update Backend Models (`backend/app/schemas/schema_def.py`)
Thêm `IndexDef` vào Pydantic models.
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
Trong `sync_schema`, sử dụng SQLAlchemy's `inspector.get_indexes(table_name)` để populate `indexes` list cho mỗi table.

### 3. Update Frontend `SchemaViewer.tsx`
Render indexes trong UI. Thêm collapsible section "Indexes" dưới mỗi table, hiển thị icon (key/tag), index name, và columns covered.

---

## PHẦN 2: PERSISTENT HISTORY & OPTIMIZATION LOGGING

### 1. Database Schema Update (Migration)
Chúng ta cần phân biệt giữa standard "Chat" logs và System "Action" logs.
- **Action:** Update `query_logs` table.
- **Add Column:** `action_type VARCHAR(50) DEFAULT 'chat'` (Enum values: `chat`, `explain`, `optimize`).
- **Logic:**
  - `chat`: Standard user-LLM conversation.
  - `explain`: User requested EXPLAIN plan.
  - `optimize`: User requested AI optimization.

### 2. Refactor `OptimizationService` (`backend/app/services/optimization_service.py`)
Thay vì chỉ return analysis, **SAVE** nó vào DB trước.
- **Step 1:** Tạo `query_log` entry với `action_type='optimize'` và `content=original_sql`.
- **Step 2:** Perform AI Analysis.
- **Step 3:** Save result vào `performance_analysis` table, linked đến `query_log_id`.
- **Step 4:** Return full object (Log + Analysis) đến Frontend.

### 3. Update History API
Đảm bảo `GET /api/v1/history` returns `action_type` để Frontend biết cách render item (Chat Bubble vs Optimization Card).

---

## PHẦN 3: MULTI-STATEMENT EXECUTION (The "Batch" Logic)

Để hỗ trợ "Apply Index & Run" workflow trong Simulation (SQLite Sandbox), backend phải support executing script chứa multiple statements (ví dụ: `CREATE INDEX...; SELECT...;`).

### 1. Update `ExecutionService` (`backend/app/services/execution_service.py`)
Refactor `execute_simulation` (và Real DB logic) để handle multiple statements.

**Logic Requirement:**
1.  Accept `sql_query` chứa multiple statements separated bởi `;`.
2.  **Split** string (sử dụng `sqlparse` hoặc robust splitting).
3.  **Iterate & Execute:**
    ```python
    # Pseudo-code
    results = []
    with engine.connect() as conn:
        for stmt in split_sql(sql_query):
            res = conn.execute(text(stmt))
            if res.returns_rows:
                 results = fetch_rows(res) # Keep result của SELECT statement
    return results # Return data từ final SELECT
    ```
4.  Điều này cho phép Sandbox Create Index và run Select trong **same temporary session**.

---

## PHẦN 4: "USE OPTIMIZATION" WORKFLOW (Frontend)

### 1. Update `OptimizationModal.tsx`
Thay đổi behavior của "Use Optimization" / "Apply Fix" button.
- **Current Behavior:** Gửi chat prompt (Bad).
- **New Behavior:**
  1.  Construct **Combined Script**:
      ```typescript
      const script = `${analysis.index_recommendation};\n\n${analysis.optimized_sql};`;
      ```
  2.  **Update Editor:** Set Monaco Editor value thành `script`.
  3.  **Auto-Run (Optional):** Automatically trigger `handleRunQuery(script)` function.
  4.  **Close Modal.**

### 2. Update `SqlBlock` Component
Đảm bảo `Run` button và `handleRunQuery` logic có thể pass multi-line script đến backend `POST /execute` endpoint mà không validation errors.

---

# ĐẦU RA
Vui lòng tạo code cho:
1.  `backend/app/schemas/schema_def.py` & `backend/app/services/inspector_service.py` (Indexes).
2.  `backend/app/services/execution_service.py` (Multi-statement logic).
3.  `backend/app/services/optimization_service.py` (Persistence logic).
4.  `src/components/editor/SchemaViewer.tsx` (UI Update).
5.  `src/components/editor/OptimizationModal.tsx` (New "Apply" logic).

# RÀNG BUỘC
- Sử dụng `sqlparse` library trong Python cho robust statement splitting.
- Đảm bảo strict error handling: nếu `CREATE INDEX` fails trong script, stop execution và return error.
- Cho `SchemaViewer`, làm UI compact (Indexes là secondary info).