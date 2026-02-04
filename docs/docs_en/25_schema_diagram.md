# ROLE
You are a Senior Frontend Engineer specializing in Data Visualization with React and Tailwind CSS.
The user wants to add a visual **Entity Relationship Diagram (ERD)** view to the application using the existing schema data.

# CONTEXT
We already have the full database schema loaded on the frontend in the `schemaDef` object.
**NO new Backend API is needed.** We will transform this JSON data into a graph structure.

**Data Structure (SchemaDef):**
```typescript
interface Column {
  name: string;
  type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

interface ForeignKey {
  column: string;
  ref_table: string;
  ref_column: string;
}

interface Table {
  name: string;
  columns: Column[];
  foreign_keys: ForeignKey[];
}
```

# GOAL
Implement a `SchemaDiagram` component using **React Flow** (now `@xyflow/react`) that renders an interactive diagram of the tables and their relationships.

# TECH STACK
- **Library:** `reactflow` (for the graph) + `dagre` (for auto-layout calculations).
- **Styling:** Tailwind CSS (Must support Dark/Light mode based on parent classes).
- **Icons:** Lucide React (`Key`, `Link`, `Table`).

# REQUIREMENTS

## 1. Custom Node Component (`TableNode.tsx`)
Create a custom React Flow node that looks like a database schema card.
- **Header:** Table Name (Bold, background color distinguishing it).
- **Body:** List of columns.
  - Show PK icon (`Key`) if `is_pk`.
  - Show Type (e.g., `integer`, `varchar`).
- **Handles:** Add `<Handle type="target" />` on the left and `<Handle type="source" />` on the right (or appropriate positions) to allow connections.
- **Styling:** Use `border-border` and `bg-surface` colors to match the existing UI.

## 2. Layout Algorithm (`useAutoLayout.ts`)
Since raw nodes spawn at `(0,0)`, implement a utility function using `dagre` to calculate the `x` and `y` positions automatically.
- Input: Array of Nodes and Edges.
- Output: Nodes with calculated positions (Tree or hierarchical layout).

## 3. Main Component (`SchemaDiagram.tsx`)
- **Transformation Logic:**
  - Map `schemaDef.tables` -> React Flow **Nodes** (using type `tableNode`).
  - Map `table.foreign_keys` -> React Flow **Edges**.
    - Source: Current Table Name.
    - Target: `ref_table`.
    - Edge Style: Smoothstep or Bezier. Add an arrow marker at the end.
- **Interactivity:**
  - Enable `fitView` on load.
  - Allow users to drag nodes around.
  - Show a "Minimap" and "Controls" (Zoom in/out) provided by React Flow.

# CODE STRUCTURE EXAMPLE

```tsx
// 1. transformData.ts
// Logic to convert SchemaDef -> { nodes, edges } using dagre for positioning

// 2. TableNode.tsx
// The UI for a single table card

// 3. SchemaDiagram.tsx
export function SchemaDiagram({ schema }: { schema: SchemaDef }) {
  // ... useNodesState, useEdgesState ...
  return (
    <div className="h-[600px] w-full border rounded-lg">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
         <Background />
         <Controls />
      </ReactFlow>
    </div>
  );
}
```

# DELIVERABLES
Generate the complete code for:
1.  `TableNode.tsx`
2.  `layoutUtils.ts` (The dagre integration).
3.  `SchemaDiagram.tsx`.

Ensure the UI is consistent with the "Dark/Light" theme provided in the previous `SchemaViewer` snippets.