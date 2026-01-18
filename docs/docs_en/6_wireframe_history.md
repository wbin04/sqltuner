# ROLE
You are a Senior Frontend Engineer proficient in **React**, **TanStack Table (React Table)**, and **Tailwind CSS**.
Your task is to implement the **Global History Page** (`/history`) for SQLTuner.

# CONTEXT
- **Architecture:** We have moved to a "Workspace-centric" model.
- **Problem:** Users need a centralized place to search and audit their activities across **ALL** workspaces (both Real DBs and Simulations).
- **Data Source:** This page fetches data from the `query_logs` and `performance_analysis` tables in the backend, joined with `db_connections`.

# REQUIREMENTS

## 1. Page Layout (`src/pages/HistoryPage.tsx`)
- **Header:** Title "Global History" and a Description.
- **Filter Bar:**
  - **Search Input:** Search by SQL content or User prompt.
  - **Select Dropdown:** Filter by Workspace Name.
  - **Select Dropdown:** Filter by Activity Type (`Optimization`, `Execution`, `Chat`).
- **Main Content:** A responsive **Data Table** (using `@tanstack/react-table`).

## 2. Table Columns
1.  **Timestamp:** Formatted (e.g., "Oct 24, 14:30").
2.  **Workspace:** Badge with Workspace Name + Type Icon (Real vs Sim).
3.  **Activity:**
    - Show a snippet of the User's Prompt or SQL.
    - Truncate long text with ellipsis (`...`).
4.  **Result/Status:**
    - If Optimization: Show "Cost -X%" badge.
    - If Execution: Show "Success" or "Error".
5.  **Actions:**
    - "Copy SQL" button.
    - "View Details" button.

## 3. Detail View (`HistoryDetailDrawer.tsx`)
- Clicking a row opens a **Right-side Drawer** (Slide-over).
- Display full SQL Query (Monaco Editor Read-only).
- Display AI Response or Execution Result.
- **CTA Button:** "Open in Workspace" -> Navigates to `/editor/{workspaceId}` and focuses on this specific log.

# API INTEGRATION
- `GET /api/v1/history`: Supports query params `?page=1&limit=20&search=...&workspace_id=...`.
- `GET /api/v1/history/{logId}`: Fetch full details.

# DELIVERABLES
Generate code for:
1.  `src/types/history.ts`: Interfaces for the log data.
2.  `src/services/historyService.ts`: API calls.
3.  `src/pages/HistoryPage.tsx`: The main table view.
4.  `src/components/history/HistoryTable.tsx`: The TanStack table implementation.

# STYLING RULES
- Use `shadcn/ui` or standard Tailwind classes for the Table.
- Ensure High Contrast for text readability.
- Use `lucide-react` icons for Status (TrendDown, CheckCircle, AlertTriangle).