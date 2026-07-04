```sequenceDiagram
    autonumber
    
    actor User as User
    participant IDE as Schema IDE (TableEditor)
    participant Diagram as Visual Diagram (Diagram)
    participant UI_State as React State (Local Schema)
    participant Backend as Backend System
    participant DB as Storage DB (Workspace Data)

    Note over User, UI_State: Local Editing Process on Frontend
    
    alt Edit via Text-based Workspace (TableEditor)
        User->>IDE: Modify structure (Add Column, Primary Key, Edit Data)
        IDE->>UI_State: Update temporary JSON Schema object
    else Edit via Drag-and-drop Diagram (Edit Mode Diagram)
        User->>Diagram: Drag to create table, connect Foreign Key (Edge)
        Diagram->>UI_State: Update temporary JSON Schema object
    end
    
    UI_State-->>User: Interface displays red asterisk (*) "Unsaved Changes"

    Note over User, DB: Sync Process to Backend
    
    User->>IDE: Click "Save Changes" button
    IDE->>UI_State: Collect all current Schema
    UI_State->>Backend: Send Update Simulation Schema API (With all JSON data)
    
    activate Backend
    Backend->>Backend: Normalize, map data types to Backend Format
    Backend->>DB: UPDATE DBConnection table (Overwrite meta_schema column)
    activate DB
    DB-->>Backend: Report Success
    deactivate DB
    
    Backend-->>IDE: Notify save complete (Status 200 OK)
    deactivate Backend
    
    IDE->>UI_State: Remove "Unsaved Changes" warning
    IDE-->>User: Show Toast Success "Schema saved successfully"
```
