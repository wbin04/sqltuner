```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database

    Note over User, DB: Bắt đầu luồng Execute SQL
    
    User->>UI: Bấm nút "Execute" trên khối mã SQL
    UI->>UI: Mở Results Panel & Hiển thị trạng thái "Đang tải" (Loading)
    UI->>Backend: Gửi API yêu cầu thực thi SQL (Connection ID, câu lệnh SQL)
    
    activate Backend
    
    %% Bắt đầu quá trình thiết lập SQLite in-memory Sandbox
    Note over Backend, DB: --- Quá trình thiết lập mô trường giả lập (SQLite Sandbox) ---
    Backend->>Backend: Khởi tạo Storage Database (Engine: sqlite:///:memory:)
    activate DB
    
    Backend->>DB: Tạo Schema Ảo (CREATE TABLE)<br/>(Kèm Type Mapping từ PostgreSQL -> SQLite)
    Backend->>DB: Chèn Dữ liệu Mẫu (Data Seeding - INSERT OR IGNORE)
    
    Backend->>Backend: Phân giải (Parse & Split) truy vấn SQL gốc thành các Statement đơn lẻ
    Backend->>DB: Gửi và thực thi tuần tự (Execute) từng SQL Statement
    
    alt Truy vấn Hợp lệ (Thành công)
        DB-->>Backend: Trả về kết quả thô (Raw Rows, Execution Time)
        Backend->>Backend: Xử lý dữ liệu (Đếm dòng, Cắt xén (Truncate) nếu kết quả quá lớn)
        Backend-->>UI: Trả về cấu trúc JSON định dạng trước (Cột, Dòng, Siêu dữ liệu)
        
        opt Nếu dữ liệu bị cắt xén (Truncated)
            UI->>UI: Hiển thị cảnh báo "Truncation Warning"
        end
        UI->>UI: Hiển thị dữ liệu lên Bảng (Data Table) trên màn hình
        UI-->>User: Người dùng xem kết quả cấu trúc bảng / cột
        
        opt Tương tác mở rộng
            User->>UI: Bấm vào 1 ô chứa dữ liệu JSON/Object
            UI->>UI: Mở JSON Viewer Modal hiển thị chi tiết
        end

    else Truy vấn Không Hợp lệ (Lỗi Cú pháp / Thiếu Bảng...)
        DB-->>Backend: Báo lỗi CSDL (Database Error)
        deactivate DB
        Backend-->>UI: Trả về mã lỗi và nguyên nhân thất bại
        deactivate Backend
        
        UI->>UI: Phân tích mã lỗi (Extract Error Message)
        UI->>UI: Kích hoạt bộ sinh gợi ý sửa lỗi (SQL Error Suggestion)
        UI-->>User: Hiển thị hộp thoại màu đỏ chứa Lỗi cụ thể + Gợi ý cách sửa
    end

```