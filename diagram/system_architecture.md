```
flowchart LR
    %% Định nghĩa các node
    subgraph Architecture ["🚀 System Architecture"]
        direction TB
        
        %% Các Module chính
        MC["Metadata Crawler"]
        OE["Optimization Engine"]
        SM["Sandbox Module"]
        
        %% Khối mô tả chức năng
        MC_Desc>Extracts table structures & constraints for AI context.]
        OE_Desc>Reads EXPLAIN JSON to identify bottlenecks.]
        SM_Desc>Executes queries in an isolated, zero-mutation state.]
        
        %% Kết nối Module với Mô tả
        MC --- MC_Desc
        OE --- OE_Desc
        SM --- SM_Desc
    end

    %% Định nghĩa style (CSS/Màu sắc) cho các khối
    classDef module fill:#2563EB,stroke:#1D4ED8,stroke-width:3px,color:#fff,font-weight:bold,border-radius:8px;
    classDef desc fill:#F3F4F6,stroke:#D1D5DB,stroke-width:2px,color:#374151,stroke-dasharray: 5 5;
    classDef subgraphStyle fill:#FFFFFF,stroke:#64748B,stroke-width:2px,color:#0F172A,font-weight:bold;
    
    %% Áp dụng style
    class MC,OE,SM module;
    class MC_Desc,OE_Desc,SM_Desc desc;
    class Architecture subgraphStyle;
```