```
flowchart LR
    %% Định nghĩa các node
    subgraph Interface [" "]
        direction TB
        
        %% Các Module chính
        CI["Chat Interface"]
        SI["Schema Inspector"]
        OP["Optimization Panel"]
        
        %% Khối mô tả chức năng
        CI_Desc>Seamless Text-to-SQL conversion with conversation history.]
        SI_Desc>Interactive ERD and table metadata visualization.]
        OP_Desc>Visual Diff for query refactoring and cost analysis.]
        
        %% Kết nối Module với Mô tả
        CI --- CI_Desc
        SI --- SI_Desc
        OP --- OP_Desc
    end

    %% Định nghĩa style (CSS/Màu sắc) cho các khối
    %% Đổi sang màu Emerald (Xanh ngọc) để phân biệt với khối Architecture
    classDef module fill:#2563EB,stroke:#1D4ED8,stroke-width:3px,color:#fff,font-weight:bold,border-radius:8px;
    classDef desc fill:#F3F4F6,stroke:#D1D5DB,stroke-width:2px,color:#374151,stroke-dasharray: 5 5;
    classDef subgraphStyle fill:#FFFFFF,stroke:#64748B,stroke-width:2px,color:#0F172A,font-weight:bold;
    
    %% Áp dụng style
    class CI,SI,OP module;
    class CI_Desc,SI_Desc,OP_Desc desc;
    class Interface subgraphStyle;
```