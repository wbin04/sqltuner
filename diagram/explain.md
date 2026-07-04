```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database

    Note over User, DB: Explain Query Plan Flow Started
    
    User->>UI: Click "Explain" button on the SQL code block
    UI->>UI: Open Explain Modal & Switch state to "Analyzing..."
    UI->>Backend: Send Analysis request API (Connection ID, SQL statement)
    
    activate Backend
    Backend->>DB: Request connection parameters (Workspace/Connection)
    DB-->>Backend: Return connection parameters (With Schema if Simulation)
    
    alt Is Simulation Environment (Sandbox)
        Note over Backend, DB: --- Analysis on in-memory SQLite ---
        Backend->>Backend: Initialize Storage Database (sqlite:///:memory:)
        Backend->>DB: Rebuild entire Virtual Schema and Data Seeding
        
        activate DB
        Backend->>DB: Execute "EXPLAIN QUERY PLAN <sql>"
        DB-->>Backend: Return raw SQLite Plan results
        Backend->>DB: Actual execute "<sql>" to get runtime and row count
        DB-->>Backend: Return Runtime Stats
        deactivate DB
        
    else Is Real DB Environment (MySQL / PostgreSQL)
        Note over Backend, DB: --- Analysis on Live Server DB ---
        Backend->>DB: Connect directly to Real DB via SQLAlchemy
        
        activate DB
        Backend->>DB: Execute "EXPLAIN <sql>"
        DB-->>Backend: Return general execution plan (Query Plan)
        
        opt Support EXPLAIN ANALYZE
            Backend->>DB: Execute "EXPLAIN ANALYZE <sql>"
            DB-->>Backend: Return detailed runtime execution statistics
        end
        deactivate DB
    end
    
    Backend->>Backend: Process and Group standard formatted explanation data
    Backend-->>UI: Return JSON (Plan Columns, Rows, Analyze Support Flag, Runtime)
    deactivate Backend
    
    UI->>UI: Close Loading Screen & Update UI
    UI-->>User: Display Explain Details (Execution steps, Cost, Actual Runtime)
```
