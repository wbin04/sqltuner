# VAI TRÒ
Bạn là Senior Frontend Engineer thành thạo **React (Vite)**, **TypeScript**, **Tailwind CSS**, và **TanStack Query (React Query)**.
Nhiệm vụ của bạn là triển khai **Workspaces Page** (`/workspaces`) cho ứng dụng SQLTuner.

# NGỮ CẢNH
- **Dự án:** SQLTuner (AI-powered SQL Optimization).
- **Design System:** Hỗ trợ Light/Dark mode sử dụng semantic Tailwind classes (ví dụ: `bg-background`, `text-main`, `border-border`).
- **Feature:** "Unified Workspace Model". Người dùng quản lý database connections có thể là:
  1.  **Real Database:** (PostgreSQL/MySQL) - Yêu cầu host, port, credentials.
  2.  **Simulation:** (Virtual) - Chỉ metadata, không cần credentials.

# API CONTRACT (Backend)
UI phải tương tác với các endpoints `axios` sau:
- `GET /api/v1/connections/`: Lấy danh sách workspaces.
- `POST /api/v1/connections/`: Tạo workspace mới.
  - Body cho Real: `{ name, db_type: 'postgres', host, port, username, db_password, db_name }`
  - Body cho Sim: `{ name, db_type: 'simulation' }`
- `POST /api/v1/connections/{id}/sync`: Kích hoạt schema sync (Chỉ Real DB).
- `DELETE /api/v1/connections/{id}`: Xóa workspace.

# YÊU CẦU

## 1. Page Layout (`src/pages/WorkspacesPage.tsx`)
- **Header:** Title "Workspaces" + Nút "Create New".
- **Content:**
  - **Loading State:** Skeleton loader grid.
  - **Empty State:** Illustration thân thiện "No workspaces found" với CTA để tạo một cái.
  - **Data Grid:** Grid responsive (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) hiển thị components `WorkspaceCard`.

## 2. Component: `WorkspaceCard`
Component card đại diện cho một connection duy nhất.
- **Visuals:** Sử dụng `bg-surface` và `border-border`. Hover effect: `hover:border-primary/50`.
- **Header:**
  - Workspace Name (`font-bold`).
  - **Badge:**
    - Nếu `db_type === 'simulation'`: Purple Badge "Simulation".
    - Nếu `db_type === 'postgres'`: Blue Badge "PostgreSQL".
- **Body:**
  - Hiển thị "Host/DB Name" cho Real DBs.
  - Hiển thị "Virtual Schema" cho Simulations.
  - Hiển thị "Last used" hoặc "Created at" date.
- **Footer (Actions):**
  - **Connect/Edit:** Nút để vào workspace (Navigate đến `/editor/{id}`).
  - **Sync:** (Chỉ hiển thị cho Real DBs) Nút icon để kích hoạt `/sync` API với trạng thái loading spinning.
  - **Delete:** Nút icon (Red) để xóa.

## 3. Component: `CreateWorkspaceModal`
Modal/Dialog được kích hoạt bởi nút "Create New".
- **Tabs/Toggle:** Cho phép người dùng chọn "Connect Database" HOẶC "Create Simulation".
- **Form (React Hook Form + Zod):**
  - **Common Field:** `Name` (Required).
  - **Real DB Fields:** `Host`, `Port`, `User`, `Password`, `DB Name` (Chỉ hiển thị khi "Connect Database" được chọn).
- **Validation:** Đảm bảo Port là số, các trường khác required nếu Real DB.
- **Submission:** Gọi create API, đóng modal khi thành công, và refresh danh sách.

# ĐẦU RA

Vui lòng tạo code cho các file sau:

## 1. `src/types/workspace.ts`
- Định nghĩa interfaces: `Workspace`, `CreateWorkspacePayload`.
- Enum: `DbType` ('postgres', 'mysql', 'simulation').

## 2. `src/services/workspaceService.ts`
- Axios wrapper functions cho các endpoints đã đề cập ở trên.

## 3. `src/components/workspaces/WorkspaceCard.tsx`
- Component presentation cho một item duy nhất.

## 4. `src/components/workspaces/CreateWorkspaceModal.tsx`
- Logic form xử lý cả Real và Simulation creation types.

## 5. `src/pages/WorkspacesPage.tsx`
- Trang chính điều phối data fetching và layout.

# QUY TẮC STYLING
- **Không sử dụng hardcoded hex colors.** Sử dụng semantic classes được định nghĩa trong `tailwind.config.ts` (ví dụ: `bg-surface`, `text-muted`).
- Đảm bảo thiết kế trông tốt trong cả **Light Mode** (Clean, White/Gray) và **Dark Mode** (Midnight Blue).
- Sử dụng `lucide-react` cho icons (Database, Box, RefreshCw, Trash2, Plus).