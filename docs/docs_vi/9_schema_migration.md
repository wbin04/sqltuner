# VAI TRÒ
Bạn là Senior Python Backend Developer chuyên về Database Internals và FastAPI. Nhiệm vụ của bạn là thiết kế và triển khai **"Schema Synchronization Service"** cho ứng dụng SQLTuner.

# NGỮ CẢNH KINH DOANH
- **Mục tiêu:** Cho phép AI hiểu cấu trúc cơ sở dữ liệu của người dùng mà không cần truy vấn cơ sở dữ liệu trực tiếp liên tục.
- **Quy trình:** Hệ thống kết nối đến cơ sở dữ liệu mục tiêu (Postgres/MySQL), trích xuất metadata (Bảng, Cột, Loại, Khóa Ngoại), và lưu nó dưới dạng JSON cache đơn giản trong cơ sở dữ liệu nội bộ.
- **Ràng buộc:** Quy trình này phải là **Chỉ Đọc** trên metadata. KHÔNG lấy hàng dữ liệu (data).

# TECH STACK
- **Ngôn ngữ:** Python 3.10+
- **Framework:** FastAPI
- **ORM:** SQLAlchemy (Async + Sync cho inspection). *Lưu ý: `inspect()` thường yêu cầu engine đồng bộ.*
- **Bảo mật:** Mật khẩu trong DB được mã hóa. Bạn phải giải mã chúng trước khi kết nối.

# ĐẦU RA

Vui lòng tạo 2 phần sau:

## PHẦN 1: Logic Flow & Sequence Diagram
Tạo Sequence Diagram Mermaid.js mô tả luồng:
1.  **Client** kích hoạt `POST /connections/{id}/sync`.
2.  **API Layer** xác thực quyền.
3.  **Service Layer** lấy chi tiết kết nối từ Internal DB.
4.  **Security Util** giải mã mật khẩu DB mục tiêu.
5.  **Inspector Service**:
    - Tạo kết nối engine đồng bộ tạm thời đến Target DB.
    - Sử dụng `sqlalchemy.inspect(engine)`.
    - Lặp qua tất cả bảng.
    - Cho mỗi bảng: Lấy Cột (Tên, Loại), Khóa Chính, và Khóa Ngoại.
6.  **Data Formatter**: Chuyển đổi metadata thô thành cấu trúc JSON sạch được tối ưu cho LLM Context (ví dụ: giảm thiểu việc sử dụng token).
7.  **Storage**: Cập nhật trường `metadata_cache` (JSONB) trong bảng `DBConnection`.

## PHẦN 2: Implementation Code (Service Layer)
Viết hàm Python `sync_connection_schema(connection_id: UUID, db: Session)` trong `app/services/schema_service.py`.

**Yêu cầu chính cho code:**
- **Đầu vào:** Connection ID.
- **Connection Handling:** Sử dụng `create_engine` động dựa trên chuỗi kết nối được xây dựng từ thông tin xác thực đã giải mã.
- **Inspector Usage:**
  ```python
  # Ví dụ logic style
  inspector = inspect(temp_engine)
  for table_name in inspector.get_table_names():
      columns = inspector.get_columns(table_name)
      # ... process columns ...
  ```
- **LLM-Optimized JSON Structure:**
  Đầu ra JSON nên trông như thế này (định dạng compact):
  ```json
  {
    "table_name": [
      {"name": "id", "type": "INTEGER", "pk": true},
      {"name": "user_id", "type": "UUID", "fk": "users.id"}
    ]
  }
  ```
- **Error Handling:** Xử lý trường hợp Target DB không thể truy cập hoặc xác thực thất bại.