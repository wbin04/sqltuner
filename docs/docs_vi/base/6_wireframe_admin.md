# VAI TRÒ
Bạn là Senior Frontend Engineer chuyên về **Admin Dashboard Interfaces**.
Nhiệm vụ của bạn là triển khai **Admin Portal** cho ứng dụng SQLTuner.

# NGỮ CẢNH
- **Dự án:** SQLTuner (AI-powered SQL Optimization).
- **Design System:** Kế thừa hệ thống theme Light/Dark của dự án (Semantic Tailwind classes: `bg-background`, `bg-surface`, `text-main`).
- **Đối tượng mục tiêu:** System Administrators và AI Trainers.

# YÊU CẦU

## 1. Layout & Navigation
- **Cấu trúc:** Sidebar (Trái) + Topbar (Header) + Main Content (Phải).
- **Menu Sidebar:**
  - **Dashboard:** Tổng quan hệ thống.
  - **Users:** Quản lý người dùng (Gán vai trò, Ban/Unban).
  - **AI Training (RLHF):** Xem xét phản hồi người dùng và SQL đã sửa (Quan trọng).
  - **Connections:** Giám sát tất cả kết nối cơ sở dữ liệu đang hoạt động.
  - **System Config:** Cài đặt LLM, API keys.
- **Topbar:** Breadcrumbs bên trái. User Profile + **Theme Toggle** bên phải.

## 2. Các Module Chính để Triển khai

### Module A: Dashboard Overview (Home)
- **Stats Cards (Hàng 4):**
  - Tổng số Users.
  - Tổng số Queries đã xử lý (Hôm nay).
  - Thời gian phản hồi AI trung bình.
  - Pending Feedback Reviews (Số badge).
- **Charts (sử dụng Recharts):**
  - "Queries per Hour" (Area Chart).
  - "User Satisfaction Trend" (Bar Chart - Thumbs Up vs Down).

### Module B: AI Feedback Review (Phần "Thịt" của Admin)
Màn hình này để xem xét bảng `feedbacks` để tinh chỉnh mô hình.
- **Layout:** Bảng dữ liệu chi tiết.
- **Cột:**
  - Ngày/Giờ.
  - Original Query (Đã cắt ngắn).
  - AI Generated SQL.
  - User Rating (Thumbs Up/Down).
  - **User Correction** (Làm nổi bật cột này nếu người dùng cung cấp SQL đã sửa).
  - Status (Reviewed / Pending).
- **Action:** Nút "Approve for Fine-tuning".

### Module C: User Management
- Bảng tiêu chuẩn với Avatar, Name, Email, Role (Admin/User), Status (Active/Banned).
- Actions: Edit Role, Reset Password, Delete.

# ĐẦU RA

Vui lòng tạo các file sau:

## 1. `src/layouts/AdminLayout.tsx`
- Layout cụ thể cho Admin routes.
- Khác biệt với Main App layout (có thể màu Sidebar hơi khác để phân biệt).

## 2. `src/pages/admin/AdminDashboard.tsx`
- Trang Overview với Mock Data cho Stats và Charts.

## 3. `src/pages/admin/FeedbackReview.tsx`
- Bảng phức tạp để xem xét hiệu suất AI.
- Sử dụng `Badge` components cho Ratings.

# TECH STACK
- React, Tailwind CSS (Semantic Colors).
- `lucide-react` cho icons.
- `recharts` cho visualization.
- `tanstack-table` (hoặc standard table) cho data grids.