# VAI TRÒ
Bạn là Senior Backend Engineer chuyên về Database Performance Tuning (PostgreSQL/MySQL) và LLM Integration.
Nhiệm vụ của bạn là triển khai **SQL Optimization Service** (`backend/app/services/optimization_service.py`).

# MỤC TIÊU
Khi người dùng click "Optimize" trên SQL query, hệ thống phải:
1.  **Analyze:** Chạy `EXPLAIN` để hiểu tại sao query chậm.
2.  **Reason:** Sử dụng LLM để interpret Explain Plan và Table Schema.
3.  **Recommend:** Đề xuất rewritten query và optimal Indexes.

# YÊU CẦU

## 1. `OptimizationService` Class
**File:** `backend/app/services/optimization_service.py`

### Method: `analyze_query(connection_id: UUID, sql_query: str)`
**Workflow:**

1.  **Fetch Context:**
    - Lấy `db_connection` details.
    - Lấy `meta_schema` (để hiểu table sizes/indexes).

2.  **Get Execution Plan (Real DB Only):**
    - Nếu `db_type` là Postgres: Chạy `EXPLAIN (ANALYZE, FORMAT JSON) {sql_query}`.
    - Nếu `db_type` là MySQL: Chạy `EXPLAIN FORMAT=JSON {sql_query}`.
    - **Note:** Nếu `db_type` là Simulation, bỏ qua step này (AI sẽ analyze dựa trên static schema only).

3.  **LLM Analysis (The Brain):**
    - Tạo prompt bao gồm:
      - User's SQL.
      - JSON Explain Plan (identify `Seq Scan`, high cost nodes).
      - Table Schema (Columns, existing Indexes).
    - **Prompt Task:**
      > "Analyze the query plan. Identify bottlenecks (e.g., full table scans). Rewrite the SQL for better performance. Suggest specific CREATE INDEX commands if missing."

4.  **Save Results:**
    - Lưu analysis trong bảng `performance_analysis` (linked đến `query_log`).

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
- **Output:** JSON response ở trên.

# ĐẦU RA
Tạo code cho:
1.  `backend/app/services/optimization_service.py`.
2.  `backend/app/api/v1/endpoints/sql.py` (Update).

# RÀNG BUỘC
- Handle cases khi `EXPLAIN` thất bại (ví dụ: syntax error) bằng cách trả về raw error.
- Đảm bảo LLM output được parse strictly (JSON mode) để Frontend có thể render "Diff View".