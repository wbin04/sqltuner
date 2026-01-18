# ROLE
You are a Senior Frontend Engineer proficient in **React (Vite)**, **TypeScript**, **Tailwind CSS**, and **TanStack Query (React Query)**.
Your task is to implement the **Editor Page Logic** for the SQLTuner application, focusing on "Workspace Hydration" and "Auto-Sync".

# CONTEXT
- **Feature:** "Unified Workspace Model".
- **Data Flow:**
  1. User clicks "Connect" on the Workspaces list.
  2. App navigates to `/editor/{workspaceId}`.
  3. **Requirement:** The app must fetch the workspace details.
     - IF it is a **Real Database** AND the `meta_schema` (JSON) is empty -> **Automatically trigger a Sync** to fetch schema from the physical DB.
     - IF it is a **Simulation** OR `meta_schema` already exists -> Just load the data normally.

# API CONTRACT (Backend)
- `GET /api/v1/connections/{id}`: Returns `Workspace` object (includes `db_type`, `meta_schema`).
- `POST /api/v1/connections/{id}/sync`: Triggers inspector service. Returns updated `Workspace` with populated `meta_schema`.

# REQUIREMENTS

## 1. `src/services/workspaceService.ts` (Update)
Add methods to interact with the connection endpoints:
- `getWorkspaceById(id)`: Fetch detail.
- `syncWorkspaceSchema(id)`: Trigger sync.

## 2. `src/hooks/useWorkspace.ts` (New Hook)
Implement a custom hook using **TanStack Query**.
- **Query:** Fetch workspace data (Key: `['workspace', id]`).
- **Mutation:** Handle `syncSchema`.
  - **Crucial:** On mutation `onSuccess`, manually update the Query Cache via `queryClient.setQueryData` to reflect the new schema immediately without a full refetch.
- **Return:** `workspace`, `isLoading`, `isError`, `syncSchema` (function), `isSyncing` (boolean).

## 3. `src/pages/EditorPage.tsx` (Main Logic)
- **Layout:** 3-Column Layout (Sidebar | Chat Area | Schema Viewer).
- **Logic:**
  - Use `useWorkspace(id)` to load data.
  - Implement a `useEffect` to handle **Auto-Sync**:
    ```typescript
    if (workspace.type !== 'simulation' && isEmpty(workspace.meta_schema)) {
        syncSchema();
    }
    ```
  - Show a global Loading Spinner while initial data is fetching.
  - Show a specific "Syncing Schema..." indicator/toast when the auto-sync is running in the background.

## 4. `src/components/editor/SchemaViewer.tsx` (UI Component)
- **Input:** `schema` (The JSONB object).
- **Visual:**
  - If schema is empty/null: Show "No schema available".
  - Else: Render a list of Tables.
  - Each Table is collapsible (or just a list).
  - Show Column Name + Data Type (e.g., "id (UUID)", "email (VARCHAR)").
- **Style:** Use `bg-surface`, `border-border`, and `text-sm` for a compact developer tool look.

# DELIVERABLES
Please generate code for:
1. `src/services/workspaceService.ts`
2. `src/hooks/useWorkspace.ts`
3. `src/components/editor/SchemaViewer.tsx`
4. `src/pages/EditorPage.tsx`

# STYLING RULES
- Use `lucide-react` icons (Database, Table, RefreshCw).
- Ensure the layout is responsive (flexbox).
- Use Semantic Tailwind Colors (`bg-background`, `text-muted`, etc.).