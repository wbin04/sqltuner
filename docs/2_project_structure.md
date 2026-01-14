# VAI TRÒ (ROLE)
Bạn là một Senior Full-stack Developer chuyên về Python (FastAPI) và React (TypeScript). Nhiệm vụ của bạn là khởi tạo cấu trúc dự án (Project Scaffolding) cho ứng dụng "Smart SQL Tuner".

# BỐI CẢNH & YÊU CẦU KỸ THUẬT (CONTEXT)
1.  **Mục tiêu:** Xây dựng khung dự án (Skeleton) chuẩn mực, dễ bảo trì, sẵn sàng cho việc phát triển tính năng RAG và SQL Optimization sau này.
2.  **Môi trường chạy:** - Hiện tại ưu tiên chạy **Local Native** (Python venv + Node.js trực tiếp trên máy) để debug nhanh.
    - Tuy nhiên, cấu trúc thư mục phải gọn gàng để sau này có thể thêm Docker mà không cần đập đi xây lại.
3.  **Tech Stack:**
    - **Backend:** Python 3.10+, FastAPI, Uvicorn, SQLAlchemy (Async), Pydantic v2.
    - **Frontend:** React 18+, TypeScript, Vite, TailwindCSS, Shadcn/UI (hoặc headless UI).
    - **Database:** PostgreSQL (kết nối qua driver `asyncpg`).

# YÊU CẦU ĐẦU RA (DELIVERABLES)

Hãy thực hiện 3 nhiệm vụ sau một cách chi tiết:

## NHIỆM VỤ 1: Cấu trúc Thư mục (Directory Structure)
Hãy vẽ cây thư mục (Tree structure) cho mô hình Monorepo. Yêu cầu phân chia rõ ràng:
- `/backend`: Chứa code Python.
  - Phải có cấu trúc module: `app/core` (config), `app/routers` (api), `app/services` (logic RAG/LLM), `app/models` (DB schemas).
- `/frontend`: Chứa code React.
- `/database`: Chứa các file SQL init, migration hoặc seed data.
- Các file ở root: `.gitignore`, `README.md`.

## NHIỆM VỤ 2: Thiết lập Backend (FastAPI)
1.  Tạo nội dung file `backend/requirements.txt` tối thiểu nhưng đủ dùng, bao gồm: `fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `python-dotenv`, `google-generativeai`, `psycopg2-binary`.
2.  Tạo file `backend/app/core/config.py` sử dụng `pydantic-settings` để load biến môi trường.
3.  Tạo file `backend/.env.example` và hướng dẫn tạo `.env` (bao gồm các key như: `DATABASE_URL`, `GEMINI_API_KEY`).
4.  Viết file `backend/main.py` đơn giản với 1 endpoint `/health` và cấu hình CORS (để frontend gọi được).

## NHIỆM VỤ 3: Thiết lập Frontend (React + TS)
1.  Hướng dẫn lệnh khởi tạo Vite với TypeScript.
2.  Tạo file `frontend/.env.example` và `.env.local` (chứa `VITE_API_URL`).
3.  Viết file `frontend/src/services/api.ts`: Tạo một instance `axios` (hoặc fetch wrapper) trỏ sẵn về Backend URL lấy từ env.
4.  Viết code `App.tsx` gọi thử API `/health` của backend và hiển thị kết quả lên màn hình để chứng minh kết nối thành công.

## NHIỆM VỤ 4: Hướng dẫn chạy (Run Instructions)
Viết các câu lệnh Terminal để:
1.  Setup & Run Backend (tạo venv, install pip, run uvicorn).
2.  Setup & Run Frontend (npm install, npm run dev).

---
LƯU Ý: Không cần viết logic phức tạp (RAG/LLM) ở bước này. Chỉ tập trung vào việc **kết nối thông suốt** giữa Frontend - Backend - Env Variables.