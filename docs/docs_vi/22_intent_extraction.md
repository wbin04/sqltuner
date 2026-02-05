# VAI TRÒ
Bạn là một Kỹ sư Backend Python cấp cao.
Người dùng muốn tinh chỉnh `ChatService` để xử lý tin nhắn "Ý định hỗn hợp" (ví dụ: "Tối ưu hóa cái này: SELECT * FROM users").

# VẤN ĐỀ
Hiện tại, `detect_sql_intent` chỉ trả về `True/False`.
Nếu người dùng gửi văn bản hỗn hợp ("Optimize SELECT..."), hệ thống phát hiện nó là SQL (Tốt), NHƯNG Frontend có thể thử thực thi toàn bộ chuỗi bao gồm từ "Optimize" (Xấu, lỗi cú pháp).

# MỤC TIÊU
Nâng cấp `ChatService` để:
1. **Trích xuất** khối mã SQL thuần túy từ tin nhắn của người dùng.
2. **Trả về** SQL đã trích xuất này riêng biệt để Frontend có thể gắn nút "Run" hoặc "Optimize" cụ thể vào mã hợp lệ.

# THAY ĐỔI CẦN THIẾT

## 1. Cập nhật `backend/app/services/chat_service.py`

### Phương thức: `extract_sql_from_message(message: str) -> Optional[str]`
- **Ưu tiên 1:** Regex cho khối mã Markdown (```sql ... ```).
- **Ưu tiên 2:** Regex cho từ khóa SQL thô (`SELECT`, `WITH`, `CREATE`, v.v.) theo sau bởi cấu trúc SQL logic cho đến `;` hoặc cuối chuỗi.
- **Xác thực:** Sử dụng `sqlglot.parse_one(candidate_sql)` để xác minh văn bản đã trích xuất thực sự là SQL có thể phân tích. Nếu phân tích thất bại, trả về `None`.

### Phương thức: `handle_chat(...)`
- Gọi `extract_sql_from_message`.
- Nếu tìm thấy SQL:
  - Sử dụng `CHAT_SQL_SYSTEM_PROMPT`.
  - trả về cấu trúc cụ thể:
    ```python
    {
        "role": "assistant",
        "content": llm_response,
        "detected_sql": extracted_sql # Frontend uses this for Action Buttons
    }
    ```
- Nếu KHÔNG tìm thấy SQL:
  - Sử dụng `CHAT_GENERAL_SYSTEM_PROMPT`.
  - trả về `detected_sql: None`.

# ĐẦU RA
Tạo mã cập nhật cho `backend/app/services/chat_service.py`.