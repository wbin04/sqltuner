# ROLE
You are a Senior Frontend Engineer specialized in building robust, scalable **React (Vite) + TypeScript** applications.
You follow the "Feature-based" or "Component-based" architecture and strictly adhere to **Clean Code** principles.

# PROJECT CONTEXT
We are building "SQLTuner" - an AI-powered SQL Optimization tool.
The application features a "Midnight Blue" Dark Mode theme.
We are implementing the **HOME / DASHBOARD PAGE** ("Workspace Hub").

# TECH STACK & STANDARDS
- **Framework:** React 18+ (Vite).
- **Language:** TypeScript (Strict mode).
- **Styling:** Tailwind CSS (Utility-first).
- **Icons:** `lucide-react`.
- **Utils:** `clsx` and `tailwind-merge` for class management (Standard pattern).

# DIRECTORY STRUCTURE
Please generate code that fits into this specific folder structure:

```text
src/
├── assets/
├── components/
│   ├── ui/           # Generic atoms (Button, Badge, Card)
│   └── dashboard/    # Dashboard-specific widgets (WorkspaceCard, StatRow)
├── layouts/          # Layout wrappers (MainLayout.tsx, AuthLayout.tsx)
├── lib/              # Utilities (utils.ts for tailwind-merge)
├── pages/            # Page views (DashboardHome.tsx)
├── types/            # TypeScript interfaces (index.ts)
└── App.tsx
```

# DESIGN SYSTEM (TAILWIND CONFIG)
The output must use semantic color names defined in `tailwind.config.ts`, not raw hex codes in components.

**Theme Colors:**
- `background`: `#020617` (slate-950)
- `surface`: `#0F172A` (slate-900)
- `surface-highlight`: `#1E293B` (slate-800)
- `primary`: `#3B82F6` (blue-500)
- `secondary`: `#A78BFA` (purple-400)
- `text-main`: `#F8FAFC` (slate-50)
- `text-muted`: `#94A3B8` (slate-400)

# DELIVERABLES

Please generate the following 5 files with full code:

## 1. `src/lib/utils.ts`
- Implement the standard `cn()` helper function using `clsx` and `tailwind-merge`.

## 2. `tailwind.config.ts`
- Extend the theme to include the colors mentioned above (e.g., `colors.midnight.900`, `colors.primary.DEFAULT`).

## 3. `src/types/index.ts`
- Define interfaces for `Workspace` (id, name, type: 'real' | 'simulation', tableCount, lastSync, status).

## 4. `src/layouts/MainLayout.tsx`
- The application shell with a fixed Sidebar.
- Use Semantic HTML (`<aside>`, `<main>`).
- Highlight the active menu item visually.

## 5. `src/pages/DashboardHome.tsx`
- **Hero Section:** Two large "Hero Cards" for "Connect Real DB" vs "Create Sandbox".
  - Use gradients or border-glow effects on hover.
- **Grid Section:** Display a list of workspaces using the `Workspace` interface.
- **Component Breakdown:** You may inline smaller components (like `WorkspaceCard`) in this file for brevity, or suggest them as separate components if they are large.

# UI/UX REQUIREMENTS
- **Visuals:** Minimalist, Data-dense, Dark mode only.
- **Interactivity:** Add `hover:scale-[1.01]` and `transition-all` to cards to make them feel tactile.
- **Typography:** Use `font-sans` (Inter/System UI).
- **Responsiveness:** Ensure the grid adapts from 1 column (mobile) to 3 columns (desktop).