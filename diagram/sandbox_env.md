```
flowchart LR
    %% Định nghĩa các node
    subgraph ExecutionSafety [" "]
        direction TB
        
        %% Các Module chính
        TR["Transaction Rollback"]
        DP["DML Protection"]
        DM["Data Mocking"]
        
        %% Khối mô tả chức năng
        TR_Desc>"Every query is executed within a transaction that rolls back immediately after result verification."]
        DP_Desc>"Blocks destructive commands (DROP, TRUNCATE) to preserve database integrity."]
        DM_Desc>"Populates virtual schemas with representative samples for safe logic testing."]
        
        %% Kết nối Module với Mô tả
        TR --- TR_Desc
        DP --- DP_Desc
        DM --- DM_Desc
    end

    %% Định nghĩa style (CSS/Màu sắc) cho các khối
    classDef module fill:#2563EB,stroke:#1D4ED8,stroke-width:3px,color:#fff,font-weight:bold,border-radius:8px;
    classDef desc fill:#F3F4F6,stroke:#D1D5DB,stroke-width:2px,color:#374151,stroke-dasharray: 5 5;
    classDef subgraphStyle fill:#FFFFFF,stroke:#64748B,stroke-width:2px,color:#0F172A,font-weight:bold;
    
    %% Áp dụng style
    class TR,DP,DM module;
    class TR_Desc,DP_Desc,DM_Desc desc;
    class ExecutionSafety subgraphStyle;
```