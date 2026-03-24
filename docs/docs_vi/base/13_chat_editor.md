# VAI TRÒ
Bạn là Senior Fullstack Engineer thành thạo **FastAPI (Python)** và **React (TypeScript)**.
Nhiệm vụ của bạn là triển khai **End-to-End Logic** cho SQLTuner Editor, kết nối Backend APIs với Frontend components (`SqlBlock`, `OptimizationModal`).

# NGỮ CẢNH
- **Frontend:**
  - `EditorPage` đã tồn tại (Layout với Sidebar, Chat Area, Schema Panel).
  - Component `SqlBlock` đã tồn tại (có props `onRun`, `onExplain`, `onOptimize`).
  - Component `OptimizationModal` đã tồn tại (hiển thị diff view và stats).
- **Backend:**
  - Bảng `db_connections` lưu `meta_schema` (JSONB).
  - `LLMService` cơ bản đã tồn tại (cho chat generic).

# MỤC TIÊU
Triển khai API Endpoints và Frontend Integration để hỗ trợ 4 workflows sau:
1.  **Chat:** Người dùng hỏi câu hỏi -> AI trả lời sử dụng DB Schema Context.
2.  **Execute:** Người dùng click "Run" -> Backend thực thi SQL (Real DB) hoặc tạo fake data (Simulation).
3.  **Explain:** Người dùng click "Explain" -> Backend chạy `EXPLAIN (JSON)`.
4.  **Optimize:** Người dùng click "Optimize" -> AI phân tích và đề xuất cải thiện.

# YÊU CẦU

## PHẦN 1: BACKEND IMPLEMENTATION (FastAPI)

### 1. Chat Endpoint (`app/api/v1/endpoints/chat.py`)
- **POST** `/api/v1/chat/completion`
- **Input:** `{ connection_id: UUID, conversation_id: UUID, message: str }`
- **Logic:**
  1.  Lấy `meta_schema` từ `db_connections` sử dụng `connection_id`.
  2.  Tạo **System Prompt** chứa định nghĩa Table/Column (từ `meta_schema`) để cung cấp context cho LLM.
  3.  Gọi `LLMService` để tạo response.
  4.  Lưu turn vào bảng `query_logs`.
- **Output:** `{ role: "assistant", content: "Markdown response..." }`

### 2. SQL Execution Endpoint (`app/api/v1/endpoints/sql.py`)
- **POST** `/api/v1/sql/execute`
- **Input:** `{ connection_id: UUID, sql: str }`
- **Logic:**
  - **IF Real DB:** Tạo kết nối synchronous (sử dụng SQLAlchemy `text`), thực thi query, lấy kết quả.
  - **IF Simulation:** Sử dụng `LLMService` để tạo **Mock Data** (JSON) phù hợp với cấu trúc SQL.
- **Output:** `{ columns: List[str], rows: List[Dict], execution_time_ms: float }`

### 3. Optimization Endpoints (`app/api/v1/endpoints/sql.py`)
- **POST** `/api/v1/sql/explain`
  - **Logic:** Chạy `EXPLAIN (ANALYZE, FORMAT JSON) ...` trên Real DB.
  - **Output:** `{ plan: JSON, total_cost: float, execution_time: float }`.
- **POST** `/api/v1/sql/optimize`
  - **Logic:**
    1.  Lấy `original_stats` (qua Explain).
    2.  Yêu cầu LLM viết lại SQL và đề xuất Indexes dựa trên `meta_schema`.
    3.  (Tùy chọn) Chạy Explain trên SQL mới để lấy `new_stats`.
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

## PHẦN 2: FRONTEND INTEGRATION (React)

### 1. Services (`src/services/sqlService.ts`, `src/services/chatService.ts`)
- Triển khai Axios wrappers cho các APIs ở trên.
- Đảm bảo strict typing cho Requests/Responses.

### 2. `useEditorLogic` Hook (`src/hooks/useEditorLogic.ts`)
Tạo unified hook để quản lý complex state của Editor:
- **State:** `messages` (Chat history), `isOptimizing` (boolean), `optimizationResult` (Object).
- **Functions:**
  - `handleSendMessage(text)`: Gọi Chat API, thêm response vào `messages`.
  - `handleRunQuery(sql)`: Gọi Execute API.
  - `handleOptimize(sql)`: Gọi Optimize API, sau đó mở `OptimizationModal`.

### 3. Wiring Components (`src/pages/EditorPage.tsx` & `ChatArea.tsx`)
- Truyền `handleRunQuery` vào prop `onRun` của `SqlBlock`.
- Truyền `handleOptimize` vào prop `onOptimize` của `SqlBlock`.
- Khi `handleRunQuery` trả về data, hiển thị `<DataGrid />` ngay dưới `SqlBlock` cụ thể.
- Khi `handleOptimize` trả về data, truyền vào `<OptimizationModal />` và set `isOpen={true}`.

# ĐẦU RA
Vui lòng tạo code cho:
1.  `backend/app/api/v1/endpoints/chat.py`
2.  `backend/app/api/v1/endpoints/sql.py`
3.  `src/services/sqlService.ts`
4.  `src/hooks/useEditorLogic.ts`

# RÀNG BUỘC
- Sử dụng `sqlalchemy` cho DB interactions.
- Đảm bảo error handling: Nếu query thất bại (syntax error), trả về structured error message để hiển thị trong UI, không phải 500 Crash.
- Cho Simulation mode execution, Mock Data generation nên đơn giản (ví dụ: 5 rows sample data).