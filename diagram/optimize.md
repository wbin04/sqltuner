```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database

    Note over User, AI: Bắt đầu luồng Tối ưu hóa truy vấn (Optimize SQL)
    
    User->>UI: Bấm nút "Optimize" trên khối mã SQL
    UI->>Backend: Gửi API yêu cầu Tối ưu hóa (Connection ID, SQL)
    
    activate Backend
    Backend->>Backend: Khởi tạo Dịch vụ Tối ưu (Optimization Service)
    
    %% Bước 1: Đánh giá chi phí truy vấn gốc
    opt Nếu không phải môi trường giả lập (Real DB)
        Backend->>DB: Thực thi "EXPLAIN <sql_gốc>" để đo lường
        DB-->>Backend: Trả về Original Cost & Cấu trúc thực thi (Plan)
        Backend->>Backend: Phân tích Plan để tìm ra "Nút thắt cổ chai" (Bottlenecks)
    end
    
    Backend->>Backend: Phân tích tĩnh tĩnh truy vấn (Static Analysis) để tìm Anti-pattern

    %% Bước 2: Gọi AI để tối ưu
    Backend->>AI: Gửi SQL gốc + Lược đồ DB (Schema) + Bottlenecks
    activate AI
    AI-->>Backend: Trả về SQL Mới + Gợi ý đánh Index + Lời giải thích
    deactivate AI
    
    %% Bước 3: Đánh giá chi phí truy vấn mới
    opt Nếu có yêu cầu kèm Giải thích & Là Real DB
        Backend->>DB: Thực thi "EXPLAIN <sql_mới>" để đo lường
        DB-->>Backend: Trả về Optimized Cost
        Backend->>Backend: Tính toán tỷ lệ cải thiện hiệu năng (Improvement Percent)
    end
    
    Backend-->>UI: Trả về kết quả (SQL Cũ & Mới, Bottlenecks, % Cải thiện, Index)
    deactivate Backend
    
    UI->>UI: Mở Popup Cửa sổ Tối ưu (Optimization Modal)
    UI-->>User: Hiển thị So sánh trực quan (Before / After)

    %% Tùy chọn Áp dụng (Tương tác thêm)
    opt Người dùng chấp nhận tối ưu
        User->>UI: Bấm "Apply" trên Modal
        UI->>UI: Đóng Modal & Đưa SQL mới kèm Index sinh tự động vào Chat
        UI->>Backend: Gửi yêu cầu Thực thi (Execute) với SQL mới (Quay lại luồng Execute)
    end
```
