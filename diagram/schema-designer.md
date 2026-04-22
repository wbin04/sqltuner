```sequenceDiagram
    autonumber
    
    actor User as User
    participant IDE as Schema IDE (TableEditor)
    participant Diagram as Biểu đồ Trực quan (Diagram)
    participant UI_State as React State (Local Schema)
    participant Backend as Hệ thống Backend
    participant DB as CSDL Lưu trữ (Dữ liệu Workspace)

    Note over User, UI_State: Quá trình Chỉnh sửa cục bộ trên Frontend
    
    alt Sửa qua Không gian làm việc Text-based (TableEditor)
        User->>IDE: Thay đổi cấu trúc (Thêm Cột, Khóa chính, Sửa Data)
        IDE->>UI_State: Cập nhật object JSON Schema tạm thời
    else Sửa qua Biểu đồ Kéo-thả (Edit Mode Diagram)
        User->>Diagram: Kéo thả tạo bảng, nối dây Khóa ngoại (Edge)
        Diagram->>UI_State: Cập nhật object JSON Schema tạm thời
    end
    
    UI_State-->>User: Giao diện hiển thị dấu (*) đỏ "Unsaved Changes"

    Note over User, DB: Quá trình đồng bộ xuống Backend
    
    User->>IDE: Bấm nút "Save Changes"
    IDE->>UI_State: Thu thập toàn bộ Schema hiện có
    UI_State->>Backend: Gửi API Update Simulation Schema (Kèm toàn bộ JSON data)
    
    activate Backend
    Backend->>Backend: Chuẩn hóa, mapping kiểu dữ liệu theo Backend Format
    Backend->>DB: UPDATE bảng DBConnection (Lưu đè cột meta_schema)
    activate DB
    DB-->>Backend: Báo thành công
    deactivate DB
    
    Backend-->>IDE: Thông báo lưu hoàn tất (Status 200 OK)
    deactivate Backend
    
    IDE->>UI_State: Xóa cảnh báo "Unsaved Changes"
    IDE-->>User: Hiển thị Toast Success "Schema saved successfully"
```
