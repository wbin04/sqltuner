# VAI TRÒ
Bạn là một Kỹ sư Frontend cấp cao chuyên về React Flow (@xyflow/react).
Người dùng muốn thêm tính năng **Tạo Bảng trực tiếp trên Sơ đồ**.

# MỤC TIÊU
Triển khai **Menu Ngữ cảnh** trên `SchemaDiagram` cho phép người dùng nhấp chuột phải trên canvas để thêm bảng mới tại vị trí con trỏ cụ thể đó.

# YÊU CẦU

## 1. Tạo Thành phần `ContextMenu`
Tạo thành phần UI có thể tái sử dụng `ContextMenu.tsx`.
- **Props:** `x`, `y` (vị trí), `onClose`, `onAddTable`.
- **UI:** Danh sách dropdown đơn giản được style với Tailwind (định vị tuyệt đối).
- **Actions:** Nút "Tạo Bảng Mới".

## 2. Cập nhật `SchemaDiagram.tsx`

### A. Quản lý Trạng thái
- Theo dõi trạng thái Menu Ngữ cảnh: `isOpen`, `position: { x, y }` (tọa độ màn hình), và `cursorPosition: { x, y }` (tọa độ flow).

### B. Xử lý Sự kiện (`onPaneContextMenu`)
Triển khai handler `onPaneContextMenu` trên thành phần `<ReactFlow>`.
1. Ngăn menu trình duyệt mặc định (`event.preventDefault()`).
2. Chụp tọa độ chuột (`event.clientX`, `event.clientY`) cho vị trí menu.
3. **QUAN TRỌNG:** Sử dụng phương thức `screenToFlowPosition({ x, y })` của hook `useReactFlow()` để tính toán chính xác nơi node mới nên được đặt bên trong sơ đồ (tính toán zoom và pan).
4. Đặt trạng thái để hiển thị Menu Ngữ cảnh.

### C. Logic: Thêm Bảng
Khi "Tạo Bảng Mới" được nhấp:
1. Tạo tên duy nhất (ví dụ: `table_${timestamp}`).
2. Tạo đối tượng Schema Bảng mặc định:
    ```typescript
    {
      name: "new_table_1",
      columns: [
        { name: "id", type: "UUID", is_pk: true, is_nullable: false } // PK mặc định
      ],
      position: cursorPosition // Lưu x,y từ bước B.3
    }
    ```
3. Gọi prop cha `onAddTable(newTable)` để cập nhật JSON `meta_schema`.
4. Đóng menu.

### D. Nâng cấp UX (Nhấp đúp để Chỉnh sửa)
Thêm handler `onNodeDoubleClick` vào `<ReactFlow>`.
- Khi node được nhấp đúp, gọi prop cha `onEditTable(tableName)`.
- Điều này nên kích hoạt Sidebar/TableEditor mở cho bảng cụ thể đó.

# ĐẦU RA
1. Mã cho `ContextMenu.tsx`.
2. `SchemaDiagram.tsx` đã cập nhật tích hợp menu và logic thêm.
3. Giải thích cách kết nối callback `onAddTable` với quản lý trạng thái chính.

# RÀNG BUỘC
- Sử dụng `screenToFlowPosition` từ hook `useReactFlow` để đảm bảo đặt đúng ngay cả khi zoom ra.
- Styling phải phù hợp với chủ đề Dark/Light hiện có.