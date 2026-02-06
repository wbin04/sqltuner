# VAI TRÒ
Bạn là Senior Python Backend Engineer chuyên về SQLAlchemy và Database Internals.
Nhiệm vụ của bạn là triển khai **SQLite Sandbox Execution Engine** cho "Simulation Mode" của SQLTuner.

# NGỮ CẢNH
Chúng ta cần thực thi user SQL queries đối với "Virtual Schema" được định nghĩa trong JSON.
Để đảm bảo logic accuracy (WHERE clauses, JOINS), chúng ta sẽ tạo ephemeral **In-Memory SQLite Database** cho mỗi request.

# THÁCH THỨC: POSTGRES VS SQLITE
Người dùng nhận thức simulation như PostgreSQL (types như UUID, TIMESTAMPTZ, JSONB), nhưng chúng ta thực thi trên SQLite.
Chúng ta phải dynamically convert DDL (CREATE TABLE) để tương thích với SQLite.

# YÊU CẦU

## 1. `backend/app/services/execution_service.py`

Tạo class `SimulationExecutor` với các methods sau:

### A. `_map_postgres_to_sqlite(pg_type: str) -> str`
Helper function để convert types.
- `UUID` -> `TEXT`
- `JSONB`, `JSON` -> `TEXT`
- `TIMESTAMPTZ`, `TIMESTAMP` -> `TEXT`
- `ARRAY(...)` -> `TEXT`
- `SERIAL`, `BIGSERIAL` -> `INTEGER`
- Default: Giữ nguyên (VARCHAR, INT, FLOAT thường hoạt động trên cả hai).

### B. `execute(meta_schema: Dict, sql_query: str) -> List[Dict]`
**Workflow:**
1.  **Init Engine:** `engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})`
2.  **Build Schema:**
    - Parse `meta_schema['tables']`.
    - Tạo `CREATE TABLE` statements sử dụng mapped types.
    - Execute DDL.
3.  **Seed Data:**
    - Parse `sample_data` từ JSON.
    - Tạo `INSERT INTO` statements.
    - **Crucial:** Handle JSON/UUID values trong sample data bằng cách convert thành strings trước khi insert.
4.  **Run Query:**
    - Execute user's `sql_query`.
    - Fetch result sử dụng `.mappings().all()`.
    - Convert result rows thành Dict.
5.  **Cleanup:** Dispose engine (được handle tự động bởi Python context, nhưng tốt khi explicit).

## 2. Error Handling
- Nếu user sử dụng Postgres-specific function (ví dụ: `gen_random_uuid()`) mà SQLite không có, catch `OperationalError`.
- Trả về friendly error: *"Simulation Mode runs on a lightweight engine. Some specific PostgreSQL functions may not be supported. Try standard SQL."*

# ĐẦU RA
Tạo complete code cho `backend/app/services/execution_service.py`.