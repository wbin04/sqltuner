# VAI TRÒ
Bạn là một Kỹ sư Frontend cấp cao chuyên về React Flow (@xyflow/react).
Người dùng muốn chỉnh sửa schema bảng trực tiếp trên các Node Sơ đồ.

# MỤC TIÊU
Nâng cấp `TableNode.tsx` để cho phép **Hoạt động CRUD Nội tuyến** cho cột:
1. **Thêm Cột:** Input footer để nhanh chóng thêm cột mới (Tên + Loại).
2. **Xóa Cột:** Nút xóa xuất hiện khi hover trên mỗi hàng cột.
3. **Chỉnh sửa Loại:** Cho phép thay đổi loại dữ liệu qua dropdown trực tiếp trên node.

# YÊU CẦU

## 1. Cập nhật Giao diện Dữ liệu Node
React Flow truyền dữ liệu đến nodes qua prop `data`. Cập nhật giao diện `TableNodeData` để bao gồm callbacks.

```typescript
// Trong types.ts hoặc TableNode.tsx
export interface TableNodeData {
  label: string; // Tên Bảng
  columns: ColumnDef[];
  // Callbacks được truyền từ cha
  onAddColumn: (tableName: string, column: ColumnDef) => void;
  onRemoveColumn: (tableName: string, columnName: string) => void;
  onUpdateColumn: (tableName: string, columnName: string, newDef: ColumnDef) => void;
}
```