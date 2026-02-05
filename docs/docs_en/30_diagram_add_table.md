# ROLE
You are a Senior Frontend Engineer expert in React Flow (@xyflow/react).
The user wants to add a feature to **Create Tables directly on the Diagram**.

# GOAL
Implement a **Context Menu** on the `SchemaDiagram` that allows users to right-click on the canvas to add a new table at that specific cursor location.

# REQUIREMENTS

## 1. Create `ContextMenu` Component
Create a reusable UI component `ContextMenu.tsx`.
- **Props:** `x`, `y` (position), `onClose`, `onAddTable`.
- **UI:** A simple dropdown list styled with Tailwind (absolute positioning).
- **Actions:** Button "Create New Table".

## 2. Update `SchemaDiagram.tsx`

### A. State Management
- Track the Context Menu state: `isOpen`, `position: { x, y }` (screen coordinates), and `cursorPosition: { x, y }` (flow coordinates).

### B. Event Handling (`onPaneContextMenu`)
Implement the `onPaneContextMenu` handler on the `<ReactFlow>` component.
1.  Prevent default browser menu (`event.preventDefault()`).
2.  Capture mouse coordinates (`event.clientX`, `event.clientY`) for the menu position.
3.  **CRITICAL:** Use the `useReactFlow()` hook's `screenToFlowPosition({ x, y })` method to calculate exactly where the new node should be placed inside the diagram (accounting for zoom and pan).
4.  Set state to show the Context Menu.

### C. Logic: Add Table
When "Create New Table" is clicked:
1.  Generate a unique name (e.g., `table_${timestamp}`).
2.  Create a default Table Schema object:
    ```typescript
    {
      name: "new_table_1",
      columns: [
        { name: "id", type: "UUID", is_pk: true, is_nullable: false } // Default PK
      ],
      position: cursorPosition // Save the x,y from step B.3
    }
    ```
3.  Call a parent prop `onAddTable(newTable)` to update the `meta_schema` JSON.
4.  Close the menu.

### D. UX Enhancement (Double Click to Edit)
Add `onNodeDoubleClick` handler to `<ReactFlow>`.
- When a node is double-clicked, call a parent prop `onEditTable(tableName)`.
- This should trigger the Sidebar/TableEditor to open for that specific table.

# DELIVERABLES
1.  Code for `ContextMenu.tsx`.
2.  Updated `SchemaDiagram.tsx` integrating the menu and the add logic.
3.  Explanation of how to connect the `onAddTable` callback to the main state management.

# CONSTRAINT
- Use `screenToFlowPosition` from `useReactFlow` hook to ensure correct placement even when zoomed out.
- Styling must match the existing Dark/Light theme.