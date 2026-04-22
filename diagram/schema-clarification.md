```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant AI as AI / LLM

    Note over User, AI: Bắt đầu luồng Khử Mơ Hồ (Clarification) Thiết kế Schema
    
    User->>UI: Yêu cầu tạo mới cấu trúc csdl (Vd: "Tạo DB quản lý bán hàng")
    UI->>Backend: Gửi Text (Tạo cuộc hội thoại mới)
    
    activate Backend
    Backend->>Backend: Detect Intent: Là yêu cầu thiết kế Schema
    
    %% Phase 1: Kiểm tra có cần làm rõ yêu cầu không
    Backend->>AI: Gửi Prompt Phân Tích (Hỏi AI xem Requirement này đã đủ chưa?)
    activate AI
    AI-->>Backend: Thiếu thông tin! Trả về danh sách câu hỏi làm rõ (Kèm Options)
    deactivate AI
    
    Backend-->>UI: Trả về Message đặc biệt (Có chứa cờ "Before designing the schema...")
    deactivate Backend
    
    UI->>UI: Parser phát hiện cờ Clarification -> Ẩn Text thường
    UI->>UI: Render Component "ClarificationBlock" tương tác
    UI-->>User: Hiển thị các câu hỏi trắc nghiệm/Tự luận để người dùng chọn

    %% Người dùng Cung Cấp Thông tin Bổ Sung
    Note over User, UI: Người dùng Cung Cấp Thông tin Bổ Sung

    User->>UI: Trả lời/Chọn Options cho từng câu & Nhấn Submit
    UI->>Backend: Gửi API `/chat` chứa mảng "clarification_answers"
    
    activate Backend
    %% Phase 2: Áp dụng câu trả lời vào sinh cấu trúc thật
    Backend->>AI: Gửi Prompt Sinh Schema (Yêu cầu gốc + Bộ câu trả lời đã thu thập)
    activate AI
    AI-->>Backend: Phân tích sâu 2 lớp & Trả về Cấu trúc Json (Tables, Columns, Refs) hoàn chỉnh
    deactivate AI
    
    Backend-->>UI: Trả về cấu trúc Schema Generated Data
    deactivate Backend
    
    UI->>UI: Cập nhật giao diện: Đóng/Minimize Form Câu Hỏi (Báo success)
    UI->>UI: Render Component "Schema Block" 
    UI-->>User: Hiển thị giao diện danh sách Bảng & Cho phép "Apply to Sandbox"
```
