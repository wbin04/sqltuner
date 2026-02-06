# VAI TRÒ
Bạn là Senior DevOps Engineer & System Architect. Nhiệm vụ của bạn là tạo cơ sở hạ tầng Docker hoàn toàn tự động, sẵn sàng sản xuất cho dự án "SQLTuner" (Công cụ Tối ưu hóa SQL Neuro-Symbolic).

# NGỮ CẢNH DỰ ÁN
- **Kiến trúc:** Cấu trúc Monorepo với mã cơ sở hạ tầng tách biệt.
- **Tech Stack:** Python 3.10 (FastAPI), PostgreSQL 17.
- **Yêu cầu Quan trọng:** Dockerfile Backend nằm trong thư mục con (`docker/backend/`) nhưng PHẢI được xây dựng bằng **Project Root** làm ngữ cảnh để truy cập mã nguồn `backend/`.

# CẤU TRÚC THƯ MỤC
(Agent phải tạo file khớp với cấu trúc chính xác này)
root/
├── .env                  # Biến môi trường
├── docker-compose.yml    # Điều phối
├── backend/              # Mã nguồn (đã tồn tại, không tạo nội dung, chỉ tham chiếu)
│   ├── app/
│   └── requirements.txt
└── docker/               # Mã Cơ sở hạ tầng (BẠN TẠO ĐÂY)
    ├── db/
    │   ├── Dockerfile    # Hình ảnh PG tùy chỉnh với extensions
    │   └── init.sql      # Script kích hoạt extensions
    └── backend/
        ├── Dockerfile    # Container FastAPI
        └── start.sh      # Script Entrypoint

# ĐẦU RA & YÊU CẦU

Vui lòng tạo nội dung cho 5 file sau. Sử dụng khối mã cho từng file.

## 1. `docker/db/Dockerfile`
- **Hình ảnh Cơ sở:** `pgvector/pgvector:pg17` (Hình ảnh chính thức với hỗ trợ vector).
- **Mục tiêu:** Cài đặt `hypopg` (Hypothetical Indexes) từ nguồn.
- **Các bước:**
  1. Cài đặt build deps: `git`, `make`, `gcc`, `postgresql-server-dev-16`.
  2. Clone `https://github.com/hypopg/hypopg`.
  3. Xây dựng và cài đặt (`make && make install`).
  4. Sao chép `init.sql` đến `/docker-entrypoint-initdb.d/`.

## 2. `docker/db/init.sql`
- Viết các lệnh SQL để kích hoạt các extensions cần thiết bên trong container DB:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS hypopg;
  ```

## 3. `docker/backend/Dockerfile`
- **Hình ảnh Cơ sở:** `python:3.10-slim`.
- **Giả định Ngữ cảnh Xây dựng:** Lệnh build sẽ được chạy từ `root/` (ví dụ: `docker build -f docker/backend/Dockerfile .`).
- **Các bước:**
  1. Cài đặt system deps: `libpq-dev`, `gcc`, `curl` (cho healthchecks), `netcat-openbsd` (để chờ DB).
  2. Đặt `WORKDIR /app`.
  3. **Quan trọng:** Sao chép `backend/requirements.txt` đến `/app/` (Lưu ý đường dẫn: nguồn là `backend/requirements.txt`).
  4. Cài đặt dependencies Python (không cache).
  5. Sao chép toàn bộ thư mục `backend/` đến `/app/backend`.
  6. Sao chép `docker/backend/start.sh` đến `/app/start.sh` và làm cho nó executable (`chmod +x`).
  7. Đặt `PYTHONPATH` thành `/app`.
  8. Đặt `ENTRYPOINT` thành `./start.sh`.

## 4. `docker/backend/start.sh`
- Viết script bash mà:
  1. Kiểm tra nếu biến `Reload` là true.
  2. (Tùy chọn nhưng khuyến nghị) Chờ cổng Postgres 5432 mở (sử dụng `nc` hoặc vòng lặp sleep).
  3. Chạy migrations cơ sở dữ liệu: `alembic upgrade head` (fail safe: `|| echo "Migration failed or not configured"`).
  4. Khởi động Uvicorn:
     - Nếu `DEV_MODE=true`: Chạy với `--reload` và host `0.0.0.0`.
     - Ngược lại: Khởi động sản xuất tiêu chuẩn.

## 5. `docker-compose.yml`
- Định nghĩa 2 services: `db` và `backend`.
- **Service: db**
  - Build context: `./docker/db`.
  - Load env file: `.env`.
  - Ports: `5432:5432`.
  - Volumes: `postgres_data:/var/lib/postgresql/data`.
  - **Healthcheck:** Thêm kiểm tra `pg_isready` để đảm bảo DB hoạt động.
- **Service: backend**
  - **Build Context:** `.` (Thư mục hiện tại/Root) <--- QUAN TRỌNG.
  - **Dockerfile:** `./docker/backend/Dockerfile`.
  - Load env file: `.env`.
  - Volumes: `./backend:/app/backend` (Cho Hot Reloading).
  - Ports: `8000:8000`.
  - Depends on: `db` (condition: `service_healthy`).
  - Environment: `DEV_MODE=true`.
- **Networks:** Định nghĩa mạng bridge tùy chỉnh `sqltuner_net`.
- **Volumes:** Định nghĩa `postgres_data`.

## 6. `.env.example`
- Cung cấp mẫu cho các biến cần thiết:
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
  - `DATABASE_URL` (Định dạng chuỗi kết nối).

# RÀNG BUỘC
- Đảm bảo `start.sh` có kết thúc dòng Unix (LF).
- Đảm bảo lệnh `COPY` trong Dockerfile tôn trọng đường dẫn tương đối từ Project Root.