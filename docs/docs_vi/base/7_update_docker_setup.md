# VAI TRÒ
Bạn là Senior DevOps Engineer & System Architect.
Nhiệm vụ của bạn là mở rộng cơ sở hạ tầng Docker hiện có để bao gồm **Frontend Service** (React + Vite).

# NGỮ CẢNH DỰ ÁN
- **Kiến trúc:** Monorepo.
- **Chiến lược Build:** Tất cả services phải được build sử dụng **Project Root** làm ngữ cảnh.
- **Cấu trúc Thư mục Hiện tại:**
  root/
  ├── .env
  ├── docker-compose.yml    # Hiện tại có 'database' và 'backend'
  ├── backend/              # Python FastAPI source
  ├── frontend/             # React + Vite source (Đã tồn tại)
  │   ├── package.json
  │   └── vite.config.ts
  └── docker/
      ├── database/         # Đổi tên từ 'db'
      │   ├── Dockerfile
      │   └── init.sql
      ├── backend/
      │   ├── Dockerfile
      │   └── start.sh
      └── frontend/         # THƯ MỤC MỚI CHO NHIỆM VỤ NÀY
          └── Dockerfile    # BẠN CẦN TẠO ĐÂY

# ĐẦU RA

Vui lòng tạo nội dung cho 2 file sau sử dụng thông số kỹ thuật dưới đây.

## 1. `docker/frontend/Dockerfile`
- **Hình ảnh Cơ sở:** `node:20-alpine`.
- **Giả định Ngữ cảnh Build:** Lệnh build sẽ được chạy từ `root/`.
- **Hướng dẫn:**
  1. Đặt `WORKDIR /app`.
  2. Sao chép `frontend/package.json` và `frontend/package-lock.json` đến `./` (Tận dụng Docker cache).
  3. Chạy `npm install`.
  4. Sao chép toàn bộ thư mục `frontend/` đến `./`.
  5. Expose port `5173`.
  6. **CMD:** Chạy dev server cho phép truy cập host: `npm run dev -- --host`.

## 2. `docker-compose.yml` (Cập nhật)
- Giữ các services `database` và `backend` hiện có (đảm bảo `database` trỏ đến `./docker/database`).
- **Thêm service mới: `frontend`**.
  - **Build Context:** `.` (Root).
  - **Dockerfile:** `./docker/frontend/Dockerfile`.
  - **Ports:** `5173:5173`.
  - **Volumes (Quan trọng cho Hot Reload):**
    - Mount `./frontend` đến `/app` (Đồng bộ thay đổi code).
    - **Volume Trick:** Mount `/app/node_modules` như anonymous volume để ngăn host OS ghi đè dependencies container.
  - **Environment:**
    - `VITE_API_URL=http://localhost:8000/api/v1` (Truy cập Backend từ Browser-side).
  - **Networks:** Kết nối đến `sqltuner_net`.

# RÀNG BUỘC
- Đảm bảo đường dẫn tương đối chính xác vì Dockerfile nằm trong `docker/frontend/` nhưng truy cập source `frontend/` từ Root.
- Định nghĩa service `database` trong `docker-compose.yml` phải khớp với đường dẫn mới `docker/database`.