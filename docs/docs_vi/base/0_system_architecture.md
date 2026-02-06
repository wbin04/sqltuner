# VAI TRÒ
Bạn là Senior System Architect chuyên về Ứng dụng Web được điều khiển bởi AI. Nhiệm vụ của bạn là thiết kế Kiến trúc Hệ thống cho dự án "SQLTuner".

# NGỮ CẢNH DỰ ÁN
- **Mục tiêu:** Một ứng dụng web 3 tầng giúp các nhà phát triển tối ưu hóa truy vấn SQL bằng Local LLM (Ollama) hoặc Cloud LLM (Gemini).
- **Chức năng cốt lõi:** Kết nối đến cơ sở dữ liệu bên ngoài (Target DB), trích xuất schema, trò chuyện với AI để tạo SQL, và phân tích hiệu suất truy vấn (Explain Analyze).
- **Tech Stack:**
  - **Frontend:** React (Vite, TypeScript, TailwindCSS).
  - **Backend:** Python (FastAPI, SQLAlchemy, Pydantic).
  - **AI Engine:** Ollama (Local) chạy `sqlcoder-7b` qua HTTP API.
  - **Database:** PostgreSQL (Internal App DB) & Various Target DBs (Postgres/MySQL).

# YÊU CẦU ĐẦU RA

## PHẦN 1: Kiến trúc Cấp cao
1.  **Sơ đồ:** Tạo khối mã Mermaid.js đại diện cho **Kiến trúc 3 Tầng**.
    - Rõ ràng hiển thị: Client (Browser) <-> API Gateway (FastAPI) <-> Service Layer (Orchestrator/Tuner) <-> Data Layer.
    - Hiển thị tích hợp bên ngoài: Backend <-> Ollama API & Backend <-> Target Databases.
2.  **Phân tích Thành phần:** Mô tả trách nhiệm của từng thành phần chính:
    - **Connection Manager:** Xử lý kết nối DB an toàn.
    - **Schema Extractor:** Sử dụng SQLAlchemy Inspector.
    - **AI Orchestrator:** Mẫu prompt và quản lý ngữ cảnh.
    - **Tuner Engine:** Phân tích kết quả `EXPLAIN (FORMAT JSON)`.

## PHẦN 2: Mô tả Luồng Dữ liệu
Mô tả luồng dữ liệu từng bước cho kịch bản **"Performance Tuning"**:
1. Người dùng gửi truy vấn SQL chậm từ Frontend.
2. Backend thực thi `EXPLAIN` trên Target DB.
3. Backend gửi Schema + Query Plan đến AI.
4. AI tạo ra các khuyến nghị.
5. Backend lưu kết quả vào Internal DB và trả về Frontend.

## PHẦN 3: Lý do Chọn Tech Stack
Giải thích tại sao **FastAPI** (Async) và **PostgreSQL** (hỗ trợ JSONB) quan trọng cho kiến trúc cụ thể này so với Django hoặc MongoDB.