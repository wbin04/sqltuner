# VAI TRÒ
Bạn là Senior Frontend Engineer thành thạo **React, Tailwind CSS, và UI/UX Design**.
Nhiệm vụ của bạn là triển khai **Hệ thống Theme Light/Dark Mode** cho ứng dụng SQLTuner.

# TRẠNG THÁI HIỆN TẠI
- Ứng dụng hiện tại được hardcode thành theme "Midnight Blue" Dark.
- Trong `MainLayout.tsx`, phần User Profile sử dụng placeholder icon 'U' bên cạnh username/email.

# YÊU CẦU

## 1. Logic Theme
- **Theme Mặc định:** Light Mode.
- **Cơ chế:** Sử dụng chiến lược `darkMode: 'class'` của Tailwind.
- **Persistence:** Lưu tùy chọn người dùng trong `localStorage`.
- **Hành vi Toggle:**
  - Nếu hiện tại là **Light**: Hiển thị **Sun Icon**. Nhấp vào nó chuyển sang Dark (icon trở thành Moon).
  - Nếu hiện tại là **Dark**: Hiển thị **Moon Icon**. Nhấp vào nó chuyển sang Light (icon trở thành Sun).

## 2. Palette Theme Light (Mới)
Định nghĩa màu semantic trong `tailwind.config.ts` sử dụng CSS variables hoặc Tailwind utility classes để hỗ trợ cả hai chế độ dễ dàng.
- **Background:** White (`#ffffff`) hoặc rất sáng Slate (`#f8fafc`).
- **Surface/Card:** White (`#ffffff`) với viền xám nhạt (`#e2e8f0`).
- **Text:** Slate-900 (Main) và Slate-500 (Muted).
- **Primary:** Blue-600 (Tối hơn một chút so với Blue-500 của Dark mode để tăng độ tương phản).

## 3. Vị trí UI (Cụ thể)
- Định vị **Phần User Profile** trong Sidebar/MainLayout.
- **LOẠI BỎ** placeholder Avatar/Icon 'U' hiện có.
- **CHÈN** nút `ThemeToggle` mới vào vị trí chính xác đó (bên trái username/email).

# ĐẦU RA

Vui lòng tạo/cập nhật 4 file sau:

## 1. `tailwind.config.ts`
- Cập nhật cấu hình để hỗ trợ `darkMode: 'class'`.
- Định nghĩa màu semantic (`background`, `surface`, `text-main`) tự động chuyển giá trị dựa trên class `.dark`.
- **Ví dụ Mapping:**
  - `colors.background`: Light `slate-50` vs Dark `slate-950`.
  - `colors.surface`: Light `white` vs Dark `slate-900`.
  - `colors.border`: Light `slate-200` vs Dark `slate-800`.

## 2. `src/context/ThemeContext.tsx` (File Mới)
- Tạo Context Provider để quản lý trạng thái theme (`light` | `dark`).
- Khi mount, kiểm tra `localStorage` (mặc định 'light' nếu trống).
- Cập nhật danh sách class của document `<html>` (`add('dark')` hoặc `remove('dark')`) khi trạng thái thay đổi.

## 3. `src/components/ui/ThemeToggle.tsx` (File Mới)
- Một component button có thể tái sử dụng.
- Sử dụng icons `lucide-react`: `Sun` và `Moon`.
- Sử dụng `ThemeContext`.
- **Style:** Minimalist, không background, `hover:text-primary`.

## 4. `src/layouts/MainLayout.tsx` (Cập nhật)
- Bao bọc ứng dụng (hoặc sidebar) với `ThemeProvider`.
- Định vị phần footer/user.
- **Thay thế div Avatar 'U' bằng `<ThemeToggle />`**.
- Đảm bảo layout trông tốt trong cả Light và Dark modes sử dụng các class màu semantic mới (ví dụ: `bg-background text-text-main`).

# RÀNG BUỘC CODE
- Sử dụng **TypeScript**.
- Sử dụng **Tailwind CSS** variables cho theming động.
- Giữ thiết kế sạch và nhất quán với cấu trúc dự án hiện có.