# ROLE
You are a Senior Frontend Engineer.
The user wants to improve the readability of SQL queries displayed in the `SqlBlock` component.
Currently, complex queries often appear as a single long line or poorly formatted text.
The goal is to apply **Standard SQL Formatting** (Pretty Print) to make the code easier to read.

# REQUIREMENTS

## 1. Install Dependency
We will use `sql-formatter` for robust SQL beautification.
Add this to the project instructions:
`npm install sql-formatter`

## 2. Create Utility Function (`src/utils/sqlFormatter.ts`)
Create a reusable helper function to handle formatting configurations.
- **Function:** `formatSql(sql: string): string`
- **Config:**
  - Language: `'postgresql'` (or generic `'sql'`).
  - Keyword Case: `'upper'` (e.g., SELECT, FROM, WHERE).
  - Indent: 2 or 4 spaces.
  - Logical Operator Newline: `true` (Break lines before AND/OR).

## 3. Update `SqlBlock` Component (`src/components/editor/SqlBlock.tsx`)
Integrate the formatter into the UI.

### A. Auto-Format Logic
- When the `SqlBlock` mounts (or when the `code` prop changes), automatically format the SQL **IF** it comes from an AI response (usually unformatted).
- *Optional:* You can add a prop `autoFormat?: boolean` (default true) to control this.

### B. UI Enhancement (Toolbar)
Add a **"Format Code"** button to the `SqlBlock` toolbar (next to Run/Copy).
- **Icon:** Use `AlignLeft` or `FileCode` from `lucide-react`.
- **Action:** When clicked, re-format the current content of the editor.
- **Tooltip:** "Beautify SQL".

# DELIVERABLES
Generate code for:
1.  `src/utils/sqlFormatter.ts`
2.  `src/components/editor/SQLBlock.tsx` (Refactored to include formatting logic and the new button).

# EXPECTED OUTPUT STYLE
Input:
`SELECT * FROM test_users WHERE email = 'target@vip.com' LIMIT 1`

Output:
```sql
SELECT
  *
FROM
  test_users
WHERE
  email = 'target@vip.com'
LIMIT
  1
```