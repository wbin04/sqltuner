# VAI TRÒ
Bạn là Lead Frontend Engineer chuyên về UX Architecture cho Developer Tools.
Nhiệm vụ của bạn là **Refactor Navigation và Page Structure** của ứng dụng SQLTuner để loại bỏ sự trùng lặp.

# VẤN ĐỀ
Hiện tại, chúng ta có hai tính năng chồng chéo:
1.  Một tab cấp cao **"Optimize Query"** (Trang độc lập).
2.  Một luồng **"Workspaces"** dẫn đến trang **"Editor"** (`/editor/{id}`).
Cả hai trang đều chia sẻ UI tương tự (Chat, Schema, Results), gây nhầm lẫn.
**Vấn đề cốt lõi:** Không thể tối ưu hóa truy vấn mà không có ngữ cảnh Database Connection đã chọn.

# GIẢI PHÁP: "CONTEXT-FIRST" ARCHITECTURE
Chúng ta sẽ hợp nhất mọi thứ vào luồng **Workspace -> Editor**.

## 1. Navigation Updates (`src/routes/AppRoutes.tsx` & `Sidebar.tsx`)
- **LOẠI BỎ** route và menu item cấp cao "Optimize Query".
- **GIỮ LẠI:** Dashboard, Workspaces, History, Settings.
- **ROUTE:** Đảm bảo `/editor/:workspaceId` là route chính để làm việc với truy vấn.

## 2. Enhance `EditorPage` (`src/pages/EditorPage.tsx`)
Trang này bây giờ phải là "Super Interface". Cấu trúc nó như một **3-Pane IDE Layout**:

### Pane A: Session Manager (Left Sidebar)
- Liệt kê `conversations` liên kết với `connection_id` hiện tại.
- Nút "New Chat" tạo ngữ cảnh conversation mới.

### Pane B: The Workbench (Center - Main)
- **Chat Stream:** Người dùng hỏi "Tại sao cái này chậm?", AI trả lời.
- **SQL Block Components:**
  - Hiển thị SQL Generated trong Monaco Editor.
  - **Action Bar:** [Run Query] [Explain] [Optimize].
- **Results Area:** Một Bottom Panel có thể thu gọn hoặc Tab bên trong Center Pane để hiển thị `Data Grid` (Kết quả truy vấn).

### Pane C: Context Explorer (Right Sidebar)
- **Schema Viewer:** (Đã triển khai) Tree view của Tables/Columns từ `meta_schema`.

## 3. The "Optimize" Action (Feature Integration)
Thay vì một trang riêng biệt, triển khai "Optimize" như một **Overlay/Modal** được kích hoạt từ Pane B.
- Tạo `src/components/editor/OptimizationModal.tsx`.
- **Trigger:** Nhấp [Optimize] trên SQL block cụ thể.
- **Content:**
  - Diff View (Old SQL vs New SQL).
  - Performance Stats (Giảm chi phí).
  - Index Recommendations.

# ĐẦU RA
Vui lòng tạo/cập nhật code cho:
1.  `src/layouts/Sidebar.tsx`: Loại bỏ link "Optimize".
2.  `src/routes/AppRoutes.tsx`: Dọn dẹp routes.
3.  `src/pages/EditorPage.tsx`: Code layout thống nhất mới.
4.  `src/components/editor/ChatArea.tsx`: Cập nhật để bao gồm Action Bar với trigger "Optimize".

# NGUYÊN TẮC UX
- **Context is King:** Luôn giữ người dùng nhận thức rằng họ đang ở trong "Workspace X".
- **Progressive Disclosure:** Không hiển thị chi tiết Optimization cho đến khi được yêu cầu (qua nút).