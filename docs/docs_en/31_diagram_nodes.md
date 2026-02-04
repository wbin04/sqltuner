# ROLE
You are a Senior Frontend Engineer specializing in React Flow (@xyflow/react).
The user wants to edit the table schema directly on the Diagram Nodes.

# GOAL
Upgrade `TableNode.tsx` to allow **Inline CRUD Operations** for columns:
1.  **Add Column:** A footer input to quickly add a new column (Name + Type).
2.  **Delete Column:** A delete button appears on hover for each column row.
3.  **Edit Type:** Allow changing the data type via a dropdown directly on the node.

# REQUIREMENTS

## 1. Update Node Data Interface
React Flow passes data to nodes via the `data` prop. Update the `TableNodeData` interface to include callbacks.

```typescript
// In types.ts or TableNode.tsx
export interface TableNodeData {
  label: string; // Table Name
  columns: ColumnDef[];
  // Callbacks passed from parent
  onAddColumn: (tableName: string, column: ColumnDef) => void;
  onRemoveColumn: (tableName: string, columnName: string) => void;
  onUpdateColumn: (tableName: string, columnName: string, newDef: ColumnDef) => void;
}