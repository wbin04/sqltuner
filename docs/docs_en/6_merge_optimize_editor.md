# ROLE
You are a Lead Frontend Engineer specializing in UX Architecture for Developer Tools.
Your task is to **Refactor the Navigation and Page Structure** of the SQLTuner application to eliminate redundancy.

# PROBLEM
Currently, we have two overlapping features:
1.  A top-level tab **"Optimize Query"** (Standalone page).
2.  A **"Workspaces"** flow that leads to an **"Editor"** page (`/editor/{id}`).
Both pages share similar UI (Chat, Schema, Results), causing confusion.
**Core Issue:** One cannot optimize a query without a selected Database Connection context.

# SOLUTION: "CONTEXT-FIRST" ARCHITECTURE
We will consolidate everything into the **Workspace -> Editor** flow.

## 1. Navigation Updates (`src/routes/AppRoutes.tsx` & `Sidebar.tsx`)
- **REMOVE** the top-level "Optimize Query" route and menu item.
- **KEEP:** Dashboard, Workspaces, History, Settings.
- **ROUTE:** Ensure `/editor/:workspaceId` is the main route for working with queries.

## 2. Enhance `EditorPage` (`src/pages/EditorPage.tsx`)
This page must now be the "Super Interface". Structure it as a **3-Pane IDE Layout**:

### Pane A: Session Manager (Left Sidebar)
- List `conversations` linked to the current `connection_id`.
- "New Chat" button creates a new conversation context.

### Pane B: The Workbench (Center - Main)
- **Chat Stream:** User asks "Why is this slow?", AI replies.
- **SQL Block Components:**
  - Display the Generated SQL in Monaco Editor.
  - **Action Bar:** [Run Query] [Explain] [✨ Optimize].
- **Results Area:** A Collapsible Bottom Panel or Tab inside the Center Pane to show `Data Grid` (Query Results).

### Pane C: Context Explorer (Right Sidebar)
- **Schema Viewer:** (Already implemented) Tree view of Tables/Columns from `meta_schema`.

## 3. The "Optimize" Action (Feature Integration)
Instead of a separate page, implement "Optimize" as an **Overlay/Modal** triggered from Pane B.
- Create `src/components/editor/OptimizationModal.tsx`.
- **Trigger:** Clicking [✨ Optimize] on a specific SQL block.
- **Content:**
  - Diff View (Old SQL vs New SQL).
  - Performance Stats (Cost reduction).
  - Index Recommendations.

# DELIVERABLES
Please generate/update the code for:
1.  `src/layouts/Sidebar.tsx`: Remove "Optimize" link.
2.  `src/routes/AppRoutes.tsx`: Clean up routes.
3.  `src/pages/EditorPage.tsx`: The new unified layout code.
4.  `src/components/editor/ChatArea.tsx`: Update to include the Action Bar with the "Optimize" trigger.

# UX PRINCIPLES
- **Context is King:** Always keep the user aware they are inside "Workspace X".
- **Progressive Disclosure:** Don't show the Optimization details until requested (via the button).