# VAI TRÒ
Bạn là Senior Frontend Engineer thành thạo **React**, **TypeScript**, và **Monaco Editor**.
Nhiệm vụ của bạn là triển khai **Frontend Integration** cho SQL Optimization feature, kết nối UI với `OptimizationService` vừa xây dựng.

# NGỮ CẢNH
- **Backend API:**
  - `POST /api/v1/sql/optimize`: Accept `{ sql, connection_id }`. Trả về detailed analysis (bottlenecks, rewritten SQL, index suggestions).
  - `POST /api/v1/sql/execute`: Được sử dụng để apply suggested Index (DDL execution).
- **UI State:**
  - Component `OptimizationModal` hiện tại tồn tại nhưng cần được wire up với real data và interactive logic.

# YÊU CẦU

## 1. Type Definitions (`src/types/optimization.ts`)
Định nghĩa interface matching Backend response:
```typescript
export interface OptimizationAnalysis {
  original_cost: number;
  new_cost_estimate?: number; // Optional
  bottlenecks: string[];
  optimized_sql: string;
  index_recommendation?: string; // SQL command (e.g., CREATE INDEX...)
  explanation: string;
}
```

## 2. Custom Hook (`src/hooks/useOptimization.ts`)
Tạo hook để manage analysis lifecycle.
- **Input:** `connectionId`, `originalSql`.
- **State:**
  - `analysis`: OptimizationAnalysis | null
  - `isAnalyzing`: boolean (Loading state cho initial analysis)
  - `isApplying`: boolean (Loading state khi applying index)
- **Functions:**
  - `runAnalysis()`: Gọi optimize API.
  - `applyFix()`: Gọi execute API với `analysis.index_recommendation`. On success, trigger toast notification "Index Applied Successfully!".

## 3. Enhance `OptimizationModal.tsx`
**File:** `src/components/editor/OptimizationModal.tsx`

Refactor UI để display 3-Step Optimization Workflow:

### Section A: Diagnosis (The "Why")
- Display **Bottlenecks** as Red Badges (ví dụ: "Seq Scan on 'orders'", "High Cost: 1500").
- Display **Explanation** text từ AI.

### Section B: The Solution (Diff View)
- Sử dụng **Split View** layout.
- **Left Pane:** Original SQL (Read-only).
- **Right Pane:** Optimized SQL (Editable).
- **Visual:** Nếu possible, sử dụng Diff Editor (hoặc two Monaco Editors side-by-side) để highlight changes.

### Section C: Action (The Fix)
- **If `index_recommendation` exists:**
  - Show Code Block với `CREATE INDEX` statement.
  - Show Primary Button: **"Apply Index Now"**.
  - Clicking triggers `applyFix()`.
- **If `optimized_sql` is different:**
  - Show Secondary Button: **"Replace Query"**.
  - Clicking updates main editor's content với new SQL và closes modal.

# UX/UI RULES
- **Loading State:** While `isAnalyzing` is true, show "Skeleton" UI với pulsing animation và text như "AI is analyzing execution plan...".
- **Error State:** Nếu API fails (ví dụ: Syntax Error), show friendly error message inside modal, không crash.
- **Safety:** Thêm "Confirm" step hoặc Tooltip cho "Apply Index" button, warning rằng creating indexes trên large tables có thể mất time.

# ĐẦU RA
Tạo code cho:
1.  `src/types/optimization.ts`
2.  `src/hooks/useOptimization.ts`
3.  `src/components/editor/OptimizationModal.tsx`