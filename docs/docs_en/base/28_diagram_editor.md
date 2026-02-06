# ROLE
You are a Senior Frontend Engineer specializing in React Flow and Interactive UI.
The user wants to upgrade the read-only `SchemaDiagram` to an **Interactive Editor** for the Simulation Workspace.

# GOAL
Allow users to **create and delete Foreign Keys** directly on the visual diagram by dragging and connecting lines between table columns.

# CONTEXT
We have:
1.  `SchemaDiagram.tsx`: Renders the graph.
2.  `TableNode.tsx`: Renders individual tables.
3.  The data is a JSON object (`SchemaDef`) managed in the parent state.

# REQUIREMENTS

## 1. Update `TableNode.tsx` (Granular Handles)
Currently, handles might be on the table wrapper. We need handles **per column**.
- **Refactor:** Map through the columns in the node.
- **Right Handle (Source):** Add a `<Handle type="source" />` next to *every* column. ID format: `${tableName}__${columnName}__source`.
- **Left Handle (Target):** Add a `<Handle type="target" />` next to *every* column. ID format: `${tableName}__${columnName}__target`.
- **Styling:** Handles should be invisible (opacity-0) until the user hovers over the table row, or small dots.

## 2. Update `SchemaDiagram.tsx` (Interaction Logic)
Enable connection interactions.

### Props Update
Add callback props:
```typescript
interface SchemaDiagramProps {
  schema: SchemaDef | null;
  isEditable?: boolean; // New prop to enable editing features
  onAddForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
  onRemoveForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
}