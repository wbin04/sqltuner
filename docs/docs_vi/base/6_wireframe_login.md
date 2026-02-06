# VAI TRÒ
Bạn là Senior Frontend Engineer thành thạo **React, Tailwind CSS, và Form Management**.
Nhiệm vụ của bạn là triển khai màn hình **Login** chuyên nghiệp cho ứng dụng SQLTuner.

# NGỮ CẢNH
- **Dự án:** SQLTuner (AI-powered SQL Optimization).
- **Design System:** Ứng dụng sử dụng hệ thống theme Light/Dark được kiểm soát bởi `tailwind.config.ts` (semantic classes như `bg-background`, `text-main`).
- **Tech Stack:** React Hook Form (cho logic), Zod (cho validation), Lucide React (icons).

# YÊU CẦU

## 1. Layout & Visuals
- **Layout:** Layout card sạch, căn giữa trên nền full-screen.
- **Background:** Sử dụng màu semantic `bg-background`. Thêm gradient mesh tinh tế hoặc pattern nếu có thể để tạo cảm giác premium.
- **Card:**
  - Light Mode: Nền trắng, bóng tinh tế, viền xám nhạt.
  - Dark Mode: Nền `slate-900`, viền `slate-800`.
- **Logo:** Hiển thị logo "SQLTuner" (Icon + Text) ở trên cùng của card.
- **Typography:** Sử dụng `text-main` cho headings và `text-muted` cho labels/placeholders.

## 2. Form Elements (Specifications)
Form phải bao gồm các trường sau với validation:

1.  **Email / Username Input:**
    -   Label: "Email Address".
    -   Icon: `Mail` icon (Lucide) bên trong input ở bên trái.
    -   Validation: Bắt buộc, định dạng email hợp lệ.
2.  **Password Input:**
    -   Label: "Password".
    -   Icon: `Lock` icon (Lucide) ở bên trái.
    -   Action: Icon `Eye/EyeOff` có thể nhấp ở bên phải để toggle hiển thị password.
    -   Validation: Bắt buộc, tối thiểu 6 ký tự.
3.  **"Remember Me" & "Forgot Password" Row:**
    -   **Trái:** Checkbox có label "Remember me for 30 days".
    -   **Phải:** Link "Forgot Password?" trỏ đến `/forgot-password` (hover: `text-primary`).
4.  **Login Button:**
    -   Full width.
    -   Style: Màu primary (`bg-primary`), bo tròn, font-medium.
    -   State: Hiển thị spinner/text loading khi `isSubmitting` là true.
5.  **Sign Up Link:**
    -   Định vị ở dưới cùng.
    -   Text: "Don't have an account? Sign up".
    -   Link trỏ đến `/register`.

# ĐẦU RA

Vui lòng tạo file sau:

## `src/pages/LoginPage.tsx`
- Sử dụng `react-hook-form` với `zodResolver` cho form handling.
- Sử dụng `react-router-dom`'s `Link` component cho navigation.
- Đảm bảo tất cả màu sử dụng semantic Tailwind classes đã định nghĩa trước đó (ví dụ: `bg-surface`, `border-border`, `text-text-main`).
- **Mock Logic:** Hàm `onSubmit` chỉ nên `console.log` data và mô phỏng delay 2 giây trước khi navigate đến `/dashboard`.

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