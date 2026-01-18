# VAI TRÒ
Bạn là Senior Frontend Engineer thành thạo **React**, **TanStack Table (React Table)**, và **Tailwind CSS**.
Nhiệm vụ của bạn là triển khai **Global History Page** (`/history`) cho SQLTuner.

# NGỮ CẢNH
- **Architecture:** Chúng ta đã chuyển sang mô hình "Workspace-centric".
- **Problem:** Người dùng cần một nơi tập trung để tìm kiếm và kiểm tra hoạt động của họ trên **TẤT CẢ** workspaces (cả Real DBs và Simulations).
- **Data Source:** Trang này lấy dữ liệu từ các bảng `query_logs` và `performance_analysis` trong backend, kết hợp với `db_connections`.

# YÊU CẦU

## 1. Page Layout (`src/pages/HistoryPage.tsx`)
- **Header:** Tiêu đề "Global History" và Mô tả.
- **Filter Bar:**
  - **Search Input:** Tìm kiếm theo nội dung SQL hoặc User prompt.
  - **Select Dropdown:** Lọc theo Workspace Name.
  - **Select Dropdown:** Lọc theo Activity Type (`Optimization`, `Execution`, `Chat`).
- **Main Content:** Một responsive **Data Table** (sử dụng `@tanstack/react-table`).

## 2. Table Columns
1.  **Timestamp:** Định dạng (ví dụ: "Oct 24, 14:30").
2.  **Workspace:** Badge với Workspace Name + Type Icon (Real vs Sim).
3.  **Activity:**
    - Hiển thị snippet của User's Prompt hoặc SQL.
    - Cắt ngắn text dài với ellipsis (`...`).
4.  **Result/Status:**
    - Nếu Optimization: Hiển thị badge "Cost -X%".
    - Nếu Execution: Hiển thị "Success" hoặc "Error".
5.  **Actions:**
    - Nút "Copy SQL".
    - Nút "View Details".

## 3. Detail View (`HistoryDetailDrawer.tsx`)
- Click vào một row mở **Right-side Drawer** (Slide-over).
- Hiển thị full SQL Query (Monaco Editor Read-only).
- Hiển thị AI Response hoặc Execution Result.
- **CTA Button:** "Open in Workspace" -> Điều hướng đến `/editor/{workspaceId}` và focus vào log cụ thể này.

# API INTEGRATION
- `GET /api/v1/history`: Hỗ trợ query params `?page=1&limit=20&search=...&workspace_id=...`.
- `GET /api/v1/history/{logId}`: Lấy full details.

# DELIVERABLES
Tạo code cho:
1.  `src/types/history.ts`: Interfaces cho log data.
2.  `src/services/historyService.ts`: API calls.
3.  `src/pages/HistoryPage.tsx`: Main table view.
4.  `src/components/history/HistoryTable.tsx`: TanStack table implementation.

# STYLING RULES
- Sử dụng `shadcn/ui` hoặc standard Tailwind classes cho Table.
- Đảm bảo High Contrast cho text readability.
- Sử dụng `lucide-react` icons cho Status (TrendDown, CheckCircle, AlertTriangle).