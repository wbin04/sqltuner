# ROLE
You are a Senior Backend Engineer specializing in Python (FastAPI), PostgreSQL (JSONB), and SQLAlchemy.
Your task is to implement the "Unified Workspace Model" for the SQLTuner project.

# GOAL
Refactor the Database Connection logic to support both "Real Database Connections" and "Virtual Simulations" using a unified storage approach.
Instead of storing SQL scripts or relying solely on live connections, we will store the Schema Metadata (Tables, Columns, Relationships) as a `JSONB` structure directly in the database.

# TARGET DATABASE SCHEMA (Visual Reference)
After the migration, the `db_connections` table and related types should look like this (Logic representation):

```sql
-- 1. Updated ENUM to include 'simulation'
TYPE db_type AS ENUM ('postgres', 'mysql', 'simulation');

-- 2. Updated Table Structure
CREATE TABLE db_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    
    -- Connection Params (Used for Real DBs, Nullable for Simulation)
    host VARCHAR(255), 
    port INT DEFAULT 5432,
    username VARCHAR(100),
    db_password VARCHAR(500),
    db_name VARCHAR(100),
    
    db_type db_type DEFAULT 'postgres',
    
    -- NEW: Unified Schema Storage
    -- Acts as a Cache for Real DBs and Source-of-Truth for Simulations
    meta_schema JSONB DEFAULT '{}'::jsonb, 
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

# REQUIREMENTS

## 1. SQL Migration Script
Generate a raw SQL script (or Alembic steps) to migrate the *existing* database to the *target* state.
- **Action 1:** Alter `db_type` type to add value `'simulation'`.
- **Action 2:** Add column `meta_schema` (JSONB) to `db_connections`.
- **Action 3:** Make connection fields (`host`, `db_password`, `db_name`, etc.) **NULLABLE** to accommodate simulations that don't need credentials.

## 2. Pydantic Models (`backend/app/schemas/schema_def.py`)
Define strict Pydantic models to validate the JSON structure stored in `meta_schema`.
**Structure:**
- **ColumnDef:** `name` (str), `type` (str), `is_pk` (bool), `is_nullable` (bool).
- **ForeignKeyDef:** `column` (str), `ref_table` (str), `ref_column` (str).
- **TableDef:** `name` (str), `columns` (List[ColumnDef]), `foreign_keys` (List[ForeignKeyDef]), `sample_data` (List[Dict] - Optional).
- **SchemaDef:** `tables` (List[TableDef]).

## 3. Services Implementation

### A. Inspector Service (`backend/app/services/inspector_service.py`)
Update logic to sync real DB state into `meta_schema`.
- **Function:** `sync_schema(db: Session, connection_id: UUID)`
- **Logic:**
  1. Retrieve connection details from `db_connections`.
  2. Use `sqlalchemy.inspect(engine)` to connect to the external Real DB.
  3. Iterate through tables, columns, and foreign keys.
  4. Map the retrieved metadata into `SchemaDef` Pydantic model.
  5. Update the `meta_schema` column in `db_connections` with this new JSON.

### B. Simulation Service (`backend/app/services/simulation_service.py`)
Create a new service for handling Virtual DBs.
- **Function:** `update_table_metadata(db: Session, connection_id: UUID, schema_update: SchemaDef)`
- **Logic:**
  1. Fetch `meta_schema` from DB.
  2. Merge/Overwrite the JSON with new data.
  3. Save back to DB.
- **Function:** `generate_ddl_script(connection_id: UUID) -> str`
- **Logic:**
  1. Read `meta_schema` JSON.
  2. Convert the JSON structure into a valid standard SQL string (`CREATE TABLE...`, `ALTER TABLE...`).
  3. Include `INSERT INTO` statements if `sample_data` exists in the JSON.
  4. This output will be used as Context for the AI Agent.

## 4. API Endpoints (`backend/app/api/v1/endpoints/connections.py`)
Implement or Update the following endpoints to manage the lifecycle of both Real and Simulation connections.

- **POST /api/v1/connections/**: Create a new connection.
  - **Input:** `ConnectionCreate` schema.
  - **Logic:**
    - If `db_type` is 'simulation': Create record with `host/port` as NULL and `meta_schema` = `{}`.
    - If `db_type` is 'postgres': Create record with provided credentials.
- **POST /api/v1/connections/{id}/sync**: (Real DB only)
  - **Logic:** Call `inspector_service.sync_schema(db, id)`.
  - **Return:** The updated `meta_schema` JSON.
- **PUT /api/v1/connections/{id}/schema**: (Simulation only)
  - **Input:** `SchemaDef` Pydantic model (The full schema structure).
  - **Logic:** Call `simulation_service.update_table_metadata` to overwrite the JSON structure.
- **GET /api/v1/connections/{id}/ddl**: (AI Context Helper)
  - **Logic:** Call `simulation_service.generate_ddl_script(id)`.
  - **Return:** Plain text (The generated SQL Script).

# DELIVERABLES
Please generate code for the following 5 files:

1.  **SQL Migration Script** (`migration.sql`): `ALTER TYPE` and `ALTER TABLE` commands.
2.  **`backend/app/schemas/schema_def.py`**: The Pydantic data structures.
3.  **`backend/app/services/inspector_service.py`**: The logic to inspect real DBs and dump to JSON.
4.  **`backend/app/services/simulation_service.py`**: The logic to manage JSON and convert JSON to SQL DDL.
5.  **`backend/app/api/v1/endpoints/connections.py`**: The API implementation including the new Sync and Schema endpoints.

# CONSTRAINTS
- Use `sqlalchemy.dialects.postgresql.JSONB` for the column type in models.
- Ensure Pydantic models utilize `model_dump(mode='json')` for serialization compatibility.
- Handle errors gracefully if a Real DB connection fails during sync (raise HTTP 400 or 500).