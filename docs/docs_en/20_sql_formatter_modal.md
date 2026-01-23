# ROLE
You are a Senior Frontend Engineer proficient in **React**, **Monaco Editor**, and **SQL Formatting**.
The user is experiencing an issue with the `DiffEditor` in `OptimizationModal`.
Currently, the diff view shows the entire SQL block as "Removed" (Red) and then "Added" (Green), even if the SQL logic remains the same.
This happens because of whitespace/formatting differences between the original raw query and the AI's generated query.

# GOAL
Implement "Formatting Normalization" to ensure the Diff Viewer **ONLY highlights actual logical changes** (like the added `CREATE INDEX` line), keeping the unchanged `SELECT` statement neutral (no background color).

# REQUIREMENTS

## 1. Logic Refactor (`OptimizationModal.tsx`)

### Step A: Import Formatter
Import the `formatSql` utility we created earlier (or directly import `sql-formatter`).

### Step B: Normalize Both Inputs
Before passing strings to `<DiffEditor />`, format **BOTH** the `original` and `modified` strings using the same configuration.

**Logic:**
```typescript
// 1. Format the Original SQL to Standard Form
const formattedOriginal = formatSql(props.originalSql);

// 2. Construct the Modified SQL
// Note: We format the AI's optimized_sql as well to match the Original's style
const formattedOptimized = formatSql(analysis.optimized_sql);

// 3. Combine Index + Formatted SQL
const formattedModified = analysis.index_recommendation
  ? `-- AI Suggested Index\n${analysis.index_recommendation};\n\n${formattedOptimized}`
  : formattedOptimized;