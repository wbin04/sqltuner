# ROLE
You are a Senior Full-Stack Engineer (React + FastAPI/Python).
The user wants to implement a **"Simulation Workspace"** feature. This allows users to design a virtual database schema (Tables, Columns, Relationships) and enter sample data without connecting to a real physical database.

# ARCHITECTURE OVERVIEW
- **Storage:** The virtual schema and data will be stored entirely in the `metadata_cache` (JSONB) column of the `db_connections` table in PostgreSQL.
- **DB Type:** These connections will have `db_type = 'simulation'`.
- **Backend:** Reuse existing connection APIs but relax validation for simulation types (no host/port required).
- **Frontend:** A rich GUI "Schema Designer" to create tables, define columns, and input sample rows.

# DELIVERABLES

## 1. Backend Implementation (FastAPI)

### A. Data Structure (JSON Schema)
Define the structure for `metadata_cache` when `db_type == 'simulation'`.
**Requirement:** The JSON must look like this:
```json
{
  "is_simulation": true,
  "tables": [
    {
      "id": "uuid_v4",
      "name": "users",
      "columns": [
        {
          "id": "uuid_v4",
          "name": "id",
          "type": "UUID", // Enum: UUID, VARCHAR, INTEGER, BOOLEAN, TIMESTAMP, TEXT, JSON
          "is_pk": true,
          "is_nullable": false,
          "fk_target": null // or { "table_id": "...", "column_id": "..." } if FK
        }
      ],
      "sample_data": [
        { "id": "1", "name": "Alice" },
        { "id": "2", "name": "Bob" }
      ]
    }
  ]
}
```

### B. API Updates (`/api/v1/connections`)
1.  **Create Connection (`POST`):**
    - Relax validation: If `db_type` is "simulation", allow `host`, `port`, `username`, `password` to be null/empty.
    - Initialize `metadata_cache` with a default empty schema `{"is_simulation": true, "tables": []}`.
2.  **Update Schema (`PUT /api/v1/connections/{id}/simulation-schema`):**
    - A new endpoint (or update existing PUT) to save the entire JSON schema designed by the frontend into `metadata_cache`.

---

## 2. Frontend Implementation (React)

### A. Create Workspace Modal Update
Update the existing `CreateWorkspaceModal`.
- **Mode Selection:** Add a toggle/card for "Simulation Mode" vs "Connect Database".
- **Form:** If "Simulation" is selected, hide Host/Port/Auth fields. Only show "Workspace Name".
- **Action:** Send `db_type: 'simulation'` to the API.

### B. The "Schema Designer" Interface (Main Feature)
Create a new page/component `SimulationDesigner.tsx`. This is a No-Code DB Editor.

#### **WIREFRAME & LAYOUT**

```text
+-----------------------------------------------------------------------+
|  < Back   Workspace: E-Commerce Sim               [ Save Changes ]    |
+----------------------+------------------------------------------------+
|  TABLES              |  Table: USERS                                  |
|                      |                                                |
|  [ + New Table    ]  |  [ TAB: Structure ]    [ TAB: Sample Data ]    |
|                      |                                                |
|  > users             |  +------------------------------------------+  |
|    products          |  | Name   | Type     | PK  | Null | FK      |  |
|    orders            |  |--------|----------|-----|------|---------|  |
|                      |  | id     | [UUID v] | [x] | [ ]  | -       |  |
|                      |  | email  | [VARCH ] | [ ] | [ ]  | -       |  |
|                      |  | role   | [INT  v] | [ ] | [ ]  | -       |  |
|                      |  | dept_id| [UUID v] | [ ] | [ ]  | [Config]|  |
|                      |  +------------------------------------------+  |
|                      |  ( + Add Column )                              |
|                      |                                                |
|                      |  *FK Config Modal: Select Table > Select Col* |
+----------------------+------------------------------------------------+
```

### C. Component Logic Requirements

1.  **State Management:**
    - Use a local state (or Context/Zustand) to hold the entire Schema JSON object. DO NOT make API calls on every keystroke.
    - Only call API when the user clicks **[Save Changes]**.

2.  **Tab 1: Structure Editor:**
    - Allow adding/removing columns.
    - **Data Types:** Provide a dropdown of standard simulation types (UUID, INT, VARCHAR, etc.).
    - **Foreign Key Logic:**
      - Provide a UI (Popover or Modal) to select a *Target Table* and *Target Column*.
      - Validate that the Target Column exists and is a Primary Key (recommended).

3.  **Tab 2: Sample Data Editor:**
    - A spreadsheet-like grid (use `ag-grid` or dynamic HTML table).
    - columns = Defined columns in Structure tab.
    - rows = `sample_data` array.
    - Allow adding/editing rows directly.

# IMPLEMENTATION STEPS
1.  **Backend:** Modify Pydantic models to make connection fields optional. Implement the Create logic for simulation.
2.  **Frontend:** Update the Creation Modal.
3.  **Frontend:** Build the `SimulationDesigner` layout (Sidebar + Tabs).
4.  **Frontend:** Implement the Column Editor with Type selection.
5.  **Frontend:** Implement the Foreign Key linker (Connect `dept_id` -> `departments.id`).

# CODING INSTRUCTIONS
- Use **Tailwind CSS** for styling (Dark/Light mode compatible).
- Use **Lucide React** for icons (Table, Plus, Save, Key, Link).
- Ensure the UI handles "Empty States" (e.g., when no table is selected).