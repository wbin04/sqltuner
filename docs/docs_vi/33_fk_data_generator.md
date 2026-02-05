# VAI TRÒ
Bạn là một Kỹ sư Backend Cấp cao (Python/FastAPI).
Người dùng muốn triển khai một dịch vụ **"Trình tạo dữ liệu giả thông minh"** cho công cụ mô phỏng cơ sở dữ liệu.

# MỤC TIÊU
Triển khai `MockDataService` tạo dữ liệu mẫu thực tế cho một bảng đã cho.
**YÊU CẦU QUAN TRỌNG:** Trình tạo phải tôn trọng **Tính toàn vẹn Khóa Ngoại** và sử dụng **Heuristic Thông minh** để đoán loại dữ liệu dựa trên tên cột.

# YÊU CẦU

## 1. Chiến lược Logic (3 Lớp Dự phòng)

Khi tạo giá trị cho một cột cụ thể, áp dụng thứ tự ưu tiên này:

1.  **Ưu tiên 1: Tra cứu Khóa Ngoại (Tính toàn vẹn Tham chiếu)**
    - Kiểm tra xem cột có phải là Khóa Ngoại không.
    - Nếu CÓ: Tra cứu Bảng Cha trong `meta_schema`.
    - Thu thập tất cả ID hiện có từ `sample_data` của Bảng Cha.
    - Chọn một giá trị ngẫu nhiên bằng `random.choice()`.
    - *Dự phòng:* Nếu Bảng Cha không có dữ liệu, trả về `None` (nếu có thể null) hoặc giá trị ngẫu nhiên (với cảnh báo ghi log).

2.  **Ưu tiên 2: Khớp Tên Ngữ nghĩa (Regex)**
    - Nếu KHÔNG phải FK, kiểm tra **Tên** cột với các mẫu regex.
    - Ví dụ: `email` -> `faker.email()`, `phone` -> `faker.phone_number()`, `created_at` -> `faker.iso8601()`.

3.  **Ưu tiên 3: Dự phòng Loại Dữ liệu**
    - Nếu tên không khớp, tạo dựa trên **Loại SQL**.
    - Phân tích `VARCHAR(n)` để đảm bảo độ dài chuỗi tạo < `n`.
    - Ánh xạ `UUID` -> `uuid4`, `INTEGER` -> `random_int`, `BOOLEAN` -> `bool`.

## 2. Chi tiết Triển khai (`MockDataService.py`)

Refactor hoặc tạo dịch vụ với cấu trúc sau:

```python
import random
import re
from typing import List, Dict, Any, Optional
from faker import Faker

fake = Faker()

class MockDataService:
    
    # --- MẪU REGEX CHO KHỚP NGỮ NGHĨA ---
    NAME_PATTERNS = {
        r'email': fake.email,
        r'(full)?name': fake.name,
        r'first_?name': fake.first_name,
        r'last_?name': fake.last_name,
        r'phone|mobile': fake.phone_number,
        r'address': fake.address,
        r'city': fake.city,
        r'country': fake.country,
        r'company': fake.company,
        r'job|title': fake.job,
        r'date|time|created|updated': fake.date_time_this_year,
        r'status': lambda: random.choice(['active', 'inactive', 'pending', 'draft']),
        r'price|cost|amount': lambda: round(random.uniform(10, 1000), 2),
        r'qty|quantity|count': lambda: random.randint(1, 100),
        r'avatar|image|photo': fake.image_url,
    }

    # --- ÁNH XẠ LOẠI CHO DỰ PHÒNG ---
    TYPE_MAPPERS = {
        'UUID': fake.uuid4,
        'INTEGER': lambda: random.randint(1, 1000),
        'INT': lambda: random.randint(1, 1000),
        'BOOLEAN': fake.boolean,
        'BOOL': fake.boolean,
        'FLOAT': lambda: round(random.uniform(0, 1000), 2),
        'DECIMAL': lambda: round(random.uniform(0, 1000), 2),
        'TIMESTAMP': lambda: fake.iso8601(),
        'DATE': lambda: fake.date_this_decade().isoformat(),
        'JSON': lambda: fake.json(),
        'JSONB': lambda: fake.json(),
    }

    @staticmethod
    def generate(table_name: str, schema_json: Dict[str, Any], count: int) -> List[Dict[str, Any]]:
        """
        Điểm vào chính để tạo hàng.
        """
        # 1. Tìm bảng mục tiêu
        target_table = next((t for t in schema_json['tables'] if t['name'] == table_name), None)
        if not target_table:
            raise ValueError(f"Không tìm thấy bảng {table_name} trong schema")

        columns = target_table.get('columns', [])
        foreign_keys = target_table.get('foreign_keys', [])

        # 2. Tính toán trước Nhóm Giá trị FK (Tối ưu hóa)
        # Từ điển ánh xạ: col_name -> danh sách ID cha hợp lệ
        fk_pools = {}
        
        for fk in foreign_keys:
            col_name = fk['column']
            ref_table_name = fk['ref_table']
            ref_col_name = fk['ref_column']

            # Tìm bảng cha
            parent_table = next((t for t in schema_json['tables'] if t['name'] == ref_table_name), None)
            
            valid_values = []
            if parent_table and 'sample_data' in parent_table:
                # Trích xuất ID hợp lệ
                valid_values = [
                    row.get(ref_col_name) 
                    for row in parent_table['sample_data'] 
                    if row.get(ref_col_name) is not None
                ]
            
            fk_pools[col_name] = valid_values

        # 3. Tạo Hàng
        results = []
        for _ in range(count):
            row = {}
            for col in columns:
                col_name = col['name']
                col_type = col['type']
                
                # --- KIỂM TRA 1: KHÓA NGOẠI ---
                if col_name in fk_pools:
                    options = fk_pools[col_name]
                    if options:
                        row[col_name] = random.choice(options)
                    else:
                        # Giảm nhẹ: Bảng cha trống -> Tạo ngẫu nhiên hoặc None
                        row[col_name] = MockDataService._get_value(col_name, col_type)
                
                # --- KIỂM TRA 2: KHÓA CHÍNH (UUID) ---
                elif col.get('is_pk') and 'UUID' in col_type.upper():
                    row[col_name] = fake.uuid4()
                
                # --- KIỂM TRA 3: GIÁ TRỊ THÔNG MINH ---
                else:
                    row[col_name] = MockDataService._get_value(col_name, col_type)
            
            results.append(row)

        return results

    @staticmethod
    def _get_value(col_name: str, col_type: str):
        """
        Quyết định giá trị dựa trên Tên (Regex) hoặc Loại (Dự phòng)
        """
        col_name_lower = col_name.lower()
        base_type, length = MockDataService._parse_sql_type(col_type)

        # A. Khớp Ngữ nghĩa
        for pattern, provider in MockDataService.NAME_PATTERNS.items():
            if re.search(pattern, col_name_lower):
                val = provider()
                # Cắt chuỗi nếu quá dài cho VARCHAR(n)
                if isinstance(val, str) and length and len(val) > length:
                    return val[:length]
                return val

        # B. Khớp Loại
        # Xử lý ràng buộc độ dài VARCHAR/CHAR
        if base_type in ['VARCHAR', 'CHAR', 'STRING', 'TEXT']:
            max_len = length if length else 50
            # Nếu rất ngắn (ví dụ: code), tạo chữ cái ngẫu nhiên
            if max_len < 15:
                return fake.lexify('?' * max_len)
            return fake.text(max_nb_chars=min(max_len, 200))

        # Xử lý các loại khác
        if base_type in MockDataService.TYPE_MAPPERS:
            return MockDataService.TYPE_MAPPERS[base_type]()

        return None

    @staticmethod
    def _parse_sql_type(raw_type: str):
        """
        Trích xuất loại cơ sở và độ dài. 
        Ví dụ: "VARCHAR(255)" -> ("VARCHAR", 255)
        """
        raw_type = raw_type.upper().strip()
        match = re.match(r'^([A-Z]+)(?:\((\d+)\))?$', raw_type)
        if match:
            base = match.group(1)
            length = int(match.group(2)) if match.group(2) else None
            return base, length
        return raw_type, None
```

## 3. Điểm Tích hợp (`/api/v1/simulation.py`)

Cập nhật điểm cuối để truyền **toàn bộ `meta_schema`** cho dịch vụ, không chỉ danh sách cột, để dịch vụ có thể thực hiện tra cứu FK.

```python
@router.post("/generate-data")
async def generate_mock_data(
    request: GenerateDataRequest, # { table_name: str, count: int }
    # ... dependencies ...
):
    # ... load connection ...
    
    new_rows = MockDataService.generate(
        table_name=request.table_name,
        schema_json=connection.metadata_cache, # Truyền schema đầy đủ
        count=request.count
    )
    
    # ... logic để thêm new_rows vào connection.metadata_cache ...
    # ... save to DB ...
    
    return {"status": "success", "rows": new_rows}
```

# SẢN PHẨM GIAO
1.  Lớp `MockDataService` hoàn chỉnh với logic trên.
2.  Điểm cuối API đã cập nhật xử lý ngữ cảnh schema đầy đủ.