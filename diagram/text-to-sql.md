```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database
    participant Extract as Extractor
    participant AI as AI / LLM

    Note over User, AI: Luồng phân tích và tự động sinh mã SQL (Text-to-SQL)
    
    User->>UI: Nhập yêu cầu tự nhiên <br/>(VD: "Lấy doanh thu tháng 3 của bảng orders")
    UI->>Backend: API POST `/completion` (request.message, connection_id)
    
    activate Backend
    Backend->>DB: Lấy thông tin Workspace (Connection) từ DB
    activate DB
    DB-->>Backend: Trả về Object chứa `meta_schema` (JSON của toàn bộ Database)
    deactivate DB
    
    %% Quá trình trích xuất lược đồ
    Note over Backend, Extract: Bắt đầu quá trình trích xuất và tối ưu Context
    
    Backend->>Extract: Đưa câu văn của User và toàn bộ meta_schema vào
    activate Extract
    
    Extract->>Extract: Quét (Matching) từ khoá để tìm tên bảng được nhắc đến (Mentioned Tables)
    
    alt Nếu tìm thấy bảng cụ thể (Ví dụ: "orders")
        Extract->>Extract: Xây dựng Detailed Schema (Giới hạn tối đa 10 bảng liên quan nhất kèm ĐẦY ĐỦ Cột & Khóa ngoại)
    else Không nhắc đến bảng cụ thể
        Extract->>Extract: Xây dựng Compact Schema (Liệt kê tất cả các bảng nhưng ở dạng cú pháp thu gọn để tiết kiệm token)
    end
    
    Extract-->>Backend: Trả về Chuỗi Schema Text đã được format tối ưu hóa
    deactivate Extract
    
    %% Tạo Prompt
    Backend->>Backend: Ghép Schema Text + System Prompt (Quy tắc SQL) + Lịch sử Chat -> Final Prompt
    
    %% Gọi AI
    Backend->>AI: Gửi Final Prompt để phân tích
    activate AI
    AI-->>Backend: Trả về nội dung phản hồi có chứa khối mã ```sql ... ```
    deactivate AI
    
    Backend->>Backend: Phân tách (Parse) để bóc tách câu lệnh SQL từ raw text
    
    Backend-->>UI: Trả về JSON (Message Content, sql_generated)
    deactivate Backend
    
    UI->>UI: Render giao diện Component tin nhắn mới
    UI-->>User: Hiển thị khối mã SQL (Visual SQL Block) với nút "Execute"
```
