# Bối cảnh
Tôi đang xây dựng "SQLTuner", một công cụ tối ưu hóa SQL Neuro-Symbolic.
Refactoring dự án thành cấu trúc Production-Ready nơi infrastructure được tách biệt khỏi source code.
Cấu trúc thư mục mới là:
- root/
  - backend/ (Chứa source code Python: app/, requirements.txt)
  - docker/
    - database/
      - Dockerfile (Custom Postgres với 'hypopg', 'vector')
      - init.sql
    - backend/
      - Dockerfile (FastAPI setup)
      - start.sh (Entrypoint script)
  - docker-compose.yml
  - .env

# Nhiệm vụ
Tạo các file cấu hình cho cấu trúc modular này.

# Yêu cầu

1. **docker/database/Dockerfile**:
   - Base image: `pgvector/pgvector:pg17`.
   - Cài đặt build dependencies (git, make, gcc, postgresql-server-dev-16).
   - Clone và cài đặt `hypopg` từ source.
   - Copy `init.sql` vào `/docker-entrypoint-initdb.d/`.

2. **docker/backend/Dockerfile**:
   - Base image: `python:3.10-slim`.
   - **Crucial Build Context Logic**: Giả sử build context là PROJECT ROOT.
   - Cài đặt system deps (`libpq-dev`, `gcc`, `curl`).
   - Copy `backend/requirements.txt` vào `/app/` và cài đặt dependencies (Layer Caching).
   - Copy `backend/` source code vào `/app/`.
   - Copy `docker/backend/start.sh` vào `/app/`, make it executable.
   - Set Entrypoint thành `./start.sh`.

3. **docker/backend/start.sh**:
   - Shell script để chạy migrations (alembic) nếu cần, sau đó khởi động Uvicorn với reload enabled.

4. **docker-compose.yml** (trong root):
   - **Service 'sqltuner-server'**:
     - Build context: `./docker/database` (Self-contained).
     - Environment từ `.env`.
     - Ports: `5432:5432`.
     - Volume: `postgres_data:/var/lib/postgresql/data`.
   - **Service 'backend'**:
     - **Build Context**: `.` (The Root Directory) <--- RẤT QUAN TRỌNG để có thể truy cập 'backend/' folder.
     - **Dockerfile**: `./docker/backend/Dockerfile`.
     - Volumes:
       - `./backend:/app` (Hot Reload for Dev).
     - Ports: `8000:8000`.
     - Depends on `sqltuner-server`.
     - Network: `sqltuner_net`.

# Output
Cung cấp nội dung cho:
1. `docker/database/Dockerfile`
2. `docker/backend/Dockerfile`
3. `docker/backend/start.sh`
4. `docker-compose.yml`