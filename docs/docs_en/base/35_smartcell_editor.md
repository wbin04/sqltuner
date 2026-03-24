# ROLE
You are a Senior Frontend Engineer expert in React, Tailwind CSS, and UX Design.
The user is facing a UI issue in the `SampleDataEditor` table: Columns are getting squeezed too narrow when there are many columns, causing data visibility issues.

# GOAL
Refactor the table UI to implement a **"Smart Cell"** strategy.
1.  **Table Layout:** Prevent column shrinking by enforcing min-widths and allowing horizontal scrolling.
2.  **Cell Interaction:** Create a `SmartCell` component that handles long text user-friendly (Truncate -> Hover Copy -> Click to Edit/Expand).

# REQUIREMENTS

## 1. Parent Layout Fix (`SampleDataEditor.tsx`)
Update the table container and column styles to support horizontal scrolling.

-   **Container:** Must have `overflow-x-auto` to allow scrolling if columns exceed screen width.
-   **Headers (`th`) & Cells (`td`):** Apply fixed sizing constraints to prevent layout collapse.
    -   CSS Class: `min-w-[150px] max-w-[300px]` (Adjustable but consistent).
    -   Text style: `whitespace-nowrap overflow-hidden text-ellipsis`.

## 2. Component Implementation: `SmartCell.tsx`

Create a new reusable component to render the cell content.

### Props
```typescript
interface SmartCellProps {
  value: any;
  type: string; // 'VARCHAR', 'INTEGER', 'JSONB', etc.
  onSave: (newValue: any) => void;
  onJsonClick?: () => void; // Callback to open existing JSON Modal
}
```

### Logic & States
1.  **View Mode (Default):**
    -   Render text with `truncate` (one line).
    -   **Hover Effect:** Show a small **Copy Icon** button (`lucide-react`) aligned to the right. Clicking it copies content to clipboard.
    -   **Click Action:** Enters Edit Mode.

2.  **Edit Mode (Smart Switching):**
    -   **Condition A (JSON):** If `type` includes 'JSON', render a styled button `[{ } View JSON]` that triggers `onJsonClick`. Do not allow inline text editing for JSON.
    -   **Condition B (Short Text < 50 chars):** Render a standard `<input />` that fits within the cell.
    -   **Condition C (Long Text > 50 chars):** Render a **Popover/Overlay** (`absolute` positioning, high `z-index`).
        -   Contains a large `<textarea>` to view/edit full content.
        -   Has "Save" (Check icon) and "Cancel" (X icon) buttons.
        -   Style: White background, shadow-xl, border, rounded-lg.

### Interaction Details
-   **Autofocus:** Input/Textarea should focus automatically on open.
-   **Keys:**
    -   `Enter`: Save (for Input).
    -   `Shift + Enter`: New line (for Textarea).
    -   `Escape`: Cancel editing.
-   **Blur:** Save changes when clicking outside (for Input).

# CODE SCAFFOLDING

## 1. `SmartCell.tsx`
```tsx
import { useState, useEffect, useRef } from 'react';
import { Copy, Check, X, Maximize2 } from 'lucide-react';

export function SmartCell({ value, type, onSave, onJsonClick }: SmartCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const isLong = String(value).length > 50;

  // ... implementation ...
  // Remember to handle z-index correctly for the Popover so it floats above the table
}
```

## 2. Integration in `SampleDataEditor.tsx`
```tsx
// Inside the .map() of rows
<td className="px-4 py-2 whitespace-nowrap min-w-[150px] max-w-[300px] border-b border-border">
  <SmartCell 
    value={row[col.name]} 
    type={col.type}
    onSave={(val) => handleUpdateRow(rowIndex, col.name, val)}
    onJsonClick={() => openJsonModal(row[col.name])}
  />
</td>
```

# VISUAL STYLE
-   Use **Tailwind CSS**.
-   **Dark/Light Mode:** Ensure backgrounds (`bg-white` vs `bg-gray-800`) and borders adapt to the theme.
-   **Popover:** Should look like a floating card slightly larger than the cell.

# DELIVERABLES
Generate the complete code for `SmartCell.tsx` and the updated render logic for the table in `SampleDataEditor.tsx`.