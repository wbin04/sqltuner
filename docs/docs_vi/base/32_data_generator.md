# VAI TRÒ
Bạn là một Kỹ sư Full-Stack Cấp cao (Python/FastAPI + React).
Người dùng muốn triển khai một **"Trình tạo dữ liệu giả thông minh"** cho Không gian mô phỏng.
**MỤC TIÊU:** Cho phép người dùng tạo ngay lập tức 100-1000 hàng dữ liệu mẫu thực tế cho một bảng đã chọn bằng cách sử dụng thư viện `Faker`.

# NGĂN XẾP CÔNG NGHỆ
- **Backend:** Python, FastAPI, thư viện `Faker`.
- **Frontend:** React, Tailwind CSS (bên trong `TableEditor.tsx` hiện có).

# YÊU CẦU

## 1. Triển khai Backend

### A. Cài đặt Phụ thuộc
Giả sử `pip install faker` được chạy.

### B. Tạo Dịch vụ: `MockDataService`
Tạo một dịch vụ ánh xạ Định nghĩa Cột sang các nhà cung cấp Faker dựa trên chiến lược "Heuristic Thông minh".

**Ưu tiên Logic:**
1.  **Khớp theo Tên:** Kiểm tra tên cột (không phân biệt chữ hoa chữ thường).
    - `email` -> `faker.email()`
    - `name`, `fullname`, `user` -> `faker.name()`
    - `phone`, `mobile` -> `faker.phone_number()`
    - `address`, `city`, `country` -> `faker.address()`, v.v.
    - `created_at`, `updated_at` -> `faker.date_time_this_year()`
2.  **Khớp theo Loại:** Nếu tên không khớp, kiểm tra `type`.
    - `UUID` -> `str(uuid.uuid4())`
    - `INTEGER` -> `faker.random_int(min=1, max=1000)`
    - `BOOLEAN` -> `faker.boolean()`
    - `TIMESTAMP`, `DATE` -> `faker.iso8601()`
    - `VARCHAR`, `TEXT` -> `faker.text(max_nb_chars=20)`

### C. Điểm cuối API
Tạo `POST /api/v1/simulation/generate-data`.

**Thân yêu cầu:**
```json
{
  "count": 100,
  "columns": [
    { "name": "id", "type": "UUID", "is_pk": true },
    { "name": "email", "type": "VARCHAR" },
    { "name": "age", "type": "INTEGER" }
  ]
}
```

**Phản hồi:**
```json
[
  { "id": "uuid-...", "email": "bob@example.com", "age": 25 },
  ...
]
```

---

## 2. Triển khai Frontend (`TableEditor.tsx`)

### A. Cập nhật UI (Tab: Dữ liệu Mẫu)
Trong tab "Dữ liệu Mẫu", thêm một Thanh công cụ phía trên lưới.
- **Nút:** `[Tạo Dữ liệu]` (Sử dụng biểu tượng `Sparkles` từ lucide-react).
- **Popover/Modal:** Khi nhấp, hiển thị một popup nhỏ:
  - Đầu vào: "Số hàng" (Mặc định: 50, Tối đa: 1000).
  - Nút: "Tạo".

### B. Logic Tích hợp
1.  Khi "Tạo" được nhấp, gọi API với các cột của bảng hiện tại và số lượng yêu cầu.
2.  **Cập nhật Trạng thái:**
    - Nhận mảng hàng từ API.
    - **Thêm** (hoặc Thay thế) các hàng này vào `table.sample_data` hiện có trong trạng thái `meta_schema` cục bộ.
    - Cập nhật `table.row_count`.
    - Hiển thị thông báo thành công.

# VÍ DỤ CẤU TRÚC MÃ

## Backend (Dịch vụ)
```python
from faker import Faker
fake = Faker()

class MockDataService:
    @staticmethod
    def generate(columns: list, count: int) -> list:
        results = []
        for _ in range(count):
            row = {}
            for col in columns:
                row[col.name] = MockDataService._get_value(col.name, col.type)
            results.append(row)
        return results

    @staticmethod
    def _get_value(name: str, dtype: str):
        name = name.lower()
        if 'email' in name: return fake.email()
        if 'name' in name: return fake.name()
        # ... logic for types ...
        return fake.word()
```

## Frontend (Thành phần)
```tsx
// Inside SampleDataTab component
const handleGenerate = async (count: number) => {
  setIsLoading(true);
  try {
    const newRows = await api.generateMockData({ columns: table.columns, count });
    // Update local state (Immer or standard state)
    updateTableData(table.name, (draft) => {
       draft.sample_data.push(...newRows);
       draft.row_count += newRows.length;
    });
  } finally {
    setIsLoading(false);
  }
};
```

# SẢN PHẨM GIAO
1.  Mã đầy đủ cho `backend/app/services/mock_data_service.py`.
2.  Mã router API đã cập nhật.
3.  `TableEditor.tsx` đã cập nhật (hoặc `SampleDataTab.tsx`) với UI và tích hợp API.