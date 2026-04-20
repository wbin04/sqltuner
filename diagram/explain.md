```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database

    Note over User, DB: Bắt đầu luồng Giải thích truy vấn (Explain Plan)
    
    User->>UI: Bấm nút "Explain" trên khối mã SQL
    UI->>UI: Mở Explain Modal & Chuyển trạng thái "Đang phân tích..."
    UI->>Backend: Gửi API yêu cầu phân tích (Connection ID, câu lệnh SQL)
    
    activate Backend
    Backend->>DB: Yêu cầu lấy thông tin thông số kết nối (Workspace/Connection)
    DB-->>Backend: Trả về thông số kết nối (Kèm Schema nếu là Simulation)
    
    alt Là môi trường Simulation (Giả lập Sandbox)
        Note over Backend, DB: --- Phân tích trên SQLite in-memory ---
        Backend->>Backend: Khởi tạo Storage Database (sqlite:///:memory:)
        Backend->>DB: Dựng lại toàn bộ Schema Ảo và Đổ dữ liệu mẫu (Seeding)
        
        activate DB
        Backend->>DB: Thực thi "EXPLAIN QUERY PLAN <sql>"
        DB-->>Backend: Trả về kết quả Plan thô của SQLite
        Backend->>DB: Thực thi thật "<sql>" để lấy thời gian chạy và số dòng
        DB-->>Backend: Trả về Runtime Stats
        deactivate DB
        
    else Là môi trường CSDL Thật (MySQL / PostgreSQL)
        Note over Backend, DB: --- Phân tích trên CSDL Live Server ---
        Backend->>DB: Kết nối trực tiếp tới CSDL Thật thông qua SQLAlchemy
        
        activate DB
        Backend->>DB: Thực thi lệnh "EXPLAIN <sql>"
        DB-->>Backend: Trả về kế hoạch thực thi chung (Query Plan)
        
        opt Hỗ trợ EXPLAIN ANALYZE
            Backend->>DB: Thực thi lệnh "EXPLAIN ANALYZE <sql>"
            DB-->>Backend: Trả về thống kê thực thi chi tiết lúc Run-time
        end
        deactivate DB
    end
    
    Backend->>Backend: Xử lý và Gom nhóm dữ liệu giải thích định dạng chuẩn
    Backend-->>UI: Trả về JSON (Plan Columns, Rows, Cờ Hỗ trợ Analyze, Thời gian chạy)
    deactivate Backend
    
    UI->>UI: Tắt màn hình Load & Cập nhật UI
    UI-->>User: Hiển thị Explain Details (Các bước thực thi, Cost, Thời gian thực tế)
```
