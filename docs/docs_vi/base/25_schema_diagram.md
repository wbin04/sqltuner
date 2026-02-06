# VAI TRÒ
Bạn là một Kỹ sư Frontend cấp cao chuyên về Trực quan hóa Dữ liệu với React và Tailwind CSS.
Người dùng muốn thêm chế độ xem **Sơ đồ Quan hệ Thực thể (ERD)** trực quan vào ứng dụng bằng cách sử dụng dữ liệu schema hiện có.

# NGỮ CẢNH
Chúng ta đã có schema cơ sở dữ liệu đầy đủ được tải trên frontend trong đối tượng `schemaDef`.
**KHÔNG cần API Backend mới.** Chúng ta sẽ chuyển đổi dữ liệu JSON này thành cấu trúc đồ thị.

**Cấu trúc Dữ liệu (SchemaDef):**
```typescript
interface Column {
  name: string;
  type: string;
  is_pk: boolean;
  is_nullable: boolean;
}

interface ForeignKey {
  column: string;
  ref_table: string;
  ref_column: string;
}

interface Table {
  name: string;
  columns: Column[];
  foreign_keys: ForeignKey[];
}
```

# MỤC TIÊU
Triển khai thành phần `SchemaDiagram` sử dụng **React Flow** (bây giờ là `@xyflow/react`) để hiển thị sơ đồ tương tác của các bảng và mối quan hệ của chúng.

# TECH STACK
- **Thư viện:** `reactflow` (cho đồ thị) + `dagre` (cho tính toán auto-layout).
- **Styling:** Tailwind CSS (Phải hỗ trợ chế độ Dark/Light dựa trên các lớp cha).
- **Icons:** Lucide React (`Key`, `Link`, `Table`).

# YÊU CẦU

## 1. Thành phần Node Tùy chỉnh (`TableNode.tsx`)
Tạo một node React Flow tùy chỉnh trông như thẻ schema cơ sở dữ liệu.
- **Header:** Tên Bảng (In đậm, màu nền phân biệt).
- **Body:** Danh sách cột.
  - Hiển thị icon PK (`Key`) nếu `is_pk`.
  - Hiển thị Loại (ví dụ: `integer`, `varchar`).
- **Handles:** Thêm `<Handle type="target" />` ở bên trái và `<Handle type="source" />` ở bên phải (hoặc vị trí phù hợp) để cho phép kết nối.
- **Styling:** Sử dụng màu `border-border` và `bg-surface` để phù hợp với UI hiện có.

## 2. Thuật toán Layout (`useAutoLayout.ts`)
Vì các node thô xuất hiện tại `(0,0)`, hãy triển khai hàm tiện ích sử dụng `dagre` để tính toán vị trí `x` và `y` tự động.
- Input: Mảng Nodes và Edges.
- Output: Nodes với vị trí đã tính toán (Layout cây hoặc phân cấp).

## 3. Thành phần Chính (`SchemaDiagram.tsx`)
- **Logic Chuyển đổi:**
  - Map `schemaDef.tables` -> React Flow **Nodes** (sử dụng type `tableNode`).
  - Map `table.foreign_keys` -> React Flow **Edges**.
    - Source: Tên Bảng Hiện tại.
    - Target: `ref_table`.
    - Edge Style: Smoothstep hoặc Bezier. Thêm marker mũi tên ở cuối.
- **Tương tác:**
  - Bật `fitView` khi tải.
  - Cho phép người dùng kéo nodes xung quanh.
  - Hiển thị "Minimap" và "Controls" (Zoom in/out) được cung cấp bởi React Flow.

# VÍ DỤ CẤU TRÚC MÃ
```tsx
// 1. transformData.ts
// Logic to convert SchemaDef -> { nodes, edges } using dagre for positioning

// 2. TableNode.tsx
// The UI for a single table card

// 3. SchemaDiagram.tsx
export function SchemaDiagram({ schema }: { schema: SchemaDef }) {
  // ... useNodesState, useEdgesState ...
  return (
    <div className="h-[600px] w-full border rounded-lg">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
         <Background />
         <Controls />
      </ReactFlow>
    </div>
  );
}
```

# ĐẦU RA
Tạo mã hoàn chỉnh cho:
1. `TableNode.tsx`
2. `layoutUtils.ts` (Tích hợp dagre).
3. `SchemaDiagram.tsx`.

Đảm bảo UI nhất quán với chủ đề "Dark/Light" được cung cấp trong các snippet `SchemaViewer` trước đó.