# VAI TRÒ
Bạn là một Kỹ sư Full-Stack cấp cao (React + FastAPI/Python).
Người dùng muốn triển khai tính năng **"Không gian Làm việc Mô phỏng"**. Điều này cho phép người dùng thiết kế schema cơ sở dữ liệu ảo (Bảng, Cột, Mối quan hệ) và nhập dữ liệu mẫu mà không cần kết nối với cơ sở dữ liệu vật lý thực tế.

# TỔNG QUAN KIẾN TRÚC
- **Lưu trữ:** Schema ảo và dữ liệu sẽ được lưu trữ hoàn toàn trong cột `metadata_cache` (JSONB) của bảng `db_connections` trong PostgreSQL.
- **Loại DB:** Các kết nối này sẽ có `db_type = 'simulation'`.
- **Backend:** Tái sử dụng API kết nối hiện có nhưng nới lỏng xác thực cho loại mô phỏng (không cần host/port).
- **Frontend:** GUI phong phú "Schema Designer" để tạo bảng, định nghĩa cột và nhập hàng mẫu.

# ĐẦU RA

## 1. Triển khai Backend (FastAPI)

### A. Cấu trúc Dữ liệu (JSON Schema)
Định nghĩa cấu trúc cho `metadata_cache` khi `db_type == 'simulation'`.
**Yêu cầu:** JSON phải trông như thế này:
```json
{
  "is_simulation": true,
  "tables": [
    {
      "id": "uuid_v4",
      "name": "users",
      "columns": [
        {
          "id": "uuid_v4",
          "name": "id",
          "type": "UUID", // Enum: UUID, VARCHAR, INTEGER, BOOLEAN, TIMESTAMP, TEXT, JSON
          "is_pk": true,
          "is_nullable": false,
          "fk_target": null // or { "table_id": "...", "column_id": "..." } if FK
        }
      ],
      "sample_data": [
        { "id": "1", "name": "Alice" },
        { "id": "2", "name": "Bob" }
      ]
    }
  ]
}
```

### B. Cập nhật API (`/api/v1/connections`)
1. **Tạo Kết nối (`POST`):**
   - Nới lỏng xác thực: Nếu `db_type` là "simulation", cho phép `host`, `port`, `username`, `password` là null/rỗng.
   - Khởi tạo `metadata_cache` với schema rỗng mặc định `{"is_simulation": true, "tables": []}`.
2. **Cập nhật Schema (`PUT /api/v1/connections/{id}/simulation-schema`):**
   - Một endpoint mới (hoặc cập nhật PUT hiện có) để lưu toàn bộ JSON schema được thiết kế bởi frontend vào `metadata_cache`.

---

## 2. Triển khai Frontend (React)

### A. Cập nhật Modal Tạo Không gian Làm việc
Cập nhật `CreateWorkspaceModal` hiện có.
- **Chọn Chế độ:** Thêm toggle/card cho "Chế độ Mô phỏng" vs "Kết nối Cơ sở dữ liệu".
- **Form:** Nếu "Mô phỏng" được chọn, ẩn các trường Host/Port/Auth. Chỉ hiển thị "Tên Không gian Làm việc".
- **Action:** Gửi `db_type: 'simulation'` đến API.

### B. Giao diện "Schema Designer" (Tính năng Chính)
Tạo trang/thành phần mới `SimulationDesigner.tsx`. Đây là Trình chỉnh sửa DB No-Code.

#### **WIREFRAME & LAYOUT**
```text
+-----------------------------------------------------------------------+
|  < Back   Workspace: E-Commerce Sim               [ Save Changes ]    |
+----------------------+------------------------------------------------+
|  TABLES              |  Table: USERS                                  |
|                      |                                                |
|  [ + New Table    ]  |  [ TAB: Structure ]    [ TAB: Sample Data ]    |
|                      |                                                |
|  > users             |  +------------------------------------------+  |
|    products          |  | Name   | Type     | PK  | Null | FK      |  |
|    orders            |  |--------|----------|-----|------|---------|  |
|                      |  | id     | [UUID v] | [x] | [ ]  | -       |  |
|                      |  | email  | [VARCH ] | [ ] | [ ]  | -       |  |
|                      |  | role   | [INT  v] | [ ] | [ ]  | -       |  |
|                      |  | dept_id| [UUID v] | [ ] | [ ]  | [Config]|  |
|                      |  +------------------------------------------+  |
|                      |  ( + Add Column )                              |
|                      |                                                |
|                      |  *FK Config Modal: Select Table > Select Col* |
+----------------------+------------------------------------------------+
```

### C. Yêu cầu Logic Thành phần
1. **Quản lý Trạng thái:**
   - Sử dụng trạng thái cục bộ (hoặc Context/Zustand) để giữ toàn bộ đối tượng JSON Schema. KHÔNG thực hiện API calls trên mỗi lần nhấn phím.
   - Chỉ gọi API khi người dùng nhấp **[Save Changes]**.
2. **Tab 1: Trình chỉnh sửa Cấu trúc:**
   - Cho phép thêm/xóa cột.
   - **Loại Dữ liệu:** Cung cấp dropdown của các loại mô phỏng tiêu chuẩn (UUID, INT, VARCHAR, v.v.).
   - **Logic Khóa Ngoại:**
     - Cung cấp UI (Popover hoặc Modal) để chọn *Bảng Mục tiêu* và *Cột Mục tiêu*.
     - Xác thực rằng Cột Mục tiêu tồn tại và là Khóa Chính (khuyến nghị).
3. **Tab 2: Trình chỉnh sửa Dữ liệu Mẫu:**
   - Lưới giống bảng tính (sử dụng `ag-grid` hoặc bảng HTML động).
   - cột = Các cột được định nghĩa trong tab Cấu trúc.
   - hàng = mảng `sample_data`.
   - Cho phép thêm/chỉnh sửa hàng trực tiếp.

# CÁC BƯỚC TRIỂN KHAI
1. **Backend:** Sửa đổi mô hình Pydantic để làm cho các trường kết nối tùy chọn. Triển khai logic Tạo cho mô phỏng.
2. **Frontend:** Cập nhật Modal Tạo.
3. **Frontend:** Xây dựng layout `SimulationDesigner` (Sidebar + Tabs).
4. **Frontend:** Triển khai Trình chỉnh sửa Cột với lựa chọn Loại.
5. **Frontend:** Triển khai liên kết Khóa Ngoại (Kết nối `dept_id` -> `departments.id`).

# HƯỚNG DẪN LẬP TRÌNH
- Sử dụng **Tailwind CSS** cho styling (tương thích chế độ Dark/Light).
- Sử dụng **Lucide React** cho icons (Table, Plus, Save, Key, Link).
- Đảm bảo UI xử lý "Trạng thái Rỗng" (ví dụ: khi không có bảng nào được chọn).