# ROLE
You are a Senior UI/UX Designer. Your task is to describe the Layout and Component Hierarchy for the "Smart SQL Tuner" application. The design should be modern, clean (using TailwindCSS/Shadcn style), and dense (data-heavy).

# OUTPUT REQUIREMENTS
Describe the layout for these 3 main screens:

## SCREEN 1: The Connection Manager (Dashboard)
- Layout: Grid or List view of saved connections.
- Components: "Add New" Modal form, Status indicators (Online/Offline), "Sync Schema" button.

## SCREEN 2: The Main Workspace (Split View)
- **Right Panel (Chat):** Chat interface like ChatGPT. Input bar at bottom. Messages support syntax highlighting for SQL.
- **Left Panel (Results & Context):**
  - **Tab 1 (Data):** A sortable/filterable Data Grid (Table) showing query results.
  - **Tab 2 (Schema):** A tree view of the current database tables/columns (for quick reference).

## SCREEN 3: The Performance Analysis View (Drill-down)
- Context: Appears when user clicks "Analyze" on a specific SQL query.
- Components:
  - **Top Summary:** Key metrics (Execution Time, Total Cost) displayed in big cards. Color-coded (Green/Red).
  - **Middle Visualization:** A visual tree or list representing the `EXPLAIN` plan. Highlight "Seq Scan" nodes in Red.
  - **Bottom AI Advice:** A distinct box showing the AI's recommendation and a "Copy Code" button for the suggested Index.