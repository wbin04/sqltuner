# Hướng dẫn Triển khai Database Connection

## Tổng quan
Triển khai này hỗ trợ **Unified Workspace Model** cho SQLTuner, cho phép cả **Real Database Connections** và **Virtual Simulations** sử dụng cách tiếp cận lưu trữ thống nhất.

## Điều mới

### 1. Thay đổi Database Schema
- Thêm giá trị `simulation` vào enum `db_type`
- Thêm cột `meta_schema` JSONB cho lưu trữ schema thống nhất
- Làm cho các trường connection (`host`, `db_password`, `db_name`) nullable để hỗ trợ simulation

### 2. Components mới

#### Pydantic Models (`backend/app/schemas/schema_def.py`)
- `ColumnDef`: Định nghĩa cột với name, type, nullable, primary key flags
- `ForeignKeyDef`: Định nghĩa mối quan hệ foreign key
- `TableDef`: Cấu trúc bảng hoàn chỉnh với columns, foreign keys, sample data
- `SchemaDef`: Schema cơ sở dữ liệu đầy đủ chứa nhiều bảng

#### Services

**Inspector Service** (`backend/app/services/inspector_service.py`)
- `sync_schema(db, connection_id)`: Kết nối đến cơ sở dữ liệu thực và trích xuất schema thành JSON

**Simulation Service** (`backend/app/services/simulation_service.py`)
- `update_table_metadata(db, connection_id, schema_update)`: Cập nhật virtual schema
- `generate_ddl_script(schema_def)`: Chuyển đổi JSON schema thành SQL DDL
- `generate_ddl_for_connection(db, connection_id)`: Tạo DDL cho connection cụ thể

#### API Endpoints (`backend/app/api/v1/endpoints/connections.py`)

**POST /api/v1/connections/**
- Tạo connection mới (real hoặc simulation)
- Cho real DB: Cung cấp host, port, username, password, db_name
- Cho simulation: Chỉ cung cấp name và db_type='simulation'

**POST /api/v1/connections/{id}/sync** (Chỉ Real DB)
- Đồng bộ schema từ cơ sở dữ liệu thực đến meta_schema JSON
- Ví dụ response:
```json
{
  "success": true,
  "message": "Schema synchronized successfully",
  "tables_count": 5,
  "schema": {...}
}
```

**PUT /api/v1/connections/{id}/schema** (Chỉ Simulation)
- Cập nhật virtual schema cho simulation connections
- Request body: Cấu trúc SchemaDef đầy đủ
- Ví dụ:
```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        {"name": "id", "type": "UUID", "is_pk": true, "is_nullable": false},
        {"name": "email", "type": "VARCHAR(255)", "is_pk": false, "is_nullable": false}
      ],
      "foreign_keys": []
    }
  ]
}
```

**GET /api/v1/connections/{id}/schema**
- Lấy metadata schema đã cache (hoạt động cho cả real và simulation)

**GET /api/v1/connections/{id}/ddl**
- Tạo script SQL DDL từ schema
- Trả về plain text CREATE TABLE statements
- Hữu ích cho AI context và documentation

## Các bước Migration

### Tùy chọn 1: Sử dụng Alembic (Khuyến nghị)
```bash
cd backend
alembic upgrade head
```

### Tùy chọn 2: Sử dụng Raw SQL
```bash
psql -U your_user -d sqltuner_db -f backend/alembic/versions/migration.sql
```

## Ví dụ Sử dụng

### 1. Tạo Real Database Connection
```bash
curl -X POST "http://localhost:8000/api/v1/connections/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production PostgreSQL",
    "db_type": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "dbuser",
    "password": "secret123",
    "db_name": "mydb"
  }'
```

### 2. Đồng bộ Schema từ Real Database
```bash
curl -X POST "http://localhost:8000/api/v1/connections/{connection_id}/sync"
```

### 3. Tạo Simulation Connection
```bash
curl -X POST "http://localhost:8000/api/v1/connections/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Virtual E-commerce DB",
    "db_type": "simulation"
  }'
```

### 4. Cập nhật Simulation Schema
```bash
curl -X PUT "http://localhost:8000/api/v1/connections/{connection_id}/schema" \
  -H "Content-Type: application/json" \
  -d '{
    "tables": [
      {
        "name": "products",
        "columns": [
          {"name": "id", "type": "INTEGER", "is_pk": true, "is_nullable": false},
          {"name": "name", "type": "VARCHAR(200)", "is_pk": false, "is_nullable": false},
          {"name": "price", "type": "DECIMAL(10,2)", "is_pk": false, "is_nullable": false}
        ],
        "foreign_keys": [],
        "sample_data": [
          {"id": 1, "name": "Laptop", "price": "999.99"},
          {"id": 2, "name": "Mouse", "price": "29.99"}
        ]
      }
    ]
  }'
```

### 5. Lấy DDL Script cho AI Context
```bash
curl -X GET "http://localhost:8000/api/v1/connections/{connection_id}/ddl"
```

Output:
```sql
-- Generated DDL Script from Schema Definition
-- This script can be used as context for AI query generation

CREATE TABLE products (
    id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id)
);

-- Sample data for products
INSERT INTO products (id, name, price) VALUES (1, 'Laptop', '999.99');
INSERT INTO products (id, name, price) VALUES (2, 'Mouse', '29.99');
```

## Luồng Architecture

### Real Database Connection
1. User tạo connection với credentials
2. System mã hóa password và lưu thông tin connection
3. User kích hoạt sync endpoint
4. Inspector service kết nối đến real DB
5. Schema metadata được trích xuất và lưu vào `meta_schema`
6. Schema có thể được sử dụng cho AI query generation

### Simulation Connection
1. User tạo simulation connection (không cần credentials)
2. User định nghĩa virtual schema qua PUT /schema endpoint
3. Schema được lưu trong `meta_schema` như JSON
4. DDL có thể được tạo cho AI context
5. Không cần kết nối cơ sở dữ liệu thực

## Lợi ích

1. **Unified Storage**: Cả real và virtual schemas đều sử dụng cùng trường `meta_schema`
2. **AI-Ready**: DDL generation cung cấp context hoàn hảo cho LLM query optimization
3. **Flexible**: Test queries đối với virtual schemas mà không cần real databases
4. **Secure**: Real database credentials được mã hóa, simulations không cần credentials
5. **Cacheable**: Real DB schemas được cache để giảm repeated inspections

## Files Được Tạo/Sửa đổi

### Files mới
- `backend/app/schemas/schema_def.py` - Pydantic models cho validation schema
- `backend/app/services/simulation_service.py` - Quản lý Virtual DB
- `backend/alembic/versions/add_simulation_support.py` - Alembic migration
- `backend/alembic/versions/migration.sql` - Raw SQL migration

### Files được sửa đổi
- `backend/app/models/models.py` - Updated DBConnection model
- `backend/app/schemas/connection.py` - Updated connection schemas
- `backend/app/services/inspector_service.py` - Added sync_schema method
- `backend/app/api/v1/endpoints/connections.py` - New endpoints

## Testing

Test implementation:

```python
# Test creating simulation
import requests

# Create simulation
response = requests.post(
    "http://localhost:8000/api/v1/connections/",
    json={
        "name": "Test Simulation",
        "db_type": "simulation"
    }
)
conn_id = response.json()["id"]

# Update schema
schema = {
    "tables": [
        {
            "name": "users",
            "columns": [
                {"name": "id", "type": "UUID", "is_pk": True, "is_nullable": False},
                {"name": "email", "type": "VARCHAR(255)", "is_pk": False, "is_nullable": False}
            ],
            "foreign_keys": []
        }
    ]
}

requests.put(
    f"http://localhost:8000/api/v1/connections/{conn_id}/schema",
    json=schema
)

# Get DDL
ddl = requests.get(f"http://localhost:8000/api/v1/connections/{conn_id}/ddl")
print(ddl.text)
```

## Next Steps

1. Run the migration
2. Test API endpoints
3. Integrate with frontend
4. Connect to LLM service for query generation
5. Add user authentication to endpoints