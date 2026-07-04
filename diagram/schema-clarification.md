```sequenceDiagram
    autonumber
    
    actor User as User
    participant UI as Frontend
    participant Backend as Backend
    participant AI as AI / LLM

    Note over User, AI: Schema Clarification Design Flow Started
    
    User->>UI: Request to create new database structure (e.g., "Create a sales management DB")
    UI->>Backend: Send Text (Create new conversation)
    
    activate Backend
    Backend->>Backend: Detect Intent: Is Schema Design Request
    
    %% Phase 1: Check if clarification is needed
    Backend->>AI: Send Analysis Prompt (Ask AI if the Requirement is sufficient?)
    activate AI
    AI-->>Backend: Missing info! Return list of clarification questions (With Options)
    deactivate AI
    
    Backend-->>UI: Return special Message (Containing flag "Before designing the schema...")
    deactivate Backend
    
    UI->>UI: Parser detects Clarification flag -> Hide normal Text
    UI->>UI: Render interactive "ClarificationBlock" Component
    UI-->>User: Display multiple-choice/essay questions for user selection

    %% User Provides Additional Information
    Note over User, UI: User Provides Additional Information

    User->>UI: Answer/Select Options for each question & Click Submit
    UI->>Backend: Send POST `/chat` API containing "clarification_answers" array
    
    activate Backend
    %% Phase 2: Apply answers to generate actual structure
    Backend->>AI: Send Schema Generation Prompt (Original request + Collected answer set)
    activate AI
    AI-->>Backend: Deep 2-layer analysis & Return complete JSON Structure (Tables, Columns, Refs)
    deactivate AI
    
    Backend-->>UI: Return Schema Generated Data structure
    deactivate Backend
    
    UI->>UI: Update UI: Close/Minimize Question Form (Success message)
    UI->>UI: Render "Schema Block" Component 
    UI-->>User: Display Table list interface & Allow "Apply to Sandbox"
```
