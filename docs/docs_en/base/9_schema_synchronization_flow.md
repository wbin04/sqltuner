# Schema Synchronization Flow

## Mermaid Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant API as API Layer<br/>(FastAPI Endpoint)
    participant Service as Schema Service
    participant Security as Security Util
    participant InternalDB as Internal DB<br/>(PostgreSQL)
    participant TargetDB as Target DB<br/>(User's Database)
    
    Client->>API: POST /connections/{id}/sync
    Note over Client,API: Request: { force: false }
    
    API->>API: Validate permissions<br/>(TODO: Check user auth)
    
    API->>InternalDB: Get connection details<br/>SELECT * FROM db_connections WHERE id = ?
    InternalDB-->>API: Return connection object
    
    alt Connection not found
        API-->>Client: 404 Not Found
    end
    
    alt Cache exists AND force=false
        API-->>Client: Return cached schema
    end
    
    API->>Service: sync_connection_schema(connection_id, db, force)
    
    Service->>Security: decrypt_password(encrypted_password)
    Security-->>Service: Plain password
    
    Service->>Service: Build connection string<br/>postgresql://user:pass@host:port/db
    
    Service->>TargetDB: Create temporary engine<br/>Test connection
    
    alt Connection failed
        TargetDB-->>Service: Connection error
        Service-->>API: { success: false, message: "..." }
        API-->>Client: 400 Bad Request
    end
    
    TargetDB-->>Service: Connection successful
    
    Service->>TargetDB: inspector = inspect(engine)<br/>Get table names
    TargetDB-->>Service: List of tables
    
    loop For each table
        Service->>TargetDB: Get columns metadata<br/>inspector.get_columns(table_name)
        TargetDB-->>Service: Column info (name, type, nullable, default)
        
        Service->>TargetDB: Get primary keys<br/>inspector.get_pk_constraint(table_name)
        TargetDB-->>Service: PK columns
        
        Service->>TargetDB: Get foreign keys<br/>inspector.get_foreign_keys(table_name)
        TargetDB-->>Service: FK constraints
        
        Service->>Service: Format to LLM-optimized JSON<br/>{ name, type, pk?, fk? }
    end
    
    Service->>Service: Dispose temporary engine<br/>Close connection
    
    Service->>InternalDB: UPDATE db_connections<br/>SET metadata_cache = schema_json<br/>WHERE id = ?
    InternalDB-->>Service: Update successful
    
    Service-->>API: { success: true, tables_count: N, schema: {...} }
    API-->>Client: 200 OK<br/>Return schema metadata
    
    Note over Client,TargetDB: Schema is now cached and ready for LLM context
```

## Flow Description

### 1. Client Trigger
- Client sends `POST /connections/{id}/sync` with optional `force` parameter
- The `force` flag determines whether to bypass cached schema

### 2. API Layer Validation
- Validates that the connection exists in the internal database
- **TODO**: Check user permissions to ensure they own this connection
- Returns cached schema if available and `force=false`

### 3. Service Layer Processing
- Retrieves connection details from `db_connections` table
- Decrypts the stored password using the Security utility

### 4. Target Database Connection
- Builds connection string based on database type (Postgres/MySQL)
- Creates a temporary synchronous SQLAlchemy engine
- Tests connection with timeout (10 seconds)
- If connection fails, returns error to client

### 5. Schema Inspection
- Uses `sqlalchemy.inspect(engine)` to introspect the database
- Iterates through all tables in the target database
- For each table, extracts:
  - **Columns**: name, data type, nullable, default value
  - **Primary Keys**: identifies PK columns
  - **Foreign Keys**: maps to referenced table.column

### 6. Data Formatting
- Converts raw metadata to LLM-optimized JSON format
- Minimizes token usage by:
  - Using short keys (`pk`, `fk` instead of full words)
  - Omitting nullable if true (default assumption)
  - Compact type representation

**Example Output Format:**
```json
{
  "users": [
    {"name": "id", "type": "UUID", "pk": true},
    {"name": "email", "type": "VARCHAR(255)"},
    {"name": "role", "type": "user_role", "default": "user"}
  ],
  "db_connections": [
    {"name": "id", "type": "UUID", "pk": true},
    {"name": "user_id", "type": "UUID", "fk": "users.id"},
    {"name": "metadata_cache", "type": "JSONB", "nullable": true}
  ]
}
```

### 7. Storage & Response
- Updates the `metadata_cache` JSONB field in the `db_connections` table
- Disposes of the temporary database engine
- Returns success response with table count and schema data

### 8. Error Handling
- **Connection not found**: Returns 404
- **Database unreachable**: Returns 400 with connection error
- **Authentication failed**: Returns 400 with auth error
- **Decryption failed**: Returns 400 with decryption error
- **Unexpected errors**: Returns 400 with generic error message

## Security Considerations

1. **Password Encryption**: Database passwords are encrypted at rest using Fernet symmetric encryption
2. **Temporary Connections**: Engine is disposed immediately after use
3. **Read-Only Operations**: Schema inspection does not modify target database
4. **No Data Extraction**: Only metadata is retrieved, never row data
5. **Connection Timeout**: 10-second timeout prevents hanging connections

## Performance Optimization

1. **Caching**: Schema is cached in JSONB field to avoid repeated connections
2. **Force Sync**: Optional `force` parameter allows cache invalidation
3. **Connection Pooling**: Disabled for temporary inspection connections
4. **Token Efficiency**: LLM-optimized format reduces token usage in AI prompts
