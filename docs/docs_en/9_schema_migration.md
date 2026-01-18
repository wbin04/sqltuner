# ROLE
You are a Senior Python Backend Developer specializing in Database Internals and FastAPI. Your task is to design and implement the **"Schema Synchronization Service"** for the SQLTuner application.

# BUSINESS CONTEXT
- **Goal:** To allow the AI to understand the user's database structure without needing to query the live database constantly.
- **Process:** The system connects to a target database (Postgres/MySQL), extracts metadata (Tables, Columns, Types, Foreign Keys), and saves it as a simplified JSON cache in the internal database.
- **Constraint:** This process must be **Read-Only** on metadata. Do NOT fetch table rows (data).

# TECHNICAL STACK
- **Language:** Python 3.10+
- **Framework:** FastAPI
- **ORM:** SQLAlchemy (Async + Sync for inspection). *Note: `inspect()` usually requires a synchronous engine.*
- **Security:** Passwords in the DB are encrypted. You must decrypt them before connecting.

# DELIVERABLES

Please generate the following 2 parts:

## PART 1: Logic Flow & Sequence Diagram
Generate a Mermaid.js Sequence Diagram describing the flow:
1.  **Client** triggers `POST /connections/{id}/sync`.
2.  **API Layer** validates permissions.
3.  **Service Layer** retrieves connection details from Internal DB.
4.  **Security Util** decrypts the target DB password.
5.  **Inspector Service**:
    - Creates a temporary synchronous engine connection to the Target DB.
    - Uses `sqlalchemy.inspect(engine)`.
    - Iterates through all tables.
    - For each table: Gets Columns (Name, Type), Primary Keys, and Foreign Keys.
6.  **Data Formatter**: Converts raw metadata into a clean JSON structure optimized for LLM Context (e.g., minimizing token usage).
7.  **Storage**: Updates the `metadata_cache` (JSONB) field in the `DBConnection` table.

## PART 2: Implementation Code (Service Layer)
Write the Python function `sync_connection_schema(connection_id: UUID, db: Session)` in `app/services/schema_service.py`.

**Key requirements for the code:**
- **Input:** Connection ID.
- **Connection Handling:** Use `create_engine` dynamically based on the connection string constructed from decrypted credentials.
- **Inspector Usage:**
  ```python
  # Example logic style
  inspector = inspect(temp_engine)
  for table_name in inspector.get_table_names():
      columns = inspector.get_columns(table_name)
      # ... process columns ...
  ```
- **LLM-Optimized JSON Structure:**
  The output JSON should look like this (compact format):
  ```json
  {
    "table_name": [
      {"name": "id", "type": "INTEGER", "pk": true},
      {"name": "user_id", "type": "UUID", "fk": "users.id"}
    ]
  }
  ```
- **Error Handling:** Handle cases where the target DB is unreachable or authentication fails.