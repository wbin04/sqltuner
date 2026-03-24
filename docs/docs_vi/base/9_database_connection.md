# Database Connection Management

## Tổng quan
SQLTuner hỗ trợ kết nối đến nhiều loại cơ sở dữ liệu khác nhau và cung cấp giao diện thống nhất để quản lý các kết nối này.

## Các Loại Database Được Hỗ trợ

### PostgreSQL
- **Version**: 17 (khuyến nghị)
- **Driver**: psycopg2-binary
- **Connection String**: `postgresql://user:password@host:port/database`

### MySQL/MariaDB
- **Version**: 8.0+ (MySQL), 10.6+ (MariaDB)
- **Driver**: pymysql
- **Connection String**: `mysql://user:password@host:port/database`

### SQL Server
- **Version**: 2019+
- **Driver**: pyodbc
- **Connection String**: `mssql+pyodbc://user:password@host:port/database`

### SQLite
- **Version**: 3.x
- **Driver**: sqlite3 (built-in)
- **Connection String**: `sqlite:///path/to/database.db`

## Cấu trúc Database Connection

### Model Database
```python
class DBConnection(Base):
    __tablename__ = "db_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    db_type = Column(Enum(DBType), nullable=False)
    host = Column(String(255))
    port = Column(Integer)
    username = Column(String(255))
    db_password = Column(String(500))  # Encrypted
    db_name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
```

### Enum DBType
```python
class DBType(str, Enum):
    POSTGRES = "postgres"
    MYSQL = "mysql"
    MSSQL = "mssql"
    SQLITE = "sqlite"
    SIMULATION = "simulation"  # For virtual databases
```

## API Endpoints

### Tạo Connection Mới
```
POST /api/v1/connections/
```

**Request Body**:
```json
{
  "name": "Production Database",
  "db_type": "postgres",
  "host": "localhost",
  "port": 5432,
  "username": "dbuser",
  "password": "secure_password",
  "db_name": "production_db"
}
```

**Response**:
```json
{
  "id": "uuid-here",
  "name": "Production Database",
  "db_type": "postgres",
  "host": "localhost",
  "port": 5432,
  "username": "dbuser",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Lấy Danh sách Connections
```
GET /api/v1/connections/
```

**Response**:
```json
[
  {
    "id": "uuid-1",
    "name": "Production DB",
    "db_type": "postgres",
    "host": "prod.example.com",
    "port": 5432,
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid-2",
    "name": "Test DB",
    "db_type": "mysql",
    "host": "test.example.com",
    "port": 3306,
    "created_at": "2024-01-02T00:00:00Z"
  }
]
```

### Cập nhật Connection
```
PUT /api/v1/connections/{connection_id}
```

### Xóa Connection
```
DELETE /api/v1/connections/{connection_id}
```

### Test Connection
```
POST /api/v1/connections/{connection_id}/test
```

**Response**:
```json
{
  "success": true,
  "message": "Connection successful",
  "database_version": "PostgreSQL 17.0"
}
```

## Bảo mật

### Mã hóa Password
- Password được mã hóa bằng AES-256 trước khi lưu vào database
- Key mã hóa được lưu trong environment variables
- Password chỉ được giải mã khi cần thiết cho connection testing

### Environment Variables
```bash
# Database encryption key (generate random 32-byte key)
DB_ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Database connection for SQLTuner itself
DATABASE_URL=postgresql://user:password@localhost/sqltuner_db
```

## Connection Pooling

### SQLAlchemy Engine Configuration
```python
from sqlalchemy import create_engine

def create_db_engine(connection_string: str):
    return create_engine(
        connection_string,
        pool_size=10,
        max_overflow=20,
        pool_timeout=30,
        pool_recycle=3600,
        echo=False
    )
```

### Connection Pool Settings
- **pool_size**: Số connection tối đa trong pool (default: 10)
- **max_overflow**: Số connection overflow cho phép (default: 20)
- **pool_timeout**: Timeout khi chờ connection (default: 30s)
- **pool_recycle**: Recycle connection sau N giây (default: 3600s)

## Error Handling

### Connection Errors
```python
try:
    engine = create_engine(connection_string)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
except OperationalError as e:
    if "connection refused" in str(e).lower():
        raise HTTPException(
            status_code=400,
            detail="Cannot connect to database server"
        )
    elif "authentication failed" in str(e).lower():
        raise HTTPException(
            status_code=401,
            detail="Invalid database credentials"
        )
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection error: {str(e)}"
        )
```

### Common Error Messages
- **Connection refused**: Server không chạy hoặc firewall block
- **Authentication failed**: Sai username/password
- **Database does not exist**: Database name không đúng
- **Timeout**: Connection timeout (thường do network issues)

## Testing Connections

### Unit Tests
```python
def test_connection_success():
    # Mock successful connection
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.connect.return_value.__enter__.return_value = mock_conn

    with patch('sqlalchemy.create_engine', return_value=mock_engine):
        result = test_database_connection(connection_params)
        assert result["success"] is True

def test_connection_failure():
    # Mock connection failure
    with patch('sqlalchemy.create_engine', side_effect=OperationalError("Connection failed", None, None)):
        result = test_database_connection(connection_params)
        assert result["success"] is False
        assert "Connection failed" in result["message"]
```

### Integration Tests
```python
@pytest.fixture
def test_db():
    # Create test database
    engine = create_engine("postgresql://test:test@localhost/test_db")
    Base.metadata.create_all(engine)
    yield engine
    # Cleanup
    Base.metadata.drop_all(engine)

def test_full_connection_lifecycle(test_db):
    # Test create, test, update, delete connection
    pass
```

## Monitoring và Logging

### Connection Metrics
- Số connection active
- Connection pool utilization
- Failed connection attempts
- Query execution time

### Logging
```python
import logging

logger = logging.getLogger(__name__)

def log_connection_attempt(connection_id: str, success: bool, error: str = None):
    if success:
        logger.info(f"Connection {connection_id} established successfully")
    else:
        logger.error(f"Connection {connection_id} failed: {error}")
```

## Best Practices

### 1. Connection Management
- Luôn close connections sau khi sử dụng
- Sử dụng context managers cho database operations
- Monitor connection pool usage

### 2. Security
- Không log sensitive information (passwords, connection strings)
- Validate input parameters
- Use parameterized queries để tránh SQL injection

### 3. Performance
- Reuse connections từ pool
- Set appropriate timeouts
- Monitor slow queries

### 4. Error Handling
- Provide meaningful error messages
- Log errors for debugging
- Graceful degradation khi connection fails

## Migration Scripts

### Alembic Migration
```python
# alembic/versions/add_db_connections.py
def upgrade():
    op.create_table(
        'db_connections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('db_type', sa.Enum('POSTGRES', 'MYSQL', 'MSSQL', 'SQLITE'), nullable=False),
        sa.Column('host', sa.String(255), nullable=True),
        sa.Column('port', sa.Integer(), nullable=True),
        sa.Column('username', sa.String(255), nullable=True),
        sa.Column('db_password', sa.String(500), nullable=True),
        sa.Column('db_name', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('db_connections')
```

## Troubleshooting

### Common Issues

1. **Driver not installed**
   ```
   pip install psycopg2-binary pymysql pyodbc
   ```

2. **Connection timeout**
   - Check network connectivity
   - Increase timeout settings
   - Check firewall rules

3. **Authentication issues**
   - Verify credentials
   - Check user permissions
   - Ensure database exists

4. **SSL connection issues**
   - Add `sslmode=require` to connection string
   - Provide SSL certificates if required

### Debug Mode
```python
# Enable SQLAlchemy echo for debugging
engine = create_engine(connection_string, echo=True)
```

This will log all SQL statements executed.