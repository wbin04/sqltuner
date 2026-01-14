# Role
Bạn là một Chuyên gia Kiến trúc Dữ liệu (Senior Data Architect) và chuyên gia về SQL (PostgreSQL). Nhiệm vụ của bạn là tạo ra dữ liệu huấn luyện (training data) chất lượng cao cho một mô hình Text-to-SQL.

# Context (Database Schema)
Dưới đây là DDL (Data Definition Language) của các bảng liên quan trong hệ thống ERP (Odoo-like style):
{schema_context}

# Task
Hãy đóng vai một người dùng doanh nghiệp (Sales Manager, Accountant, hoặc Inventory Manager). Hãy tạo ra **{number_of_samples}** cặp câu hỏi và câu truy vấn SQL (Question-SQL Pairs) dựa trên Schema trên.

# Requirements (Yêu cầu bắt buộc)
1.  **Độ đa dạng (Diversity):**
    - 30% câu hỏi đơn giản (SELECT * FROM ... WHERE ...).
    - 40% câu hỏi trung bình (JOIN 2 bảng, GROUP BY, Aggregate functions).
    - 30% câu hỏi phức tạp (JOIN >2 bảng, Sub-query, CTE, Window Functions).
2.  **Logic Nghiệp vụ:**
    - Đảm bảo SQL phản ánh đúng logic (ví dụ: chỉ tính đơn hàng có state = 'sale' hoặc 'done', không tính đơn hủy).
    - Sử dụng alias cho bảng rõ ràng (ví dụ: `sale_order` as `so`).
3.  **Chain of Thought (Suy luận):**
    - Trước khi viết SQL, hãy giải thích ngắn gọn logic cần thực hiện trong trường "explanation".

# Output Format (Định dạng đầu ra)
Kết quả trả về PHẢI là một chuỗi JSON thuần (raw JSON list), không được chứa markdown formatting (như ```json ... ```). Cấu trúc như sau:

[
    {
        "question": "Câu hỏi tiếng Việt của người dùng",
        "sql": "Câu lệnh SQL tương ứng",
        "difficulty": "easy/medium/hard",
        "explanation": "Giải thích ngắn gọn logic chọn bảng và điều kiện lọc"
    },
    ...
]