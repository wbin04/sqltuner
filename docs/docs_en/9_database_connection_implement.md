# Database Connection Implementation Guide

## Overview
This implementation supports the **Unified Workspace Model** for SQLTuner, allowing both **Real Database Connections** and **Virtual Simulations** using a unified storage approach.

## What's New

### 1. Database Schema Changes
- Added `simulation` value to `db_type` enum
- Added `meta_schema` JSONB column for unified schema storage
- Made connection fields (`host`, `db_password`, `db_name`) nullable for simulation support

### 2. New Components

#### Pydantic Models (`backend/app/schemas/schema_def.py`)
- `ColumnDef`: Column definition with name, type, nullable, primary key flags
- `ForeignKeyDef`: Foreign key relationship definition
- `TableDef`: Complete table structure with columns, foreign keys, sample data
- `SchemaDef`: Full database schema containing multiple tables

#### Services

**Inspector Service** (`backend/app/services/inspector_service.py`)
- `sync_schema(db, connection_id)`: Connects to real database and extracts schema to JSON

**Simulation Service** (`backend/app/services/simulation_service.py`)
- `update_table_metadata(db, connection_id, schema_update)`: Updates virtual schema
- `generate_ddl_script(schema_def)`: Converts JSON schema to SQL DDL
- `generate_ddl_for_connection(db, connection_id)`: Generates DDL for specific connection

#### API Endpoints (`backend/app/api/v1/endpoints/connections.py`)

**POST /api/v1/connections/**
- Create new connection (real or simulation)
- For real DB: Provide host, port, username, password, db_name
- For simulation: Only provide name and db_type='simulation'

**POST /api/v1/connections/{id}/sync** (Real DB only)
- Syncs schema from real database to meta_schema JSON
- Example response:
```json
{
  "success": true,
  "message": "Schema synchronized successfully",
  "tables_count": 5,
  "schema": {...}
}
```

**PUT /api/v1/connections/{id}/schema** (Simulation only)
- Updates virtual schema for simulation connections
- Request body: Full SchemaDef structure
- Example:
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
- Retrieves cached schema metadata (works for both real and simulation)

**GET /api/v1/connections/{id}/ddl**
- Generates SQL DDL script from schema
- Returns plain text CREATE TABLE statements
- Useful for AI context and documentation

## Migration Steps

### Option 1: Using Alembic (Recommended)
```bash
cd backend
alembic upgrade head
```

### Option 2: Using Raw SQL
```bash
psql -U your_user -d sqltuner_db -f backend/alembic/versions/migration.sql
```

## Usage Examples

### 1. Create a Real Database Connection
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

### 2. Sync Schema from Real Database
```bash
curl -X POST "http://localhost:8000/api/v1/connections/{connection_id}/sync"
```

### 3. Create a Simulation Connection
```bash
curl -X POST "http://localhost:8000/api/v1/connections/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Virtual E-commerce DB",
    "db_type": "simulation"
  }'
```

### 4. Update Simulation Schema
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

### 5. Get DDL Script for AI Context
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

## Architecture Flow

### Real Database Connection
1. User creates connection with credentials
2. System encrypts password and stores connection info
3. User triggers sync endpoint
4. Inspector service connects to real DB
5. Schema metadata extracted and saved to `meta_schema`
6. Schema can be used for AI query generation

### Simulation Connection
1. User creates simulation connection (no credentials needed)
2. User defines virtual schema via PUT /schema endpoint
3. Schema stored in `meta_schema` as JSON
4. DDL can be generated for AI context
5. No actual database connection needed

## Benefits

1. **Unified Storage**: Both real and virtual schemas use the same `meta_schema` field
2. **AI-Ready**: DDL generation provides perfect context for LLM query optimization
3. **Flexible**: Test queries against virtual schemas without real databases
4. **Secure**: Real database credentials encrypted, simulations need no credentials
5. **Cacheable**: Real DB schemas cached to reduce repeated inspections

## Files Created/Modified

### New Files
- `backend/app/schemas/schema_def.py` - Pydantic models for schema validation
- `backend/app/services/simulation_service.py` - Virtual DB management
- `backend/alembic/versions/add_simulation_support.py` - Alembic migration
- `backend/alembic/versions/migration.sql` - Raw SQL migration

### Modified Files
- `backend/app/models/models.py` - Updated DBConnection model
- `backend/app/schemas/connection.py` - Updated connection schemas
- `backend/app/services/inspector_service.py` - Added sync_schema method
- `backend/app/api/v1/endpoints/connections.py` - New endpoints

## Testing

Test the implementation:

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
