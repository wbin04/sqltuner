```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant DB as Database

    Note over User, AI: Optimize SQL Flow Started
    
    User->>UI: Click "Optimize" button on the SQL code block
    UI->>Backend: Send Optimization request API (Connection ID, SQL)
    
    activate Backend
    Backend->>Backend: Initialize Optimization Service
    
    %% Step 1: Evaluate original query cost
    opt If not Simulation Environment (Real DB)
        Backend->>DB: Execute "EXPLAIN <original_sql>" for measurement
        DB-->>Backend: Return Original Cost & Execution Plan
        Backend->>Backend: Analyze Plan to find Bottlenecks
    end
    
    Backend->>Backend: Static Analysis of query to find Anti-patterns

    %% Step 2: Call AI for optimization
    Backend->>AI: Send Original SQL + DB Schema + Bottlenecks
    activate AI
    AI-->>Backend: Return New SQL + Index Suggestion + Explanation
    deactivate AI
    
    %% Step 3: Evaluate new query cost
    opt If requested with Explanation & is Real DB
        Backend->>DB: Execute "EXPLAIN <new_sql>" for measurement
        DB-->>Backend: Return Optimized Cost
        Backend->>Backend: Calculate Improvement Percent
    end
    
    Backend-->>UI: Return results (Old & New SQL, Bottlenecks, Improvement %, Index)
    deactivate Backend
    
    UI->>UI: Open Optimization Modal Popup
    UI-->>User: Show Visual Comparison (Before / After)

    %% Optional Apply Interaction
    opt User accepts optimization
        User->>UI: Click "Apply" on Modal
        UI->>UI: Close Modal & Insert new SQL with generated Index into Chat
        UI->>Backend: Send Execute request with new SQL (Return to Execute Flow)
    end
```
