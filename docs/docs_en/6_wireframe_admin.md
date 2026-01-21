# ROLE
You are a Senior Frontend Engineer specializing in **Admin Dashboard Interfaces**.
Your task is to implement the **Admin Portal** for the SQLTuner application.

# CONTEXT
- **Project:** SQLTuner (AI-powered SQL Optimization).
- **Design System:** Inherits the project's Light/Dark theme system (Semantic Tailwind classes: `bg-background`, `bg-surface`, `text-main`).
- **Target Audience:** System Administrators and AI Trainers.

# REQUIREMENTS

## 1. Layout & Navigation
- **Structure:** Sidebar (Left) + Topbar (Header) + Main Content (Right).
- **Sidebar Menu:**
  - **Dashboard:** System Overview.
  - **Users:** User management (Role assignment, Ban/Unban).
  - **AI Training (RLHF):** Review user feedbacks and corrected SQL (Crucial).
  - **Connections:** Monitor all active database connections.
  - **System Config:** LLM settings, API keys.
- **Topbar:** Breadcrumbs on the left. User Profile + **Theme Toggle** on the right.

## 2. Key Modules to Implement

### Module A: Dashboard Overview (Home)
- **Stats Cards (Row of 4):**
  - Total Users.
  - Total Queries Processed (Today).
  - Average AI Response Time.
  - Pending Feedback Reviews (Badge count).
- **Charts (using Recharts):**
  - "Queries per Hour" (Area Chart).
  - "User Satisfaction Trend" (Bar Chart - Thumbs Up vs Down).

### Module B: AI Feedback Review (The "Meat" of the Admin)
This screen is for reviewing the `feedbacks` table to fine-tune the model.
- **Layout:** A detailed Data Table.
- **Columns:**
  - Date/Time.
  - Original Query (Truncated).
  - AI Generated SQL.
  - User Rating (Thumbs Up/Down).
  - **User Correction** (Highlight this column if the user provided fixed SQL).
  - Status (Reviewed / Pending).
- **Action:** A "Approve for Fine-tuning" button.

### Module C: User Management
- Standard Table with Avatar, Name, Email, Role (Admin/User), Status (Active/Banned).
- Actions: Edit Role, Reset Password, Delete.

# DELIVERABLES

Please generate the following files:

## 1. `src/layouts/AdminLayout.tsx`
- A specific layout for Admin routes.
- Distinct from the Main App layout (maybe slightly different Sidebar color tone to differentiate).

## 2. `src/pages/admin/AdminDashboard.tsx`
- The Overview page with Mock Data for Stats and Charts.

## 3. `src/pages/admin/FeedbackReview.tsx`
- The complex table to review AI performance.
- Use `Badge` components for Ratings.

# TECH STACK
- React, Tailwind CSS (Semantic Colors).
- `lucide-react` for icons.
- `recharts` for visualization.
- `tanstack-table` (or standard table) for data grids.