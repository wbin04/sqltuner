# VAI TRÒ (ROLE)
Bạn là một Senior Full-stack Developer chuyên về Python (FastAPI) và React (TypeScript). Nhiệm vụ của bạn là khởi tạo cấu trúc dự án (Project Scaffolding) cho ứng dụng "SQLTuner".

# BỐI CẢNH & YÊU CẦU KỸ THUẬT (CONTEXT)
1.  **Mục tiêu:** Xây dựng hệ thống hỗ trợ tối ưu SQL sử dụng Local LLM (Ollama). Hệ thống cần chịu tải tốt, code clear, tách biệt logic (Separation of Concerns).
2.  **Môi trường chạy:** - Backend chạy Python venv local.
    - Frontend chạy Node.js local.
    - LLM Server: Đã có sẵn Ollama chạy tại `http://localhost:11434`.
3.  **Tech Stack:**
    - **Backend:** Python 3.10+, FastAPI, Uvicorn.
    - **Database ORM:** SQLAlchemy (Async), Alembic (Migration), Asyncpg (Driver).
    - **LLM Integration:** `httpx` (Async Client để gọi Ollama không bị block request).
    - **Frontend:** React 18+, TypeScript, Vite, TailwindCSS, Shadcn/UI.

# YÊU CẦU ĐẦU RA (DELIVERABLES)

Hãy thực hiện 4 nhiệm vụ sau một cách chi tiết:

## NHIỆM VỤ 1: Cấu trúc Thư mục (Directory Structure)
Vẽ cây thư mục Monorepo chuẩn. Yêu cầu chi tiết trong `/backend`:
- `app/core`: Config (env loading), Security, Constants.
- `app/api/v1/endpoints`: Chứa các routers (VD: `sql.py`, `db_inspector.py`).
- `app/db`: Chứa `base.py` (SQLAlchemy Base), `session.py` (Async engine).
- `app/models`: Chứa các Class SQLAlchemy (Mapping với bảng DB).
- `app/schemas`: Chứa các Class Pydantic (Request/Response validation).
- `app/services`: 
    - `llm_service.py`: Logic gọi sang Ollama.
    - `inspector_service.py`: Logic đọc cấu trúc DB.
- `alembic/`: Thư mục migration tự động.

## NHIỆM VỤ 2: Thiết lập Backend (FastAPI)
1.  **Dependencies:** Tạo `backend/requirements.txt` bao gồm: 
    `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `asyncpg`, `alembic`, `pydantic-settings`, `python-dotenv`, `httpx` (thay vì requests).
2.  **Configuration:** - Tạo `backend/app/core/config.py` dùng `BaseSettings`.
    - Load các biến: `API_V1_STR`, `PROJECT_NAME`, `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `OLLAMA_BASE_URL` (default: http://localhost:11434), `MODEL_NAME` (default: sqlcoder-thesis).
3.  **Environment:** Tạo `backend/.env.example` mẫu.
4.  **Main App:** Viết `backend/app/main.py`:
    - Setup CORS (cho phép `http://localhost:5173`).
    - Include router mẫu.
    - Endpoint `/health` trả về status và model name đang sử dụng.

## NHIỆM VỤ 3: Thiết lập Frontend (React + TS)
1.  **Khởi tạo:** Hướng dẫn lệnh tạo Vite + React + TS.
2.  **Tailwind & UI:** Hướng dẫn lệnh cài TailwindCSS và init cấu hình cơ bản.
3.  **API Client:** - Tạo file `frontend/src/lib/axios.ts`: Cấu hình Axios Interceptor cơ bản (xử lý lỗi chung).
    - Lấy `VITE_API_URL` từ `.env`.
4.  **Integration Test:** - Viết component `App.tsx` sử dụng `useEffect` gọi vào `/health`.
    - Hiển thị: "Backend Status: Online | Model: sqlcoder-thesis" (màu xanh nếu OK, đỏ nếu lỗi).

## NHIỆM VỤ 4: Hướng dẫn chạy (Run Instructions)
Viết file `README.md` ngắn gọn chứa các lệnh:
1.  Backend: Tạo venv -> Install reqs -> Chạy migration (alembic upgrade head) -> Start server.
2.  Frontend: Install deps -> Dev server.