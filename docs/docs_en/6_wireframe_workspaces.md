# ROLE
You are a Senior Frontend Engineer proficient in **React (Vite)**, **TypeScript**, **Tailwind CSS**, and **TanStack Query (React Query)**.
Your task is to implement the **Workspaces Page** (`/workspaces`) for the SQLTuner application.

# CONTEXT
- **Project:** SQLTuner (AI-powered SQL Optimization).
- **Design System:** Supports Light/Dark mode using semantic Tailwind classes (e.g., `bg-background`, `text-main`, `border-border`).
- **Feature:** "Unified Workspace Model". Users manage database connections which can be:
  1.  **Real Database:** (PostgreSQL/MySQL) - Requires host, port, credentials.
  2.  **Simulation:** (Virtual) - Metadata only, no credentials required.

# API CONTRACT (Backend)
The UI must interact with the following `axios` endpoints:
- `GET /api/v1/connections/`: Fetch list of workspaces.
- `POST /api/v1/connections/`: Create a new workspace.
  - Body for Real: `{ name, db_type: 'postgres', host, port, username, db_password, db_name }`
  - Body for Sim: `{ name, db_type: 'simulation' }`
- `POST /api/v1/connections/{id}/sync`: Trigger schema sync (Real DB only).
- `DELETE /api/v1/connections/{id}`: Remove a workspace.

# REQUIREMENTS

## 1. Page Layout (`src/pages/WorkspacesPage.tsx`)
- **Header:** Title "Workspaces" + "Create New" Button.
- **Content:**
  - **Loading State:** Skeleton loader grid.
  - **Empty State:** A friendly "No workspaces found" illustration with a CTA to create one.
  - **Data Grid:** A responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) displaying `WorkspaceCard` components.

## 2. Component: `WorkspaceCard`
A card component representing a single connection.
- **Visuals:** Use `bg-surface` and `border-border`. Hover effect: `hover:border-primary/50`.
- **Header:**
  - Workspace Name (`font-bold`).
  - **Badge:**
    - If `db_type === 'simulation'`: Purple Badge "Simulation".
    - If `db_type === 'postgres'`: Blue Badge "PostgreSQL".
- **Body:**
  - Display "Host/DB Name" for Real DBs.
  - Display "Virtual Schema" for Simulations.
  - Show "Last used" or "Created at" date.
- **Footer (Actions):**
  - **Connect/Edit:** Button to enter the workspace (Navigate to `/editor/{id}`).
  - **Sync:** (Visible only for Real DBs) Icon button to trigger `/sync` API with a spinning loading state.
  - **Delete:** Icon button (Red) to remove.

## 3. Component: `CreateWorkspaceModal`
A Modal/Dialog triggered by the "Create New" button.
- **Tabs/Toggle:** Allow user to choose "Connect Database" OR "Create Simulation".
- **Form (React Hook Form + Zod):**
  - **Common Field:** `Name` (Required).
  - **Real DB Fields:** `Host`, `Port`, `User`, `Password`, `DB Name` (Show these only when "Connect Database" is selected).
- **Validation:** Ensure Port is a number, other fields required if Real DB.
- **Submission:** Call the create API, close modal on success, and refresh the list.

# DELIVERABLES

Please generate the code for the following files:

## 1. `src/types/workspace.ts`
- Define interfaces: `Workspace`, `CreateWorkspacePayload`.
- Enum: `DbType` ('postgres', 'mysql', 'simulation').

## 2. `src/services/workspaceService.ts`
- Axios wrapper functions for the endpoints mentioned above.

## 3. `src/components/workspaces/WorkspaceCard.tsx`
- The presentation component for a single item.

## 4. `src/components/workspaces/CreateWorkspaceModal.tsx`
- The form logic handling both Real and Simulation creation types.

## 5. `src/pages/WorkspacesPage.tsx`
- The main page orchestrating the data fetching and layout.

# STYLING RULES
- **Do not use hardcoded hex colors.** Use the semantic classes defined in `tailwind.config.ts` (e.g., `bg-surface`, `text-muted`).
- Ensure the design looks good in both **Light Mode** (Clean, White/Gray) and **Dark Mode** (Midnight Blue).
- Use `lucide-react` for icons (Database, Box, RefreshCw, Trash2, Plus).