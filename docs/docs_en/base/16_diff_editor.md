# ROLE
You are a Senior Frontend Engineer proficient in **React**, **TypeScript**, and **Monaco Editor**.
Your task is to implement the **Frontend Integration** for the SQL Optimization feature, connecting the UI to the `OptimizationService` we just built.

# CONTEXT
- **Backend API:**
  - `POST /api/v1/sql/optimize`: Accepts `{ sql, connection_id }`. Returns detailed analysis (bottlenecks, rewritten SQL, index suggestions).
  - `POST /api/v1/sql/execute`: Used to apply the suggested Index (DDL execution).
- **UI State:**
  - The `OptimizationModal` component currently exists but needs to be wired up with real data and interactive logic.

# REQUIREMENTS

## 1. Type Definitions (`src/types/optimization.ts`)
Define the interface matching the Backend response:
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
Create a hook to manage the analysis lifecycle.
- **Input:** `connectionId`, `originalSql`.
- **State:**
  - `analysis`: OptimizationAnalysis | null
  - `isAnalyzing`: boolean (Loading state for the initial analysis)
  - `isApplying`: boolean (Loading state when applying the index)
- **Functions:**
  - `runAnalysis()`: Calls the optimize API.
  - `applyFix()`: Calls the execute API with `analysis.index_recommendation`. On success, trigger a toast notification "Index Applied Successfully!".

## 3. Enhance `OptimizationModal.tsx`
**File:** `src/components/editor/OptimizationModal.tsx`

Refactor the UI to display the 3-Step Optimization Workflow:

### Section A: Diagnosis (The "Why")
- Display **Bottlenecks** as Red Badges (e.g., "Seq Scan on 'orders'", "High Cost: 1500").
- Display the **Explanation** text from AI.

### Section B: The Solution (Diff View)
- Use a **Split View** layout.
- **Left Pane:** Original SQL (Read-only).
- **Right Pane:** Optimized SQL (Editable).
- **Visual:** If possible, use a Diff Editor (or two Monaco Editors side-by-side) to highlight changes.

### Section C: Action (The Fix)
- **If `index_recommendation` exists:**
  - Show a Code Block with the `CREATE INDEX` statement.
  - Show a Primary Button: **"⚡ Apply Index Now"**.
  - Clicking this triggers `applyFix()`.
- **If `optimized_sql` is different:**
  - Show a Secondary Button: **"Replace Query"**.
  - Clicking this updates the main editor's content with the new SQL and closes the modal.

# UX/UI RULES
- **Loading State:** While `isAnalyzing` is true, show a "Skeleton" UI with a pulsing animation and text like "AI is analyzing execution plan...".
- **Error State:** If the API fails (e.g., Syntax Error), show a friendly error message inside the modal, do not crash.
- **Safety:** Add a "Confirm" step or Tooltip for the "Apply Index" button, warning that creating indexes on large tables might take time.

# DELIVERABLES
Generate code for:
1.  `src/types/optimization.ts`
2.  `src/hooks/useOptimization.ts`
3.  `src/components/editor/OptimizationModal.tsx`