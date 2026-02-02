# Hydration và Auto Sync Data

## Tổng quan
Hydration là quá trình tự động điền dữ liệu mẫu vào virtual databases để hỗ trợ testing và development. Auto sync data đảm bảo dữ liệu giữa các environments được đồng bộ hóa.

## Các Loại Hydration

### 1. Schema-Based Hydration
Tự động tạo dữ liệu mẫu dựa trên cấu trúc bảng và relationships.

### 2. Template-Based Hydration
Sử dụng predefined templates cho các loại dữ liệu phổ biến (users, products, orders, etc.).

### 3. Custom Hydration
Cho phép users định nghĩa custom data generation rules.

## Architecture

### Components

#### HydrationService (`backend/app/services/hydration_service.py`)
```python
class HydrationService:
    def __init__(self, db: Session):
        self.db = db

    def hydrate_connection(self, connection_id: UUID, template: str = None) -> dict:
        """Hydrate a virtual connection with sample data"""
        pass

    def generate_sample_data(self, table_def: TableDef, count: int = 100) -> list[dict]:
        """Generate sample data for a table definition"""
        pass

    def sync_data_between_connections(self, source_id: UUID, target_id: UUID) -> dict:
        """Sync data from source to target connection"""
        pass
```

#### DataGenerator (`backend/app/services/data_generator.py`)
```python
class DataGenerator:
    def __init__(self):
        self.faker = Faker()

    def generate_for_column(self, column: ColumnDef) -> any:
        """Generate data based on column type and constraints"""
        pass

    def generate_user_data(self) -> dict:
        """Generate realistic user data"""
        return {
            "id": str(uuid.uuid4()),
            "email": self.faker.email(),
            "name": self.faker.name(),
            "created_at": self.faker.date_time_this_year()
        }

    def generate_product_data(self) -> dict:
        """Generate realistic product data"""
        return {
            "id": str(uuid.uuid4()),
            "name": self.faker.commerce.product_name(),
            "price": float(self.faker.commerce.price()),
            "category": self.faker.commerce.department(),
            "description": self.faker.text(max_nb_chars=200)
        }
```

## API Endpoints

### Hydrate Connection
```
POST /api/v1/connections/{connection_id}/hydrate
```

**Request Body**:
```json
{
  "template": "ecommerce",  // Optional: predefined template
  "row_count": 1000,       // Optional: number of rows per table
  "tables": ["users", "products", "orders"]  // Optional: specific tables
}
```

**Response**:
```json
{
  "success": true,
  "message": "Hydration completed successfully",
  "stats": {
    "users": 500,
    "products": 1000,
    "orders": 2000,
    "categories": 50
  },
  "duration_ms": 2500
}
```

### Sync Data Between Connections
```
POST /api/v1/connections/sync-data
```

**Request Body**:
```json
{
  "source_connection_id": "uuid-source",
  "target_connection_id": "uuid-target",
  "tables": ["users", "products"],
  "sync_mode": "incremental",  // full, incremental, merge
  "conflict_resolution": "source_wins"  // source_wins, target_wins, skip
}
```

**Response**:
```json
{
  "success": true,
  "message": "Data sync completed",
  "stats": {
    "tables_processed": 2,
    "rows_inserted": 150,
    "rows_updated": 25,
    "rows_skipped": 5,
    "conflicts_resolved": 3
  }
}
```

### Get Hydration Templates
```
GET /api/v1/hydration/templates
```

**Response**:
```json
[
  {
    "name": "ecommerce",
    "description": "E-commerce database with users, products, orders",
    "tables": ["users", "products", "categories", "orders", "order_items"],
    "estimated_rows": 5000
  },
  {
    "name": "blog",
    "description": "Blog platform with posts, comments, users",
    "tables": ["users", "posts", "comments", "tags"],
    "estimated_rows": 2000
  }
]
```

## Predefined Templates

### E-commerce Template
```json
{
  "tables": {
    "users": {
      "count": 500,
      "columns": {
        "id": "UUID",
        "email": "email",
        "name": "name",
        "created_at": "datetime"
      }
    },
    "products": {
      "count": 1000,
      "columns": {
        "id": "UUID",
        "name": "product_name",
        "price": "price",
        "category": "department",
        "description": "text"
      }
    },
    "orders": {
      "count": 2000,
      "columns": {
        "id": "UUID",
        "user_id": "foreign_key:users.id",
        "total": "calculated:sum(order_items.price * order_items.quantity)",
        "status": "enum:pending,processing,shipped,delivered",
        "created_at": "datetime"
      }
    }
  }
}
```

### Blog Template
```json
{
  "tables": {
    "posts": {
      "count": 200,
      "columns": {
        "id": "UUID",
        "title": "sentence",
        "content": "paragraphs",
        "author_id": "foreign_key:users.id",
        "published_at": "datetime",
        "status": "enum:draft,published"
      }
    },
    "comments": {
      "count": 1000,
      "columns": {
        "id": "UUID",
        "post_id": "foreign_key:posts.id",
        "user_id": "foreign_key:users.id",
        "content": "sentence",
        "created_at": "datetime"
      }
    }
  }
}
```

## Data Generation Rules

### Column Type Mapping
```python
DATA_TYPE_GENERATORS = {
    "UUID": lambda: str(uuid.uuid4()),
    "VARCHAR": lambda length=255: faker.text(max_nb_chars=min(length, 50)),
    "INTEGER": lambda: faker.random_int(min=1, max=1000000),
    "DECIMAL": lambda: round(faker.random_number(digits=8) / 100, 2),
    "BOOLEAN": lambda: faker.boolean(),
    "DATE": lambda: faker.date_this_decade(),
    "DATETIME": lambda: faker.date_time_this_year(),
    "TEXT": lambda: faker.paragraph(),
    "EMAIL": lambda: faker.email(),
    "PHONE": lambda: faker.phone_number(),
    "ADDRESS": lambda: faker.address(),
    "NAME": lambda: faker.name(),
    "COMPANY": lambda: faker.company()
}
```

### Foreign Key Handling
```python
def generate_foreign_key(self, table_name: str, column_name: str) -> str:
    """Generate valid foreign key value"""
    # Get existing values from referenced table
    referenced_values = self.get_existing_values(table_name, column_name)
    if referenced_values:
        return random.choice(referenced_values)
    else:
        # Generate new value if table is empty
        return self.generate_for_column_type(self.get_column_type(table_name, column_name))
```

## Auto Sync Features

### Incremental Sync
- Chỉ sync dữ liệu đã thay đổi (sử dụng timestamps hoặc version columns)
- Detect conflicts và resolve theo rules đã định nghĩa

### Full Sync
- Sync toàn bộ dữ liệu từ source đến target
- Useful cho initial setup hoặc khi cần reset data

### Merge Sync
- Merge dữ liệu từ multiple sources
- Handle conflicts thông minh dựa trên business rules

## Conflict Resolution Strategies

### Source Wins
- Dữ liệu từ source luôn override target data
- Simple nhưng có thể mất data quan trọng

### Target Wins
- Giữ nguyên target data, chỉ thêm new records
- Conservative approach, preserve existing data

### Manual Resolution
- Flag conflicts để user review và resolve manually
- Best cho critical data

### Timestamp-Based
- Compare last_modified timestamps
- Newer data wins

## Performance Optimization

### Batch Processing
```python
def batch_insert_data(self, table_name: str, data: list[dict], batch_size: int = 1000):
    """Insert data in batches to improve performance"""
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        self.db.execute(
            insert(self.get_table_model(table_name)),
            batch
        )
        self.db.commit()
```

### Parallel Processing
```python
async def hydrate_parallel(self, tables: list[str], row_counts: dict):
    """Hydrate multiple tables in parallel"""
    tasks = []
    for table in tables:
        task = asyncio.create_task(
            self.generate_table_data(table, row_counts.get(table, 100))
        )
        tasks.append(task)

    results = await asyncio.gather(*tasks)
    return dict(zip(tables, results))
```

## Monitoring và Logging

### Hydration Metrics
- Rows generated per table
- Generation time per table
- Memory usage
- Error rates

### Sync Metrics
- Tables processed
- Rows transferred
- Conflicts detected
- Sync duration

### Logging
```python
logger.info(f"Hydrated table {table_name} with {len(data)} rows in {duration:.2f}s")
logger.warning(f"Conflict detected in table {table_name}, row {row_id}: {conflict_details}")
```

## Error Handling

### Validation Errors
- Invalid foreign key references
- Constraint violations
- Data type mismatches

### Connection Errors
- Source/target connection failures
- Network timeouts
- Database locks

### Recovery Mechanisms
- Transaction rollbacks
- Partial sync recovery
- Checkpoint-based resumption

## Testing

### Unit Tests
```python
def test_data_generation():
    generator = DataGenerator()
    user_data = generator.generate_user_data()

    assert "email" in user_data
    assert "@" in user_data["email"]
    assert len(user_data["name"]) > 0

def test_foreign_key_generation():
    # Test FK generation with existing data
    pass
```

### Integration Tests
```python
def test_full_hydration_workflow():
    # Create virtual connection
    # Apply hydration
    # Verify data integrity
    # Test queries on hydrated data
    pass
```

## Best Practices

### 1. Data Quality
- Use realistic data patterns
- Maintain referential integrity
- Include edge cases và boundary values

### 2. Performance
- Generate data in batches
- Use async processing cho large datasets
- Monitor memory usage

### 3. Security
- Không generate sensitive data (passwords, PII) trong test environments
- Use faker libraries thay vì real data
- Clean up test data after use

### 4. Maintainability
- Template-driven approach cho reusability
- Version control cho templates
- Documentation cho custom rules

## Future Enhancements

### AI-Powered Generation
- Use LLM để generate more realistic data
- Learn from existing data patterns
- Generate data based on natural language descriptions

### Advanced Sync Features
- Bidirectional sync
- Real-time sync với change data capture
- Schema evolution handling

### Analytics Integration
- Data quality metrics
- Usage analytics
- Performance benchmarking