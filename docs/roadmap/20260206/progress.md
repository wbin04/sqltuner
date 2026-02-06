# TỔNG QUAN HỆ THỐNG SQLTUNER

**SQLTuner** là ứng dụng web toàn diện giúp kết nối cơ sở dữ liệu, đồng bộ schema, tích hợp AI để tạo/giải thích/tối ưu SQL, và phân tích hiệu năng truy vấn.

* **Chế độ hoạt động:** Hỗ trợ 2 chế độ:
    1.  **Real Database:** Kết nối trực tiếp tới DB thật (PostgreSQL, MySQL).
    2.  **Simulation:** Mô phỏng bằng schema ảo và dữ liệu mẫu (sử dụng SQLite In-Memory).
* **Kiến trúc:** Frontend Web (React), Backend API (FastAPI), Kho dữ liệu nội bộ (PostgreSQL), và AI Engine (Local LLM).

---

## DANH SÁCH CHỨC NĂNG CHI TIẾT

### 1. Xác thực và Phân quyền (Authentication & Authorization)
* **Đăng nhập cơ bản:** Hỗ trợ Email/Password.
* **Session Management:**
    * Sử dụng cơ chế **Refresh Session** (HttpOnly Cookies) để duy trì đăng nhập an toàn.
    * Quản lý phiên đăng nhập theo thiết bị (User Agent, IP).
* **Social Login:** Tích hợp **Google OAuth**:
    * Backend nhận callback.
    * Tự động tạo hoặc ghép nối tài khoản nội bộ.
    * Tạo phiên làm việc và chuyển hướng mượt mà về Frontend.
* **Phân quyền (RBAC):**
    * Vai trò: **User** (Người dùng thường) và **Admin** (Quản trị viên).
    * Giao diện điều hướng và ẩn/hiện chức năng dựa trên vai trò.

### 2. Quản lý Workspace & Kết nối
* **Tạo Workspace:** Người dùng khởi tạo không gian làm việc với:
    * Tên dự án.
    * Loại kết nối: `PostgreSQL`, `MySQL` hoặc `Simulation`.
* **Lưu trữ:** Mã hóa thông tin kết nối và lưu trạng thái đồng bộ schema.
* **Chế độ Simulation:**
    * Không yêu cầu Host/Port/Password.
    * Backend tự khởi tạo một Schema rỗng (Blank Slate) để người dùng bắt đầu thiết kế.

### 3. Đồng bộ và Quản lý Schema
* **Sync Engine:** Tự động đọc cấu trúc bảng, cột, khóa ngoại (FK), và chỉ mục (Index) từ DB thật.
* **Caching:** Lưu Schema vào Metadata Cache để làm ngữ cảnh (Context) cho AI và hiển thị nhanh trên UI.
* **Schema Viewer:**
    * Dạng danh sách (List View).
    * Dạng sơ đồ thực thể (ER Diagram).
    * Hỗ trợ tra cứu nhanh cột, khóa, index.

### 4. Trình soạn thảo SQL & Chat AI (AI-Powered Editor)
* **Giao diện Chat:** Khu vực nhập liệu hỗ trợ dán code SQL hoặc câu hỏi tự nhiên.
* **Intent Detection (Phát hiện ý định):**
    * *Input là SQL:* Kích hoạt Prompt chuyên sâu về phân tích cú pháp, tối ưu, explain.
    * *Input là câu hỏi:* Kích hoạt Prompt tổng quát (General Q&A).
* **Context-Aware Prompting:** Prompt động tự điều chỉnh theo hệ quản trị (Postgres vs MySQL) để đảm bảo cú pháp chính xác.
* **Kết quả trả về:** Định dạng Markdown kỹ thuật, bao gồm: Ý định truy vấn, Cảnh báo rủi ro (Performance Risk), và Gợi ý cải thiện.

### 5. Thực thi Truy vấn (Query Execution)
* **Real Database:** Backend mở kết nối, chạy query, trả về Rows + Execution Time.
* **Simulation Sandbox:**
    * Backend dựng **SQLite In-Memory** tức thời.
    * Hydrate (đổ) Schema và Dữ liệu mẫu từ JSON vào SQLite.
    * Thực thi query trên môi trường giả lập này.
* **Multi-statement:** Hỗ trợ chạy nhiều lệnh cùng lúc (Ví dụ: `CREATE INDEX...; SELECT...`).

### 6. Giải thích Truy vấn (Explain Plan)
* **Cơ chế:** Gọi lệnh `EXPLAIN` (hoặc `EXPLAIN ANALYZE`) xuống DB.
* **Output:**
    * Chi phí (Cost).
    * Thời gian thực thi (Execution Time).
    * Cấu trúc Plan (Scan type, Join type) để hiển thị hoặc lưu lịch sử.
* **Mục đích:** Làm nền tảng dữ liệu cho tính năng Tối ưu hóa.

### 7. Tối ưu Truy vấn bằng AI (AI Query Optimizer)
* **Quy trình:** Lấy Execution Plan -> AI phân tích điểm nghẽn (Bottleneck) -> Đề xuất giải pháp.
* **Smart Context:** AI chỉ nhận thông tin Schema của các bảng *thực sự tham gia* trong query (giảm token thừa, tránh hallucination).
* **Kết quả:**
    * SQL được viết lại (Rewritten SQL).
    * Lý do tối ưu.
    * Khuyến nghị tạo Index (CREATE INDEX statements).
* **Action:** Nút "Apply" để thay thế SQL cũ hoặc chạy thử nghiệm ngay.

### 8. Lịch sử & Nhật ký (Audit Log)
* Lưu trữ toàn bộ phiên Chat, Explain, và Optimization.
* Phân loại hành động rõ ràng.
* Cho phép xem lại kết quả cũ mà không cần gọi lại AI (Tiết kiệm chi phí token).

### 9. Simulation Workspace (Database Designer)
* **Chức năng:** Cho phép người dùng tự thiết kế DB từ con số 0.
* **Actions:** Thêm/Sửa/Xóa Bảng, Cột, Khóa ngoại, Index.
* **Mock Data:** Nhập liệu mẫu cho từng bảng để phục vụ việc chạy thử SQL (Simulation Run).
* **Cơ chế lưu:** Toàn bộ Schema + Data được lưu trong Metadata JSON của Workspace, chỉ đồng bộ về server khi bấm "Save".

### 10. Sơ đồ ERD & Chỉnh sửa Trực quan (Visual Designer)
* **Visualization:** Vẽ sơ đồ quan hệ các bảng từ Schema hiện tại.
* **Interactive:**
    * Kéo thả (Drag & Drop) để tạo liên kết Khóa ngoại.
    * Sắp xếp vị trí các bảng.
* **Context Menu:** Chuột phải để tạo bảng mới, sửa bảng, xóa quan hệ ngay trên sơ đồ.

### 11. Trình chỉnh sửa Dữ liệu mẫu (Data Editor)
* **Grid System:**
    * Chống co hẹp cột (Fixed min-width).
    * Hỗ trợ cuộn ngang (Horizontal Scroll).
* **Smart Cells:**
    * View nhanh (Truncate text).
    * Sao chép nhanh (Copy button).
    * **Popover Editor:** Chỉnh sửa mở rộng cho nội dung văn bản dài.
    * **JSON Editor:** Modal chuyên biệt để xem và sửa dữ liệu kiểu JSON/JSONB.

### 12. Quản trị hệ thống (Admin Panel)
* Khu vực dành riêng cho Admin (Role-based UI).
* Chức năng:
    * Theo dõi danh sách người dùng.
    * Xem phản hồi (Feedback).
    * Giám sát hoạt động hệ thống.