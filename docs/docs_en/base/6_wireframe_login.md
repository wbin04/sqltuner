# ROLE
You are a Senior Frontend Engineer proficient in **React, Tailwind CSS, and Form Management**.
Your task is to implement a professional **Login Screen** for the SQLTuner application.

# CONTEXT
- **Project:** SQLTuner (AI-powered SQL Optimization).
- **Design System:** The app uses a Light/Dark theme system controlled by `tailwind.config.ts` (semantic classes like `bg-background`, `text-main`).
- **Tech Stack:** React Hook Form (for logic), Zod (for validation), Lucide React (icons).

# REQUIREMENTS

## 1. Layout & Visuals
- **Layout:** A clean, centered card layout on a full-screen background.
- **Background:** Use the semantic `bg-background` color. Add a subtle mesh gradient or pattern if possible for a premium feel.
- **Card:**
  - Light Mode: White background, subtle shadow, light gray border.
  - Dark Mode: `slate-900` background, `slate-800` border.
- **Logo:** Display the "SQLTuner" logo (Icon + Text) at the top of the card.
- **Typography:** Use `text-main` for headings and `text-muted` for labels/placeholders.

## 2. Form Elements (Specifications)
The form must include the following fields with validation:

1.  **Email / Username Input:**
    -   Label: "Email Address".
    -   Icon: `Mail` icon (Lucide) inside the input on the left.
    -   Validation: Required, valid email format.
2.  **Password Input:**
    -   Label: "Password".
    -   Icon: `Lock` icon (Lucide) on the left.
    -   Action: A clickable `Eye/EyeOff` icon on the right to toggle password visibility.
    -   Validation: Required, min 6 characters.
3.  **"Remember Me" & "Forgot Password" Row:**
    -   **Left:** A Checkbox labeled "Remember me for 30 days".
    -   **Right:** A link "Forgot Password?" pointing to `/forgot-password` (hover: `text-primary`).
4.  **Login Button:**
    -   Full width.
    -   Style: Primary color (`bg-primary`), rounded, font-medium.
    -   State: Show a spinner/loading text when `isSubmitting` is true.
5.  **Sign Up Link:**
    -   Located at the bottom.
    -   Text: "Don't have an account? Sign up".
    -   Link points to `/register`.

# DELIVERABLES

Please generate the following file:

## `src/pages/LoginPage.tsx`
- Use `react-hook-form` with `zodResolver` for form handling.
- Use `react-router-dom`'s `Link` component for navigation.
- Ensure all colors use the semantic Tailwind classes defined previously (e.g., `bg-surface`, `border-border`, `text-text-main`).
- **Mock Logic:** The `onSubmit` function should just `console.log` the data and simulate a 2-second delay before navigating to `/dashboard`.

# CODE SNIPPET EXAMPLE (Style Guide)
```tsx
// Example of Input styling for Light/Dark compatibility
<div className="relative">
  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted" />
  <input
    className="w-full rounded-md border border-border bg-background pl-10 py-2 text-text-main placeholder:text-muted focus:ring-2 focus:ring-primary"
    {...register("email")}
  />
</div>
```