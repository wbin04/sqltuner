# VAI TRÒ
Bạn là một Kỹ sư Backend Cấp cao.
Người dùng đang gặp vấn đề với `MockDataService`: **"Bản ghi Mồ côi"**.
Nếu người dùng tạo dữ liệu cho Bảng Con (ví dụ: `orders`) *trước* khi Bảng Cha (ví dụ: `users`) được điền, các Khóa Ngoại được tạo ngẫu nhiên, phá vỡ tính toàn vẹn join.

# MỤC TIÊU
Nâng cấp `MockDataService.generate` để triển khai **Tạo đệ quy**.
**Logic:** Nếu Bảng Cha được tham chiếu trống, tự động tạo một lô nhỏ dữ liệu cho Bảng Cha trước, sau đó tiếp tục với Bảng Con.

# YÊU CẦU

## 1. Cập nhật Logic: Điền đệ quy
Sửa đổi phương thức `generate` để kiểm tra tính khả dụng dữ liệu bảng cha.

-   **Bước 1:** Xác định cột FK.
-   **Bước 2:** Kiểm tra Bảng Cha trong `schema_json`.
-   **Bước 3:** Nếu `sample_data` của Bảng Cha trống:
    -   **HÀNH ĐỘNG:** Gọi đệ quy `MockDataService.generate(parent_table, ...)` để tạo 10-20 hàng mẫu cho cha.
    -   **CẬP NHẬT:** Thêm các hàng mới này vào `sample_data` của Bảng Cha trong đối tượng `schema_json` (cập nhật trong bộ nhớ) để chúng khả dụng cho quá trình tạo hiện tại.
-   **Bước 4:** Tiếp tục chọn một ID ngẫu nhiên từ Bảng Cha đã điền.

## 2. Cơ chế An toàn: Độ sâu Đệ quy
Thêm tham số `recursion_depth` để ngăn vòng lặp vô hạn (ví dụ: Bảng A -> Bảng B -> Bảng A). Dừng đệ quy nếu độ sâu > 3.

## 3. Triển khai (`MockDataService.py`)

```python
import random
from typing import List, Dict, Any, Optional
from faker import Faker

fake = Faker()

class MockDataService:
    
    # ... (Giữ NAME_PATTERNS và TYPE_MAPPERS) ...

    @staticmethod
    def generate(
        table_name: str, 
        schema_json: Dict[str, Any], 
        count: int,
        recursion_depth: int = 0
    ) -> List[Dict[str, Any]]:
        
        # 0. Kiểm tra An toàn
        if recursion_depth > 3:
            print(f"⚠️ Đạt độ sâu đệ quy tối đa cho {table_name}. Bỏ qua tự tạo FK.")
            return []

        # 1. Tìm Bảng Mục tiêu
        target_table = next((t for t in schema_json['tables'] if t['name'] == table_name), None)
        if not target_table:
            raise ValueError(f"Không tìm thấy bảng {table_name}")

        columns = target_table.get('columns', [])
        foreign_keys = target_table.get('foreign_keys', [])

        # --- BƯỚC 1: CHUẨN BỊ NHÓM FK (Với Tự tạo Đệ quy) ---
        fk_pools = {}
        
        for fk in foreign_keys:
            col_name = fk['column']
            ref_table_name = fk['ref_table']
            ref_col_name = fk['ref_column']

            parent_table = next((t for t in schema_json['tables'] if t['name'] == ref_table_name), None)
            
            if parent_table:
                # KIỂM TRA: Cha có trống không?
                existing_data = parent_table.get('sample_data', [])
                
                if not existing_data:
                    # >>> PHÉP MÀU ĐỆ QUY XẢY RA Ở ĐÂY <<<
                    print(f"🔄 Tự tạo dữ liệu cha cho '{ref_table_name}' (yêu cầu bởi '{table_name}')...")
                    
                    # Tạo một lô nhỏ (ví dụ: 10 hàng) cho cha
                    parent_rows = MockDataService.generate(
                        table_name=ref_table_name,
                        schema_json=schema_json, # Truyền đối tượng schema CÙNG
                        count=10, # Lô nhỏ cho phụ thuộc
                        recursion_depth=recursion_depth + 1
                    )
                    
                    # QUAN TRỌNG: Cập nhật schema trong bộ nhớ để các cột khác có thể sử dụng
                    if 'sample_data' not in parent_table:
                        parent_table['sample_data'] = []
                    parent_table['sample_data'].extend(parent_rows)
                    parent_table['row_count'] = len(parent_table['sample_data'])
                    
                    existing_data = parent_table['sample_data']

                # Bây giờ trích xuất ID
                valid_values = [
                    row.get(ref_col_name) 
                    for row in existing_data 
                    if row.get(ref_col_name) is not None
                ]
                fk_pools[col_name] = valid_values

        # --- BƯỚC 2: TẠO HÀNG (Tiêu chuẩn) ---
        results = []
        for _ in range(count):
            row = {}
            for col in columns:
                col_name = col['name']
                col_type = col['type']
                
                if col_name in fk_pools:
                    options = fk_pools[col_name]
                    if options:
                        row[col_name] = random.choice(options)
                    else:
                        row[col_name] = MockDataService._get_value(col_name, col_type)
                
                # ... (Logic PK và Tiêu chuẩn) ...
                elif col.get('is_pk') and 'UUID' in col_type.upper():
                    row[col_name] = fake.uuid4()
                else:
                    row[col_name] = MockDataService._get_value(col_name, col_type)
            
            results.append(row)

        return results
```

## 4. Cân nhắc Phản hồi API
Vì dịch vụ có thể sửa đổi *các* bảng khác (cha), API cần trả về **Schema Đã cập nhật Toàn bộ** (hoặc ít nhất chỉ ra bảng nào được cập nhật), không chỉ hàng cho bảng yêu cầu.

**Cập nhật Logic Điểm cuối API:**
1. Gọi `MockDataService.generate`.
2. Vì `schema_json` được truyền theo tham chiếu (trong dict Python), `parent_table['sample_data']` được cập nhật tại chỗ bên trong dịch vụ.
3. Lưu **toàn bộ** `schema_json` đã cập nhật trở lại cơ sở dữ liệu (`metadata_cache`).
4. Trả về schema đầy đủ đã cập nhật cho Frontend để UI làm mới dữ liệu *cả* Bảng Con và Cha.

# SẢN PHẨM GIAO
1.  `MockDataService` đã cập nhật với logic đệ quy.
2.  Điểm cuối API đã cập nhật để lưu và trả về sửa đổi schema đầy đủ.