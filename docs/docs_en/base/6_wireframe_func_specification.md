# ROLE
You are a Lead UI/UX Designer specializing in **Data-Intensive Developer Tools** (similar to Supabase, Datadog, or Vercel dashboards).
Your task is to design the **Wireframe Specifications** for "SQLTuner" - an AI-powered SQL Optimization platform.

# VISUAL LANGUAGE & THEME
- **Style:** "Midnight Blue" Dark Mode (Modern, Clean, High Contrast).
- **Colors:** Background (`#020617`), Surface (`#0F172A`), Primary (`#3B82F6`), Success (`#22C55E`), Error (`#EF4444`).
- **Typography:** Inter / JetBrains Mono (for code).

# DATA MODEL CONTEXT (PostgreSQL)
The UI must strictly reflect the data structure below. Every input field and display value must map to a database column.

```sql
-- Users (Auth)
CREATE TABLE users (id, email, password, role...);

-- Connections (Dashboard items)
CREATE TABLE db_connections (
    id, name, host, port, username, db_password, db_name, db_type
);

-- Conversations (Chat Sessions)
CREATE TABLE conversations (id, connection_id, title);

-- Query Logs (Chat History)
CREATE TABLE query_logs (id, conversation_id, role, content, sql_generated);

-- Feedbacks (RLHF Data)
CREATE TABLE feedbacks (query_log_id, rating, corrected_sql, comment);

-- Performance (Analysis Report)
CREATE TABLE performance_analysis (
    query_log_id, execution_time_ms, total_cost, explain_plan (JSONB), index_recommendation
);
```

# DELIVERABLES: WIREFRAME SPECIFICATIONS

Please describe the layout, components, and data mapping for the following **4 Core Screens**.

## SCREEN 1: THE WORKSPACE HUB (Dashboard)
**Goal:** Manage `db_connections`.
**Layout:**
- **Header:** Logo, User Avatar (`users.email`), Settings.
- **Hero Section:** Two large cards: "Connect Existing DB" vs "Create Sandbox Simulation".
- **Grid List:** Display items from `db_connections`.
**Component Details:**
1.  **Connection Card:**
    -   Title: `db_connections.name`
    -   Badge: `db_connections.db_type` (Postgres/MySQL).
    -   Subtext: `db_connections.host` : `db_connections.port` / `db_connections.db_name`.
    -   Status Indicator: Online/Offline (Real-time check).
2.  **Add Connection Modal:**
    -   Form inputs mapping directly to: `host`, `port`, `username`, `password` (masked), `db_name`.
    -   "Test Connection" button.

## SCREEN 2: THE INTELLIGENT EDITOR (Main Interface)
**Goal:** Handle `conversations` and `query_logs`.
**Layout:** 3-Pane Layout (Sidebar, Chat, Context).
**Pane 1: Sidebar (Left)**
-   List of `conversations` (fetched by `connection_id`).
-   Button: "New Chat".
-   Group by Date (Today, Yesterday, Last Week).
**Pane 2: Chat Stream (Center)**
-   **User Message Bubble:** Displays `query_logs.content` (User role).
-   **AI Response Bubble:** Displays `query_logs.content` (Assistant role).
-   **SQL Block:** If `query_logs.sql_generated` exists, show it in a Code Editor (Monaco) with syntax highlighting.
-   **Action Bar (under SQL):**
    -   "Run Query" (Execute).
    -   "Explain" (Trigger Analysis).
    -   "Optimize" (Trigger AI Refactor).
**Pane 3: Data & Schema (Right - Collapsible)**
-   **Tab A: Results:** Data Grid showing query results.
-   **Tab B: Schema:** Tree view of Tables/Columns (fetched via Inspector Service).

## SCREEN 3: PERFORMANCE DRILL-DOWN (Modal/Overlay)
**Goal:** Visualize `performance_analysis`.
**Trigger:** User clicks "Explain" on a SQL block.
**Layout:**
-   **Summary Header:**
    -   Execution Time: `execution_time_ms` (Color coded: Green < 100ms, Red > 1s).
    -   Cost: `total_cost`.
-   **Visual Explain Plan:**
    -   Render `explain_plan` (JSONB) as a Tree Graph or Flame Graph.
    -   Highlight "Seq Scan" nodes in Red.
    -   Highlight "Index Scan" nodes in Green.
-   **AI Recommendation Box:**
    -   Display `index_recommendation`.
    -   "Apply Index" button (Copy `CREATE INDEX` SQL).

## SCREEN 4: FEEDBACK LOOP (Inline Component)
**Goal:** Collect data for `feedbacks` table.
**Location:** Attached to every AI Response Bubble in Screen 2.
**Components:**
-   **Thumbs Up/Down:** Sets `feedbacks.rating` (1 or 0).
-   **"Edit SQL" Mode:**
    -   If AI generates wrong SQL, user clicks "Edit".
    -   Opens an inline editor.
    -   On Save: Updates `feedbacks.corrected_sql` and `feedbacks.comment`.
    -   Toast Message: "Thanks! This helps train our model."

# INSTRUCTIONS FOR OUTPUT
- Provide the response in **Markdown format**.
- For each screen, describe the **Hierarchy**, **UI Elements**, and **User Interactions**.
- Explicitly state which **Database Columns** are being Read from or Written to in each section.