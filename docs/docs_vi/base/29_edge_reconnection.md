# VAI TRÒ
Bạn là một Kỹ sư Frontend cấp cao chuyên về React Flow.
Người dùng muốn nâng cấp `SchemaDiagram` để cho phép chỉnh sửa tương tác các mối quan hệ.
Hiện tại, nhấp vào một edge chỉ hiển thị cảnh báo xóa.

# MỤC TIÊU
1. **Đánh dấu:** Khi một edge được nhấp (được chọn), nó nên thay đổi màu/sắc thái trực quan để chỉ ra lựa chọn.
2. **Kết nối lại:** Người dùng nên có thể kéo các đầu edge hiện có (handles) đến các cột khác để cập nhật mối quan hệ Khóa Ngoại.

# TIÊN QUYẾT
*Giả định `TableNode.tsx` đã được cập nhật để có các thành phần `<Handle />` riêng lẻ cho mỗi cột với ID như `tablename__columnname__type`.*

# YÊU CẦU

## 1. Bật Tính năng Kết nối lại trong `SchemaDiagram.tsx`

Cập nhật các props của thành phần `<ReactFlow />` để bật các tính năng tương tác.

```tsx
// SchemaDiagram.tsx

// Thêm props mới cho đồng bộ dữ liệu
interface SchemaDiagramProps {
  // ... props hiện có
  isEditable?: boolean; // Chỉ cho phép kết nối lại nếu chế độ có thể chỉnh sửa được bật
  onUpdateForeignKey?: (
    oldSource: { table: string; col: string },
    newSource: { table: string; col: string },
    newTarget: { table: string; col: string }
  ) => void;
}

// Bên trong thành phần:
import { applyEdgeChanges, OnEdgesChange, OnReconnect, Edge, Connection } from '@xyflow/react';

// ... bên trong thân thành phần ...

// Helper để phân tích handle ID như "users__id__target" -> { table: "users", col: "id" }
const parseHandleId = (handleId: string | null | undefined) => {
    if (!handleId) return null;
    const parts = handleId.split('__');
    if (parts.length < 2) return null;
    return { table: parts[0], col: parts[1] };
};

// Logic handler chính
const onReconnect: OnReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!isEditable || !onUpdateForeignKey) return;

      const oldSourceData = parseHandleId(oldEdge.sourceHandle);
      const newSourceData = parseHandleId(newConnection.sourceHandle);
      const newTargetData = parseHandleId(newConnection.targetHandle);

      if (!oldSourceData || !newSourceData || !newTargetData) return;

      // Gọi callback cha để cập nhật dữ liệu JSON thực tế
      // Điều này sẽ kích hoạt re-render và edges sẽ cập nhật tự động
      onUpdateForeignKey(oldSourceData, newSourceData, newTargetData);
    },
    [isEditable, onUpdateForeignKey]
);

// Trong JSX return:
<ReactFlow
  // ... props khác ...
  edgesUpdatable={isEditable} // Bật/tắt dựa trên chế độ
  onReconnect={onReconnect}   // Xử lý sự kiện kết nối lại
  // Đảm bảo styles mặc định cho phép đánh dấu lựa chọn
  defaultEdgeOptions={{
     type: 'smoothstep', // hoặc bezier
     style: { strokeWidth: 2 },
     // QUAN TRỌNG: Edge cần có thể chọn để styling
     focusable: true,
     updatable: isEditable ? 'target' : false // Cho phép di chuyển đầu target (hoặc 'source' hoặc true cho cả hai)
  }}
>
  {/* ... */}
</ReactFlow>
```

## 2. Triển khai CSS Đánh dấu

Thêm styles CSS (ví dụ: trong CSS module hoặc global styles) để nhắm đến edges đã chọn. React Flow tự động thêm class `.selected`.

```css
/* Ví dụ CSS Global hoặc CSS Module */

/* Path là đường thẳng thực tế */
.react-flow__edge.selected .react-flow__edge-path {
    stroke: #3b82f6 !important; /* Tailwind blue-500, sử dụng !important để ghi đè style prop mặc định */
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
}

/* Interaction path là khu vực vô hình rộng hơn làm cho việc nhấp/kéo dễ dàng hơn */
.react-flow__edge-interaction {
    cursor: grab;
}
```

## 3. Logic Đồng bộ Dữ liệu Thành phần Cha (Ví dụ)

Cung cấp ví dụ triển khai `onUpdateForeignKey` trong thành phần editor cha để cập nhật trạng thái JSON.

```typescript
// ParentComponent.tsx (ví dụ: TableEditor hoặc SimulationDesigner)

const handleUpdateForeignKey = (
  oldSource: { table: string; col: string },
  newSource: { table: string; col: string },
  newTarget: { table: string; col: string }
) => {
  setMetaSchema((currentSchema) => {
    // 1. Tìm bảng chứa FK (bảng nguồn)
    const tableIndex = currentSchema.tables.findIndex(t => t.name === oldSource.table);
    if (tableIndex === -1) return currentSchema;

    const updatedTables = [...currentSchema.tables];
    const table = { ...updatedTables[tableIndex] };

    // 2. Xóa entry FK cũ
    table.foreign_keys = table.foreign_keys.filter(
      fk => fk.column !== oldSource.col
    );

    // 3. Thêm entry FK mới (nếu bảng nguồn không thay đổi)
    // LƯU Ý: Nếu kéo handle nguồn đến bảng KHÁC, logic phức tạp hơn (xóa khỏi Bảng A, thêm vào Bảng B).
    // Để đơn giản, giả định chúng ta chỉ thay đổi nơi FK trỏ đến (cập nhật target) hoặc chỉ thay đổi cột trong cấu trúc mối quan hệ tương tự.

    // Trường hợp đơn giản: Thay đổi nơi FK trỏ đến (cập nhật target)
    if (oldSource.table === newSource.table && oldSource.col === newSource.col) {
       table.foreign_keys.push({
         column: newSource.col,        // Cột trong bảng này
         ref_table: newTarget.table,   // Bảng mới nó trỏ đến
         ref_column: newTarget.col     // Cột mới nó trỏ đến
       });
    }
    // Trường hợp phức tạp (di chuyển handle nguồn đến cột khác trong cùng bảng) cần logic nhiều hơn.

    updatedTables[tableIndex] = table;
    return { ...currentSchema, tables: updatedTables };
  });
};
```

# ĐẦU RA
1. `SchemaDiagram.tsx` đã cập nhật với triển khai `onReconnect`.
2. CSS cần thiết cho việc đánh dấu edges đã chọn.
3. Giải thích rõ ràng về cách thành phần cha nên xử lý callback cập nhật dữ liệu.