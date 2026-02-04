# ROLE
You are a Senior Frontend Engineer specializing in React, TypeScript, and Complex State Management.
The user allows managing a "Simulation Database" via a GUI.
We are building a core component called **`TableEditor.tsx`**.

# CONTEXT
- **Data Source:** The data is loaded from the `meta_schema` field of a connection object.
- **Goal:** The user needs to View, Edit, Create, and Delete Tables, Columns, Indexes, Foreign Keys, and Sample Data.
- **State Strategy:** Local state edits the JSON object. A "Save" button pushes the entire JSON back to the backend.

# DATA STRUCTURE (Source of Truth)
The `meta_schema` follows this exact JSON structure. Please define TypeScript interfaces matching this:

```json
{
  "tables": [
    {
      "name": "user",
      "row_count": 2,
      "columns": [
        {
          "name": "id",
          "type": "UUID", // Enum: UUID, VARCHAR, INTEGER, BOOLEAN, TIMESTAMP, TEXT, JSON
          "is_pk": true,
          "default": null,
          "is_nullable": false
        },
        { "name": "name", "type": "VARCHAR", "is_pk": false, "default": null, "is_nullable": true }
      ],
      "indexes": [
         // { "name": "idx_name", "unique": false, "column_names": ["name"] }
      ],
      "foreign_keys": [
         // { "column": "user_id", "ref_table": "user", "ref_column": "id" }
      ],
      "sample_data": [
        { "id": "c48c...", "name": "huy", "age": "22" } // Keys match column names
      ]
    }
  ]
}
```

# REQUIREMENTS

## 1. Component Architecture (`TableEditor.tsx`)
The component should use a **Sidebar-Content Layout**.

### A. Sidebar (Table List)
- List all tables from `meta_schema.tables`.
- **Actions:**
  - `[+] Add Table`: Prompts for a table name.
  - Delete Table (with confirmation).
  - Search/Filter tables.

### B. Main Content Area (Selected Table)
If a table is selected, show its details in Tabs.

#### **Tab 1: Structure (Schema Definition)**
This is the "Designer" view. It should have 3 collapsible or stacked sections:

1.  **Columns Editor (Grid):**
    - **Headers:** Name | Type | PK | Nullable | Default | Actions
    - **Input:** Editable inputs for each field.
    - **Type:** Dropdown (UUID, VARCHAR, INTEGER, etc.).
    - **Validation:** PK cannot be nullable.
    - **Actions:** Move Up/Down, Delete Column.

2.  **Foreign Keys Editor:**
    - List existing FKs.
    - **Add FK:** Select Local Column -> Select Target Table -> Select Target Column (Filter Target Cols to PKs only).

3.  **Indexes Editor:**
    - List indexes.
    - **Add Index:** Input Name, Multi-select Columns, Checkbox "Unique".

#### **Tab 2: Sample Data (Data Entry)**
A spreadsheet-like view to input mock data.
- **Columns:** Dynamic based on the columns defined in Tab 1.
- **Rows:** Map to `table.sample_data`.
- **Validation:**
  - If a column is renamed in Tab 1, ensure data keys in Tab 2 are preserved or migrated.
  - Update `table.row_count` based on the array length.

## 2. Technical Implementation details

### TypeScript Interfaces
Define these strictly based on the JSON provided above.
```typescript
interface ColumnDef {
  name: string;
  type: string;
  is_pk: boolean;
  default: string | null;
  is_nullable: boolean;
}

interface ForeignKeyDef {
  column: string;
  ref_table: string;
  ref_column: string;
}

interface IndexDef {
  name: string;
  columns: string[];
  is_unique: boolean;
}

interface TableDef {
  name: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  foreign_keys: ForeignKeyDef[];
  row_count: number;
  sample_data: Record<string, any>[];
}

interface MetaSchema {
  tables: TableDef[];
}
```

### State Management
- Use `useState` (or `useImmer` for easier nested updates) to hold the `MetaSchema` object.
- **Auto-save simulation:** Changes update the local state immediately.
- **Global Save:** Provide a top-level `onSave(newSchema)` callback prop that the parent component calls to hit the API.

# UI/UX INSTRUCTIONS
- **Styling:** Tailwind CSS (Dark/Light mode).
- **Icons:** Lucide React (`Table`, `Key`, `Database`, `Plus`, `Trash2`).
- **Empty State:** If no table is selected, show a "Select or Create a Table" placeholder.
- **Responsiveness:** Ensure the Columns Grid scrolls horizontally if too many fields.

# DELIVERABLES
Generate the code for `TableEditor.tsx` and necessary sub-components (e.g., `ColumnRow`, `SampleDataGrid`) to fully implement this logic.