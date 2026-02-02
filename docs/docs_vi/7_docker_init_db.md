# VAI TRÒ
Bạn là Senior Backend Engineer chuyên về Python (FastAPI), SQLAlchemy, và Docker.
Nhiệm vụ của bạn là triển khai **Cơ chế Seeding Cơ sở dữ liệu An toàn & Tự động** cho dự án SQLTuner.

# NGỮ CẢNH
Hiện tại, chúng ta đang chèn người dùng ban đầu qua raw SQL (`INSERT INTO...`) trong `init.sql`. Điều này không an toàn vì mật khẩu được lưu dưới dạng plain text.
Chúng ta cần refactor điều này để sử dụng script Python tự động hash mật khẩu trước khi lưu trữ.

# YÊU CẦU

## 1. Tạo Seeding Script: `backend/app/db/init_db.py`
Tạo script Python kết nối đến cơ sở dữ liệu và chèn người dùng ban đầu.
- **Dependencies:** Import `get_password_hash` từ `app.core.security`.
- **Idempotency:** Script phải là **idempotent**. Nó nên kiểm tra xem người dùng có tồn tại (theo email) trước khi chèn.
  - IF người dùng tồn tại: Log "User already exists. Skipping."
  - IF người dùng không tồn tại:
    1. Hash mật khẩu plain text sử dụng `get_password_hash`.
    2. Chèn người dùng vào bảng `users`.
    3. Log "User created successfully."
- **Dữ liệu để Seed:**
  - Admin: `admin@gmail.com` / `admin` (Role: `admin`)
  - User: `quochuy04.ar@gmail.com` / `quochuy04` (Role: `user`)

## 2. Cập nhật Entrypoint: `docker/backend/start.sh`
Sửa đổi script khởi động để thực thi seeding script tự động trước khi server khởi động.
- **Vị trí:** Chèn lệnh `python app/db/init_db.py` sau kiểm tra migrations cơ sở dữ liệu và trước khi khởi động `uvicorn`.
- **Mục tiêu:** Đảm bảo mỗi lần container khởi động, cơ sở dữ liệu được kiểm tra và seed nếu trống.

## 3. Cleanup & Hướng dẫn Triển khai
Cung cấp hướng dẫn từng bước để reset môi trường để đảm bảo logic seeding mới có hiệu lực mà không có xung đột.
- **Action 1:** Loại bỏ câu lệnh `INSERT INTO users...` legacy từ `docker/database/init.sql`.
- **Action 2:** Lệnh để destroy volumes cũ và rebuild: `docker-compose down -v && docker-compose up --build`.

# ĐẦU RA
Vui lòng cung cấp code đầy đủ cho:
1. `backend/app/db/init_db.py`
2. `docker/backend/start.sh` (Phiên bản cập nhật)