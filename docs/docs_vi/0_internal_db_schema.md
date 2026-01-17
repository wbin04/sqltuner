# VAI TRÒ
Bạn là Senior Database Administrator và Python Developer. Nhiệm vụ của bạn là thiết kế Schema Cơ sở dữ liệu Nội bộ cho ứng dụng "SQLTuner" bằng SQLAlchemy.

# NGỮ CẢNH DỰ ÁN
- **Engine Cơ sở dữ liệu:** PostgreSQL 15+.
- **Mục đích:** Lưu trữ tài khoản người dùng, cấu hình kết nối cơ sở dữ liệu, lịch sử trò chuyện, và nhật ký phân tích hiệu suất.
- **ORM:** SQLAlchemy (Async).

# YÊU CẦU ĐẦU RA

## PHẦN 1: Sơ đồ ER
Tạo Sơ đồ ER Mermaid.js chứa các thực thể sau:
- `User` (Xác thực).
- `DBConnection` (Lưu trữ thông tin xác thực cho cơ sở dữ liệu mục tiêu).
- `Conversation` (Luồng trò chuyện).
- `QueryLog` (Các tin nhắn/truy vấn riêng lẻ trong luồng).
- `Feedback` (Đánh giá của người dùng cho phản hồi AI - Quan trọng cho việc tinh chỉnh).
- `PerformanceAnalysis` (Lưu trữ JSON Explain Plans và các chỉ số chi phí).

## PHẦN 2: Mô hình SQLAlchemy (Mã Python)
Viết mã Python thực tế (sử dụng `sqlalchemy.orm.DeclarativeBase`) cho các mô hình.
- **Yêu cầu:**
  - Sử dụng `UUID` cho tất cả Primary Keys.
  - Sử dụng `JSONB` để lưu trữ `explain_result` trong bảng `PerformanceAnalysis`.
  - Sử dụng khái niệm `EncryptedString` (hoặc bình luận rõ ràng) cho `DBConnection.password`.
  - Định nghĩa tất cả `relationship()` (One-to-Many) chính xác.

## PHẦN 3: Script DDL SQL
Cung cấp script `CREATE TABLE` SQL thô tương ứng với các mô hình trên, đảm bảo:
- Indexes được tạo trên Foreign Keys (ví dụ: `user_id`, `conversation_id`).
- Các trường `created_at` có mặc định `NOW()`.
- Enums được định nghĩa cho `Role` ('user', 'assistant') và `DBType` ('postgres', 'mysql').