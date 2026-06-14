```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database

    Note over User, DB: Execute SQL Flow Started
    
    User->>UI: Click "Execute" button on the SQL code block
    UI->>UI: Open Results Panel & Show "Loading" state
    UI->>Backend: Send Execute SQL API request (Connection ID, SQL statement)
    
    activate Backend
    
    %% Begin Sandbox Environment Setup
    Note over Backend, DB: --- Sandbox Environment Setup (SQLite) ---
    Backend->>Backend: Initialize Storage Database (Engine: sqlite:///:memory:)
    activate DB
    
    Backend->>DB: Create Virtual Schema (CREATE TABLE)<br/>(With Type Mapping from PostgreSQL -> SQLite)
    Backend->>DB: Data Seeding (INSERT OR IGNORE)
    
    Backend->>Backend: Parse & Split original SQL into single Statements
    Backend->>DB: Send and sequentially Execute each SQL Statement
    
    alt Valid Query (Success)
        DB-->>Backend: Return raw results (Raw Rows, Execution Time)
        Backend->>Backend: Process data (Count rows, Truncate if result is too large)
        Backend-->>UI: Return pre-formatted JSON structure (Columns, Rows, Metadata)
        
        opt If data is Truncated
            UI->>UI: Display "Truncation Warning"
        end
        UI->>UI: Render Data Table on the screen
        UI-->>User: User views table/column structure results
        
        opt Extended Interaction
            User->>UI: Click a cell containing JSON/Object data
            UI->>UI: Open JSON Viewer Modal for details
        end

    else Invalid Query (Syntax Error / Missing Table...)
        DB-->>Backend: Report Database Error
        deactivate DB
        Backend-->>UI: Return error code and failure reason
        deactivate Backend
        
        UI->>UI: Extract Error Message
        UI->>UI: Trigger SQL Error Suggestion Generator
        UI-->>User: Display red dialog containing Specific Error + Fix Suggestion
    end

```