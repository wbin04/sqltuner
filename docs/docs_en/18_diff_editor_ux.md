# ROLE
You are a Senior Frontend Engineer proficient in **React**, **Tailwind CSS**, and **Monaco Editor** (`@monaco-editor/react`).
The user wants to completely redesign the `OptimizationModal` to be cleaner, developer-focused, and "Diff-centric".

# CURRENT PAIN POINT
The current modal is too cluttered with "Step 1, Step 2, Step 3", warnings, and verbal explanations.
The user ONLY wants to see the **Code Differences** (Red lines for old code, Green lines for new code), similar to an AI coding assistant's diff view (like GitHub or VS Code Inline Diff).

# GOAL
Refactor `src/components/editor/OptimizationModal.tsx` to implement a **Unified Inline Diff View**.

# REQUIREMENTS

## 1. UI Layout (Vertical Stack)

### A. Minimalist Header
- **Title:** "Optimization Analysis" (Small, font-bold, text-lg).
- **Stats Badge:** Display the Improvement KPI concisely on the right side of the header.
  - Example: `📉 Cost: 1200 → 50 (-95%)`
  - Style: Use a pill badge (`bg-green-100 text-green-700` if improved, `bg-red-100 text-red-700` if worse).

### B. The Diff Viewer (Core Component)
- **Component:** Use `<DiffEditor />` from `@monaco-editor/react`.
- **Configuration (CRITICAL):**
  - **View Mode:** **Inline View** (Set `renderSideBySide: false`). This is the most important requirement to achieve the "Unified Diff" look.
  - **Read Only:** `readOnly: true`.
  - **Minimap:** `minimap: { enabled: false }` to save space.
  - **Scroll:** `scrollBeyondLastLine: false`.
  - **Language:** `sql`.
  - **Height:** Fixed or Flex (e.g., `400px` or `50vh`).
  - **Theme:** Must match the app's current theme (Light/Dark).

### C. Compact Footer
- **Explanation (Optional):** A small, subtle text block (max 1-2 lines, truncated) showing the AI's reasoning.
  - Example: *"Adds an index on 'email' to avoid Seq Scan."*
  - Style: `text-sm text-muted-foreground italic`.
- **Actions:**
  - **Button [Secondary]:** "Dismiss" or "Cancel".
  - **Button [Primary]:** "Apply Fix" (or "Use Optimization").
    - **Logic:** Calls `handleRunQuery(modified_script)`.

## 2. Data Logic & Transformation
- **Input Props:** `originalSql` (string), `analysis` (object).
- **Transformation Logic:** You must construct the `modified` string to be displayed in the Diff Editor.
  ```typescript
  // Logic to combine Index + New SQL for the "Green" part of the diff
  const modifiedCode = analysis.index_recommendation
      ? `-- AI Suggested Index\n${analysis.index_recommendation};\n\n${analysis.optimized_sql}`
      : analysis.optimized_sql;
  ```
- **Diff Inputs:**
  - `original`: `props.originalSql`
  - `modified`: `modifiedCode`

## 3. Styling Rules
- **Remove** all "Step 1", "Diagnosis", "Action Required", "Side-by-Side" headers.
- **Remove** large warning blocks (warnings should be subtle tooltips or small text if absolutely necessary).
- The Modal should look like a clean **Code Review tool**.
- Use Tailwind for the modal container (header/footer) but rely 100% on Monaco for the code visualization.

# DELIVERABLES
Generate the full code for:
1.  `src/components/editor/OptimizationModal.tsx`

# CONSTRAINTS
- Do not lose the `applyFix` functionality (it must execute the `modifiedCode`).
- Ensure the Diff Editor handles resizing correctly (use a ResizeObserver wrapper if necessary, or simple CSS flex).