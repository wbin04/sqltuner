# ROLE
You are a Senior Frontend Engineer expert in React Flow.
The user wants to enhance the `SchemaDiagram` to allow interactive editing of relationships.
Currently, clicking an edge only shows a delete alert.

# GOAL
1.  **Highlighting:** When an edge is clicked (selected), it should visually change color/style to indicate selection.
2.  **Reconnection:** Users should be able to drag existing edge ends (handles) to different columns to update the Foreign Key relationship.

# PRE-REQUISITES
*Assume the `TableNode.tsx` has already been updated to have individual `<Handle />` components for each column with IDs like `tablename__columnname__type`.*

# REQUIREMENTS

## 1. Enable Reconnection Features in `SchemaDiagram.tsx`

Update the `<ReactFlow />` component props to enable interactive features.

```tsx
// SchemaDiagram.tsx

// Add new props for data syncing
interface SchemaDiagramProps {
  // ... existing props
  isEditable?: boolean; // Only allow reconnection if editable mode is on
  onUpdateForeignKey?: (
    oldSource: { table: string; col: string },
    newSource: { table: string; col: string },
    newTarget: { table: string; col: string }
  ) => void;
}

// Inside the component:
import { applyEdgeChanges, OnEdgesChange, OnReconnect, Edge, Connection } from '@xyflow/react';

// ... inside component body ...

// Helper to parse handle IDs like "users__id__target" -> { table: "users", col: "id" }
const parseHandleId = (handleId: string | null | undefined) => {
    if (!handleId) return null;
    const parts = handleId.split('__');
    if (parts.length < 2) return null;
    return { table: parts[0], col: parts[1] };
};

// The main logic handler
const onReconnect: OnReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!isEditable || !onUpdateForeignKey) return;

      const oldSourceData = parseHandleId(oldEdge.sourceHandle);
      const newSourceData = parseHandleId(newConnection.sourceHandle);
      const newTargetData = parseHandleId(newConnection.targetHandle);

      if (!oldSourceData || !newSourceData || !newTargetData) return;

      // Call parent callback to update the actual JSON data
      // This will trigger a re-render and the edges will update automatically
      onUpdateForeignKey(oldSourceData, newSourceData, newTargetData);
    },
    [isEditable, onUpdateForeignKey]
);

// In the JSX return:
<ReactFlow
  // ... other props ...
  edgesUpdatable={isEditable} // Enable/disable based on mode
  onReconnect={onReconnect}   // Handle the reconnection event
  // Ensure default styles allow selection highlighting
  defaultEdgeOptions={{
     type: 'smoothstep', // or bezier
     style: { strokeWidth: 2 },
     // IMPORTANT: The edge needs to be selectable for styling
     focusable: true,
     updatable: isEditable ? 'target' : false // Allow moving the target end (or 'source' or true for both)
  }}
>
  {/* ... */}
</ReactFlow>
```

## 2. Implement CSS Highlighting

Add CSS styles (e.g., in a CSS module or global styles) to target selected edges. React Flow adds the `.selected` class automatically.

```css
/* Example Global CSS or CSS Module */

/* The path is the actual line */
.react-flow__edge.selected .react-flow__edge-path {
    stroke: #3b82f6 !important; /* Tailwind blue-500, use !important to override default style prop */
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
}

/* The interaction path is the invisible wider area making it easier to click/grab */
.react-flow__edge-interaction {
    cursor: grab;
}
```

## 3. Parent Component Data Sync Logic (Example)

Provide an example implementing `onUpdateForeignKey` in the parent editor component to update the JSON state.

```typescript
// ParentComponent.tsx (e.g., TableEditor or SimulationDesigner)

const handleUpdateForeignKey = (
  oldSource: { table: string; col: string },
  newSource: { table: string; col: string },
  newTarget: { table: string; col: string }
) => {
  setMetaSchema((currentSchema) => {
    // 1. Find the table that holds the FK (the source table)
    const tableIndex = currentSchema.tables.findIndex(t => t.name === oldSource.table);
    if (tableIndex === -1) return currentSchema;

    const updatedTables = [...currentSchema.tables];
    const table = { ...updatedTables[tableIndex] };

    // 2. Remove the old FK entry
    table.foreign_keys = table.foreign_keys.filter(
      fk => fk.column !== oldSource.col
    );

    // 3. Add the new FK entry (if the source table hasn't changed)
    // NOTE: If dragging source handle to a DIFFERENT table, logic is more complex (remove from Table A, add to Table B).
    // For simplicity, assume we are only changing columns within the same relationship structure for now, or just changing the target.

    // Simple case: Changing where the FK points to (updating target)
    if (oldSource.table === newSource.table && oldSource.col === newSource.col) {
       table.foreign_keys.push({
         column: newSource.col,        // The column in this table
         ref_table: newTarget.table,   // The new table it points to
         ref_column: newTarget.col     // The new column it points to
       });
    }
    // Complex case (moving source handle to another column in same table) needs more logic.

    updatedTables[tableIndex] = table;
    return { ...currentSchema, tables: updatedTables };
  });
};
```

# DELIVERABLES
1.  Updated `SchemaDiagram.tsx` with `onReconnect` implementation.
2.  The necessary CSS for highlighting selected edges.
3.  A clear explanation of how the parent component should handle the data update callback.