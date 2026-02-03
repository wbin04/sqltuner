# VAI TRÒ
Bạn là một Kỹ sư Backend Python cấp cao chuyên về tích hợp LLM và Phát hiện Ý định.
Nhiệm vụ của bạn là nâng cấp `ChatService` trong `SQLTuner` để hỗ trợ **Context-Aware Prompting**.

# VẤN ĐỀ
Hiện tại, Chat API coi tất cả tin nhắn của người dùng là cuộc trò chuyện chung.
Khi người dùng dán một script SQL (ví dụ: để gỡ lỗi hoặc giải thích), LLM phản hồi như một chatbot thông thường, thường bỏ qua độ sâu kỹ thuật cần thiết cho kỹ thuật cơ sở dữ liệu (ví dụ: xác thực cú pháp, rủi ro hiệu suất).

# MỤC TIÊU
Triển khai cơ chế **Phát hiện Ý định** trong backend:
1. **Phát hiện:** Kiểm tra xem tin nhắn của người dùng có chứa mã SQL không.
2. **Chuyển đổi:**
   - Nếu phát hiện SQL -> Sử dụng `SQL_REVIEWER_SYSTEM_PROMPT`.
   - Nếu không có SQL -> Sử dụng `GENERAL_CHAT_SYSTEM_PROMPT` tiêu chuẩn.

# THAY ĐỔI CẦN THIẾT

## 1. Tập trung Prompts
**File:** `backend/app/core/prompts.py`
Thêm hai hằng số mới:

1. `CHAT_GENERAL_SYSTEM_PROMPT`: "Bạn là một trợ lý hữu ích cho SQLTuner..."
2. `CHAT_SQL_SYSTEM_PROMPT`:
   - Vai trò: Quản trị viên Cơ sở dữ liệu cấp cao.
   - Hướng dẫn:
     1. Kiểm tra tính hợp lệ của cú pháp (PostgreSQL).
     2. Giải thích ý định của truy vấn.
     3. Xác định rủi ro hiệu suất (ví dụ: `SELECT *`, wildcard dẫn đầu `%...`, thiếu joins).
     4. Đề xuất phiên bản sửa đổi nếu SQL không hợp lệ.
   - Ràng buộc: KHÔNG thực thi truy vấn. Chỉ phân tích.

## 2. Triển khai Logic Phát hiện Ý định
**File:** `backend/app/services/chat_service.py`
Refactor phương thức `chat` (hoặc tạo một helper) để phát hiện SQL.

**Logic cho `detect_sql_intent(message: str) -> bool`:**
- **Bước A:** Sử dụng `sqlglot` (đã cài đặt) để thử phân tích token đầu tiên của tin nhắn. Nếu phân tích thành công như một biểu thức SQL -> Trả về `True`.
- **Bước B:** Nếu phân tích thất bại (văn bản lỏng lẻo), fallback sang Keyword Matching. Kiểm tra xem tin nhắn có chứa từ khóa viết hoa hoặc viết thường như: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `WITH`.
- **Bước C:** Nếu phát hiện, đặt `system_prompt` thành `CHAT_SQL_SYSTEM_PROMPT`. Nếu không, sử dụng `CHAT_GENERAL_SYSTEM_PROMPT`.

## 3. Refactor Chat Service
Cập nhật hàm chat chính để sử dụng system prompt động trước khi gọi LLM.

# TIÊU CHUẨN LẬP TRÌNH
- **Thư viện:** Sử dụng `sqlglot` để phát hiện phân tích.
- **Type Hinting:** Đánh kiểu nghiêm ngặt (`bool`, `str`, `List[dict]`).
- **Clean Code:** Tách logic phát hiện thành một phương thức riêng `_is_sql_query()`.

# ĐẦU RA
Tạo mã cho:
1. `backend/app/core/prompts.py` (Cập nhật với prompts mới).
2. `backend/app/services/chat_service.py` (Refactor đầy đủ với logic phát hiện).

# VÍ DỤ KỊCH BẢN
- **Input:** "Xin chào, bạn khỏe không?"
  -> **Action:** Sử dụng `GENERAL_PROMPT`.
- **Input:** "SELECT * FROM users WHERE email LIKE '%@gmail.com'"
  -> **Action:** Sử dụng `SQL_REVIEWER_PROMPT`.
  -> **Output:** "Truy vấn này thực hiện Full Table Scan do wildcard dẫn đầu..."