```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database
    participant Extract as Extractor
    participant AI as AI / LLM

    Note over User, AI: Text-to-SQL Parsing and Auto-generation Flow
    
    User->>UI: Input natural language request <br/>(e.g., "Get March revenue from orders table")
    UI->>Backend: POST API `/completion` (request.message, connection_id)
    
    activate Backend
    Backend->>DB: Fetch Workspace info (Connection) from DB
    activate DB
    DB-->>Backend: Return Object containing `meta_schema` (JSON of whole Database)
    deactivate DB
    
    %% Schema Extraction Process
    Note over Backend, Extract: Start Context Extraction and Optimization Process
    
    Backend->>Extract: Input User's text and the complete meta_schema
    activate Extract
    
    Extract->>Extract: Scan (Matching) keywords to find Mentioned Tables
    
    alt If specific table found (e.g., "orders")
        Extract->>Extract: Build Detailed Schema (Limit to max 10 most relevant tables with FULL Columns & Foreign Keys)
    else No specific table mentioned
        Extract->>Extract: Build Compact Schema (List all tables but in a concise format to save tokens)
    end
    
    Extract-->>Backend: Return optimized formatted Schema Text string
    deactivate Extract
    
    %% Prompt Creation
    Backend->>Backend: Combine Schema Text + System Prompt (SQL Rules) + Chat History -> Final Prompt
    
    %% Call AI
    Backend->>AI: Send Final Prompt for analysis
    activate AI
    AI-->>Backend: Return response content containing code block ```sql ... ```
    deactivate AI
    
    Backend->>Backend: Parse to extract SQL statement from raw text
    
    Backend-->>UI: Return JSON (Message Content, sql_generated)
    deactivate Backend
    
    UI->>UI: Render new message Component UI
    UI-->>User: Display Visual SQL Block with "Execute" button
```
