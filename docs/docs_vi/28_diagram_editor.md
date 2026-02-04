# VAI TRÒ
Bạn là một Kỹ sư Frontend cấp cao chuyên về React Flow và Giao diện Tương tác.
Người dùng muốn nâng cấp `SchemaDiagram` chỉ đọc thành **Trình chỉnh sửa Tương tác** cho Simulation Workspace.

# MỤC TIÊU
Cho phép người dùng **tạo và xóa Khóa Ngoại** trực tiếp trên sơ đồ trực quan bằng cách kéo và kết nối đường giữa các cột bảng.

# NGỮ CẢNH
Chúng ta có:
1.  `SchemaDiagram.tsx`: Kết xuất đồ thị.
2.  `TableNode.tsx`: Kết xuất các bảng riêng lẻ.
3.  Dữ liệu là một đối tượng JSON (`SchemaDef`) được quản lý trong trạng thái cha.

# YÊU CẦU

## 1. Cập nhật `TableNode.tsx` (Handles Chi tiết)
Hiện tại, handles có thể trên wrapper bảng. Chúng ta cần handles **cho mỗi cột**.
- **Refactor:** Ánh xạ qua các cột trong node.
- **Right Handle (Source):** Thêm `<Handle type="source" />` bên cạnh *mọi* cột. Định dạng ID: `${tableName}__${columnName}__source`.
- **Left Handle (Target):** Thêm `<Handle type="target" />` bên cạnh *mọi* cột. Định dạng ID: `${tableName}__${columnName}__target`.
- **Phong cách:** Handles nên vô hình (opacity-0) cho đến khi người dùng di chuột qua hàng bảng, hoặc chấm nhỏ.

## 2. Cập nhật `SchemaDiagram.tsx` (Logic Tương tác)
Kích hoạt tương tác kết nối.

### Cập nhật Props
Thêm callback props:
```typescript
interface SchemaDiagramProps {
  schema: SchemaDef | null;
  isEditable?: boolean; // Prop mới để kích hoạt tính năng chỉnh sửa
  onAddForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
  onRemoveForeignKey?: (sourceTable: string, sourceCol: string, targetTable: string, targetCol: string) => void;
}
```