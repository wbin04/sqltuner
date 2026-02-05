# ROLE
You are a Senior Frontend Engineer specializing in React, TypeScript, and Tailwind CSS.
The user wants to upgrade the existing `SQLBlock` component to be **Editable** and **Interactive**.

# CONTEXT
Currently, `SQLBlock.tsx` renders SQL in a read-only `<pre>` tag. The action buttons (Run/Explain/Optimize) trigger callbacks based on the *original* `queryLogId`.
We need to change this so the user can **edit the SQL directly** in the block, and the buttons will act on the **modified code**.

# CURRENT CODE
```tsx
import { useState, useEffect } from 'react';
import { Play, Zap, FileText, Copy, Check, AlignLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSql } from '../../utils/sqlFormatter';

interface SQLBlockProps {
  sql: string;
  queryLogId?: string; // Made optional as we might run new ad-hoc queries
  onExplain?: (sql: string) => void;  // CHANGED: Now accepts SQL string
  onOptimize?: (sql: string) => void; // CHANGED: Now accepts SQL string
  onExecute?: (sql: string) => void;  // CHANGED: Now accepts SQL string
}

export function SQLBlock({ sql, queryLogId, onExplain, onOptimize, onExecute }: SQLBlockProps) {
  // ... existing implementation ...
}
```

# REQUIREMENTS

## 1. Convert to Editable Area
- Replace the read-only `<pre><code>...</code></pre>` with a `<textarea>` (or a controlled input).
- **Styling:** The textarea must look like a code block:
  - Font: `font-mono`.
  - Background: Matches the current theme (`bg-background` / `dark:bg-background-dark`).
  - Outline: None (`focus:outline-none`).
  - Text color: Matches syntax highlighting colors if possible, or standard text color.
- **Auto-resize:** The textarea should ideally auto-expand based on content length (or have a sensible min-height).

## 2. Update State Management
- The `displaySql` state should update via an `onChange` handler on the textarea.
- The `handleFormat` function should update the `displaySql` state with the formatted version of the *current* text.

## 3. Update Action Buttons
- **Run Query:** When clicked, call `onExecute(displaySql)` (pass the *current edited* code).
- **Explain:** When clicked, call `onExplain(displaySql)`.
- **Optimize:** When clicked, call `onOptimize(displaySql)`.

## 4. Props Interface Changes
- Update the `SQLBlockProps` interface. The callbacks (`onExecute`, etc.) should now accept a `sql: string` argument instead of (or in addition to) `queryLogId`.
- *Reasoning:* If the user edits the SQL, the original `queryLogId` is no longer relevant for the execution/optimization context.

# DELIVERABLES
Generate the fully refactored `SQLBlock.tsx` code.
Ensure you keep the existing Tailwind classes for the container, header, and buttons to maintain UI consistency.