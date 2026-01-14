# VAI TRÒ (ROLE)
Bạn là một Senior Full-stack Architect & DevOps Engineer. Nhiệm vụ của bạn là hướng dẫn thiết lập môi trường phát triển cho dự án "Smart SQL Assistant & Performance Tuner" (FastAPI + React + PostgreSQL).

# BỐI CẢNH DỰ ÁN (CONTEXT)
- **Mục tiêu:** Xây dựng tool hỗ trợ tối ưu SQL dùng RAG và LLM (Gemini/SQLCoder).
- **Trạng thái:** Đang ở giai đoạn MVP, cần phát triển nhanh (Rapid Development).
- **Yêu cầu đặc biệt:** Developer muốn ưu tiên chạy **Local Native** (không dùng Docker) để debug cho nhanh ở bước đầu, nhưng vẫn muốn giữ lại cấu hình **Docker** để tham khảo hoặc dùng khi deploy sau này.

# YÊU CẦU ĐẦU RA (OUTPUT REQUIREMENTS)
Hãy viết tài liệu hướng dẫn kỹ thuật chi tiết, chia làm 2 phần rõ rệt:

## PHẦN 1: SETUP MÔI TRƯỜNG LOCAL (Ưu tiên thực hiện trước)
Hướng dẫn từng bước để chạy dự án trực tiếp trên máy (Bare Metal):

1.  **Database (PostgreSQL Local):**
    - Hướng dẫn cài đặt PostgreSQL 15/16.
    - Hướng dẫn cài đặt extension `pgvector` và `hypopg` trên môi trường Local (Lưu ý: Cảnh báo sự khác biệt giữa cài trên Linux/macOS và Windows. Nếu Windows quá khó cài `hypopg`, hãy đề xuất giải pháp thay thế như WSL2).
    - Cung cấp script SQL `init_db_local.sql` để tạo bảng và extension thủ công.

2.  **Backend (FastAPI Local):**
    - Liệt kê file `requirements.txt` tối thiểu (cần: `fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `google-generativeai`, `psycopg2-binary`, `pgvector`).
    - Lệnh chạy server với chế độ reload: `uvicorn app:app --reload`.

3.  **Frontend (React Local):**
    - Hướng dẫn khởi tạo Vite + TypeScript.
    - Cấu hình file `.env.local` để trỏ về API Backend localhost.

## PHẦN 2: SETUP MÔI TRƯỜNG DOCKER (Để dành/Tham khảo)
Viết sẵn cấu hình để dùng khi cần chuẩn hóa môi trường:
- File `Dockerfile` cho Backend.
- File `docker-compose.yml`:
    - Service DB: Dùng image `postgres:16` và tự động cài extension qua script.
    - Service Backend & Frontend.

## PHẦN 3: LUỒNG KIỂM THỬ ĐẦU TIÊN (Hello World)
Kịch bản test để đảm bảo mọi thứ đã thông suốt trong môi trường Local:
1.  Tạo một bảng `products` mẫu trong DB Local.
2.  Backend tạo API `/api/test-db` truy vấn thử bảng đó.
3.  Frontend gọi API và hiển thị kết quả.

---
Hãy trình bày rõ ràng, tách biệt các khối lệnh (Code block) cho Terminal, SQL, và Python.