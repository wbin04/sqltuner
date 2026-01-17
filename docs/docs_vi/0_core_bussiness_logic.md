# VAI TRÒ
Bạn là Senior Backend Lead và Business Analyst. Nhiệm vụ của bạn là định nghĩa Logic Kinh Doanh Cốt lõi và Sơ đồ Tuần tự cho "SQLTuner".

# NGỮ CẢNH DỰ ÁN
- **Ứng dụng:** Công cụ Tối ưu hóa SQL.
- **Các ràng buộc chính:**
  - Mật khẩu cho Target DBs phải được mã hóa (Fernet).
  - Việc trích xuất schema phải chỉ đọc và nhẹ.
  - Quá trình AI Tuning liên quan đến "Chain-of-Thought" (Phân tích Plan -> Xác định Bottleneck -> Đề xuất Index).

# YÊU CẦU ĐẦU RA

## PHẦN 1: Sơ đồ Tuần tự (Mermaid)
Tạo Sơ đồ Tuần tự Mermaid cho các luồng sau:
1.  **Luồng A: Schema Introspection.**
    - Người dùng chọn Kết nối DB -> Backend giải mã thông tin xác thực -> Kết nối qua SQLAlchemy Inspector -> Lấy tên Bảng/Cột -> Trả về cấu trúc JSON.
2.  **Luồng B: Yêu cầu Tuning SQL.**
    - Người dùng gửi SQL -> Backend chạy `EXPLAIN ANALYZE` -> Backend xây dựng Prompt (Schema + Plan) -> Gọi Ollama API -> Parser trích xuất lời khuyên JSON -> Phản hồi cho Người dùng.

## PHẦN 2: Pseudo-Code / Mô tả Logic
Viết pseudo-code chi tiết (giống Python) cho **Tuner Service**:
- Đầu vào: `target_db_id`, `sql_query`.
- Các bước:
  1. Lấy chi tiết kết nối từ Internal DB.
  2. Giải mã mật khẩu.
  3. Thiết lập kết nối tạm thời đến Target DB.
  4. Chạy `EXPLAIN (ANALYZE, FORMAT JSON)`.
  5. Phân tích kết quả JSON để tìm các node với `Node Type = 'Seq Scan'` hoặc `Total Cost` cao.
  6. Xây dựng prompt cho LLM.

## PHẦN 3: Bảo mật & Xử lý Lỗi
- Làm thế nào để xử lý các trường hợp SQL query của Người dùng là `DROP TABLE` hoặc phá hoại? (Đề cập: Chế độ giao dịch chỉ đọc hoặc Rollback).
- Làm thế nào để xử lý timeout của LLM hoặc ảo giác (trả về SQL không hợp lệ)?