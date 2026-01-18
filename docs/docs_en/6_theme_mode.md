# ROLE
You are a Senior Frontend Engineer proficient in **React, Tailwind CSS, and UI/UX Design**.
Your task is to implement a **Light/Dark Mode Theme System** for the SQLTuner application.

# CURRENT STATE
- The app is currently hardcoded to a "Midnight Blue" Dark theme.
- In `MainLayout.tsx`, the User Profile section uses a placeholder 'U' icon next to the username/email.

# REQUIREMENTS

## 1. Theme Logic
- **Default Theme:** Light Mode.
- **Mechanism:** Use Tailwind's `darkMode: 'class'` strategy.
- **Persistence:** Save the user's preference in `localStorage`.
- **Toggle Behavior:**
  - If current is **Light**: Show **Sun Icon** ☀️. Clicking it switches to Dark (icon becomes Moon).
  - If current is **Dark**: Show **Moon Icon** 🌙. Clicking it switches to Light (icon becomes Sun).

## 2. Light Theme Palette (New)
Define semantic colors in `tailwind.config.ts` using CSS variables or Tailwind utility classes to support both modes effortlessly.
- **Background:** White (`#ffffff`) or very light Slate (`#f8fafc`).
- **Surface/Card:** White (`#ffffff`) with light gray border (`#e2e8f0`).
- **Text:** Slate-900 (Main) and Slate-500 (Muted).
- **Primary:** Blue-600 (Slightly darker than Dark mode's Blue-500 for contrast).

## 3. UI Placement (Specific)
- Locate the **User Profile Section** in the Sidebar/MainLayout.
- **REMOVE** the existing 'U' Avatar/Icon placeholder.
- **INSERT** the new `ThemeToggle` button in that exact spot (to the left of the username/email).

# DELIVERABLES

Please generate/update the following 4 files:

## 1. `tailwind.config.ts`
- Update configuration to support `darkMode: 'class'`.
- Define semantic colors (`background`, `surface`, `text-main`) that automatically switch values based on the `.dark` class.
- **Example Mapping:**
  - `colors.background`: Light `slate-50` vs Dark `slate-950`.
  - `colors.surface`: Light `white` vs Dark `slate-900`.
  - `colors.border`: Light `slate-200` vs Dark `slate-800`.

## 2. `src/context/ThemeContext.tsx` (New File)
- Create a Context Provider to manage the theme state (`light` | `dark`).
- On mount, check `localStorage` (default to 'light' if empty).
- Update the `<html>` document class list (`add('dark')` or `remove('dark')`) when state changes.

## 3. `src/components/ui/ThemeToggle.tsx` (New File)
- A reusable button component.
- Uses `lucide-react` icons: `Sun` and `Moon`.
- Consumes `ThemeContext`.
- **Style:** Minimalist, no background, `hover:text-primary`.

## 4. `src/layouts/MainLayout.tsx` (Update)
- Wrap the application (or sidebar) with `ThemeProvider`.
- Locate the footer/user section.
- **Replace the Avatar 'U' div with `<ThemeToggle />`**.
- Ensure the layout looks good in both Light and Dark modes using the new semantic color classes (e.g., `bg-background text-text-main`).

# CODE CONSTRAINTS
- Use **TypeScript**.
- Use **Tailwind CSS** variables for dynamic theming.
- Keep the design clean and consistent with the existing project structure.