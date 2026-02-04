# VAI TRÒ
Bạn là một Kỹ sư Frontend cấp cao chuyên về React, TypeScript, và Quản lý Trạng thái Phức tạp.
Người dùng cho phép quản lý "Simulation Database" qua GUI.
Chúng ta đang xây dựng một component cốt lõi gọi là **`TableEditor.tsx`**.

# NGỮ CẢNH
- **Nguồn Dữ liệu:** Dữ liệu được tải từ trường `meta_schema` của một đối tượng kết nối.
- **Mục tiêu:** Người dùng cần Xem, Chỉnh sửa, Tạo, và Xóa Bảng, Cột, Chỉ mục, Khóa Ngoại, và Dữ liệu Mẫu.
- **Chiến lược Trạng thái:** Trạng thái cục bộ chỉnh sửa đối tượng JSON. Nút "Save" đẩy toàn bộ JSON trở lại backend.

# CẤU TRÚC DỮ LIỆU (Nguồn Sự Thật)
Meta_schema tuân theo cấu trúc JSON chính xác này. Vui lòng định nghĩa giao diện TypeScript khớp với điều này:

```json
{
  "tables": [
    {
      "name": "user",
      "row_count": 2,
      "columns": [
        {
          "name": "id",
          "type": "UUID", // Enum: UUID, VARCHAR, INTEGER, BOOLEAN, TIMESTAMP, TEXT, JSON
          "is_pk": true,
          "default": null,
          "is_nullable": false
        },
        { "name": "name", "type": "VARCHAR", "is_pk": false, "default": null, "is_nullable": true }
      ],
      "indexes": [
         // { "name": "idx_name", "unique": false, "column_names": ["name"] }
      ],
      "foreign_keys": [
         // { "column": "user_id", "ref_table": "user", "ref_column": "id" }
      ],
      "sample_data": [
        { "id": "c48c...", "name": "huy", "age": "22" } // Keys match column names
      ]
    }
  ]
}
```

# YÊU CẦU

## 1. Kiến trúc Component (`TableEditor.tsx`)
Component nên sử dụng **Bố cục Sidebar-Nội dung**.

### A. Sidebar (Danh sách Bảng)
- Liệt kê tất cả các bảng từ `meta_schema.tables`.
- **Hành động:**
  - `[+] Add Table`: Nhắc nhập tên bảng.
  - Delete Table (với xác nhận).
  - Tìm kiếm/Lọc bảng.

### B. Khu vực Nội dung Chính (Bảng Được Chọn)
Nếu một bảng được chọn, hiển thị chi tiết trong Tabs.

#### **Tab 1: Cấu trúc (Định nghĩa Schema)**
Đây là chế độ xem "Designer". Nó nên có 3 phần có thể thu gọn hoặc xếp chồng:

1.  **Trình chỉnh sửa Cột (Lưới):**
    - **Tiêu đề:** Tên | Loại | PK | Có thể null | Mặc định | Hành động
    - **Đầu vào:** Đầu vào có thể chỉnh sửa cho mỗi trường.
    - **Loại:** Dropdown (UUID, VARCHAR, INTEGER, v.v.).
    - **Xác thực:** PK không thể nullable.
    - **Hành động:** Di chuyển Lên/Xuống, Xóa Cột.

2.  **Trình chỉnh sửa Khóa Ngoại:**
    - Liệt kê FK hiện có.
    - **Thêm FK:** Chọn Cột Cục bộ -> Chọn Bảng Mục tiêu -> Chọn Cột Mục tiêu (Lọc Cột Mục tiêu chỉ PK).

3.  **Trình chỉnh sửa Chỉ mục:**
    - Liệt kê chỉ mục.
    - **Thêm Chỉ mục:** Nhập Tên, Chọn nhiều Cột, Checkbox "Unique".

#### **Tab 2: Dữ liệu Mẫu (Nhập Dữ liệu)**
Chế độ xem giống bảng tính để nhập dữ liệu giả.
- **Cột:** Động dựa trên các cột được định nghĩa trong Tab 1.
- **Hàng:** Ánh xạ đến `table.sample_data`.
- **Xác thực:**
  - Nếu một cột được đổi tên trong Tab 1, đảm bảo khóa dữ liệu trong Tab 2 được bảo toàn hoặc di chuyển.
  - Cập nhật `table.row_count` dựa trên độ dài mảng.

## 2. Chi tiết Triển khai Kỹ thuật

### Giao diện TypeScript
Định nghĩa nghiêm ngặt dựa trên JSON được cung cấp ở trên.
```typescript
interface ColumnDef {
  name: string;
  type: string;
  is_pk: boolean;
  default: string | null;
  is_nullable: boolean;
}

interface ForeignKeyDef {
  column: string;
  ref_table: string;
  ref_column: string;
}

interface IndexDef {
  name: string;
  columns: string[];
  is_unique: boolean;
}

interface TableDef {
  name: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  foreign_keys: ForeignKeyDef[];
  row_count: number;
  sample_data: Record<string, any>[];
}

interface MetaSchema {
  tables: TableDef[];
}
```

### Quản lý Trạng thái
- Sử dụng `useState` (hoặc `useImmer` cho cập nhật lồng nhau dễ dàng hơn) để giữ đối tượng `MetaSchema`.
- **Mô phỏng tự động lưu:** Thay đổi cập nhật trạng thái cục bộ ngay lập tức.
- **Lưu toàn cục:** Cung cấp callback prop cấp cao nhất `onSave(newSchema)` mà component cha gọi để hit API.

# HƯỚNG DẪN UI/UX
- **Phong cách:** Tailwind CSS (Chế độ Tối/Sáng).
- **Biểu tượng:** Lucide React (`Table`, `Key`, `Database`, `Plus`, `Trash2`).
- **Trạng thái Trống:** Nếu không có bảng được chọn, hiển thị placeholder "Chọn hoặc Tạo một Bảng".
- **Tương thích:** Đảm bảo Lưới Cột cuộn ngang nếu quá nhiều trường.

# SẢN PHẨM GIAO
Tạo mã cho `TableEditor.tsx` và các sub-components cần thiết (ví dụ: `ColumnRow`, `SampleDataGrid`) để triển khai đầy đủ logic này.