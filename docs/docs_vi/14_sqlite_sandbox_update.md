# VAI TRÒ
Bạn là Senior Backend Engineer.
Người dùng muốn cải thiện **Schema Sync** và **Execution Logic**.
Vấn đề hiện tại:
1.  Sync chỉ lấy 5 rows đầu tiên, không representative cho large tables. Lấy ALL rows (10k+) vào JSON không khả thi về performance.
2.  Execution trên "Real Database Workspaces" đang sai khi sử dụng "SQLite Simulation" path (trả về 0 rows nếu không sync), thay vì query live DB trực tiếp.

# NHIỆM VỤ
Refactor `InspectorService` cho better sampling và `ExecutionService` cho correct routing.

# YÊU CẦU

## 1. Refactor `InspectorService.sync_schema`
**File:** `backend/app/services/inspector_service.py`

Cập nhật logic để accept parameter `sample_size` (Default: 50, Max: 500).
Thay vì `SELECT * FROM table LIMIT 5`, sử dụng randomization strategy để lấy diverse data.

**Logic:**
- **PostgreSQL:** Sử dụng `SELECT * FROM {table} ORDER BY RANDOM() LIMIT {sample_size}`.
- **MySQL:** Sử dụng `SELECT * FROM {table} ORDER BY RAND() LIMIT {sample_size}`.
- **Safety:** Hard cap `sample_size` tại 500 để prevent JSON bloating/OOM errors.
- **Serialization:** Đảm bảo tất cả fetched rows được convert strictly thành JSON-safe formats (Stringify UUIDs, Dates, Decimals).

## 2. Refactor `ExecutionService.execute_sql`
**File:** `backend/app/services/execution_service.py`

Triển khai **Strict Routing Mechanism**:

### Path A: LIVE EXECUTION (The "Real" Path)
**Condition:** Nếu `db_connection.db_type` IN `['postgres', 'mysql']`.
**Action:**
1.  Tạo SQLAlchemy Connection String sử dụng credentials từ `db_connection`.
2.  Tạo **Direct Connection** đến external database.
3.  Execute query `text(sql)`.
4.  **Benefit:** Truy cập ALL 10,000+ rows trong real DB, bất kể stored trong `meta_schema`.

### Path B: SANDBOX EXECUTION (The "Simulation" Path)
**Condition:** Nếu `db_connection.db_type` == `'simulation'`.
**Action:**
1.  Sử dụng **SQLite In-Memory** strategy (create engine -> hydrate schema từ JSON -> seed data từ JSON -> execute).
2.  **Benefit:** Safe playground cho virtual schemas.

# ĐẦU RA
Tạo code cho:
1.  `backend/app/services/inspector_service.py` (Updated Sampling Logic).
2.  `backend/app/services/execution_service.py` (Updated Routing Logic).

# RÀNG BUỘC
- Handle connection errors gracefully trong Path A (ví dụ: nếu Real DB offline, trả về clear error, KHÔNG fall back sang Simulation silently).