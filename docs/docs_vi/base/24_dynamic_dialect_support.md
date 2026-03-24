# VAI TRÒ
Bạn là một Kỹ sư Backend Python cấp cao và Kiến trúc sư Cơ sở dữ liệu.
`ChatService` hiện tại sử dụng system prompt PostgreSQL được hardcode. Chúng ta cần refactor điều này để hỗ trợ **Multi-DBMS** (PostgreSQL, MySQL, SQLite, SQL Server) động dựa trên kết nối đang hoạt động.

# VẤN ĐỀ
Khi người dùng kết nối với cơ sở dữ liệu **MySQL** hoặc **SQL Server**, LLM vẫn tạo cú pháp cụ thể PostgreSQL (ví dụ: casting `::date`, cú pháp `INTERVAL`), gây ra lỗi cú pháp trong quá trình thực thi.

# MỤC TIÊU
Refactor logic tạo prompt để inject quy tắc cú pháp cụ thể dựa trên `dialect` của kết nối cơ sở dữ liệu hiện tại.

# THAY ĐỔI CẦN THIẾT

## 1. Refactor `backend/app/core/prompts.py`

**Task:** Thay thế hằng số tĩnh `CHAT_SQL_SYSTEM_PROMPT` bằng một hàm:
`def get_chat_sql_system_prompt(dialect: str = "postgresql") -> str`

**Logic bên trong hàm:**
1. Chuẩn hóa `dialect` thành chữ thường.
2. Định nghĩa biến chuỗi `syntax_rules` dựa trên dialect:
   - **PostgreSQL:**
     - Casts: `'value'::type`
     - Date Math: `NOW() - INTERVAL '1 day'`
     - Quoting: Double quotes `"` cho identifiers.
   - **MySQL/MariaDB:**
     - Casts: `CAST('value' AS DATE)` (Không có toán tử `::`)
     - Date Math: `DATE_SUB(NOW(), INTERVAL 1 DAY)`
     - Quoting: Backticks `` ` `` cho identifiers.
   - **SQLite:**
     - Date Math: `datetime('now', '-1 day')`
     - Quoting: Double quotes `"` hoặc Backticks `` ` ``.
   - **SQL Server (MSSQL):**
     - Date Math: `DATEADD(day, -1, GETDATE())`
     - Limit: Sử dụng `TOP n` thay vì `LIMIT n`.
     - Quoting: Brackets `[]`.

**Return:**
Trả về prompt f-string inject `{dialect}` và `{syntax_rules}`.
*Giữ logic "Text Intent > Provided SQL" hiện có và template phản hồi 3 dòng.*

## 2. Cập nhật `backend/app/services/chat_service.py`

**Task:** Cập nhật phương thức `chat` để lấy dialect và gọi hàm prompt mới.

**Logic:**
1. Lấy đối tượng `DBConnection` bằng `self.connection_repo.get(db, id=connection_id)`.
2. Trích xuất dialect (ví dụ: `connection.type` hoặc `connection.dialect`). Mặc định thành `"postgresql"` nếu không tìm thấy kết nối.
3. Nếu `extracted_sql` được phát hiện:
   - Gọi `system_prompt = get_chat_sql_system_prompt(current_dialect)`.
   - Thêm ghi chú hệ thống vào tin nhắn người dùng: `"\n[SYSTEM: Phát hiện ý định và đảm bảo cú pháp {current_dialect} hợp lệ.]"`

# ĐẦU RA
1. Mã đầy đủ cho hàm mới trong `backend/app/core/prompts.py`.
2. Phương thức `chat` đã cập nhật trong `backend/app/services/chat_service.py`.

# RÀNG BUỘC
- Đảm bảo prompt thực thi nghiêm ngặt: **"Nếu Văn bản Người dùng xung đột với Logic SQL, Văn bản Người dùng thắng."**
- Khối SQL phải hợp lệ cho `dialect` cụ thể được yêu cầu.