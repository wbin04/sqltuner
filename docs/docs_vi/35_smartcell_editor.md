# VAI TRÒ
Bạn là một Kỹ sư Frontend Cấp cao chuyên về React, Tailwind CSS và Thiết kế UX.
Người dùng đang gặp vấn đề UI trong bảng `SampleDataEditor`: Các cột bị nén quá hẹp khi có nhiều cột, gây ra vấn đề hiển thị dữ liệu.

# MỤC TIÊU
Refactor UI bảng để triển khai chiến lược **"Ô Thông minh"**.
1.  **Bố cục Bảng:** Ngăn cột thu hẹp bằng cách thực thi min-width và cho phép cuộn ngang.
2.  **Tương tác Ô:** Tạo thành phần `SmartCell` xử lý văn bản dài thân thiện với người dùng (Cắt ngắn -> Hover Sao chép -> Nhấp để Chỉnh sửa/Mở rộng).

# YÊU CẦU

## 1. Sửa Bố cục Cha (`SampleDataEditor.tsx`)
Cập nhật container bảng và kiểu cột để hỗ trợ cuộn ngang.

-   **Container:** Phải có `overflow-x-auto` để cho phép cuộn nếu cột vượt quá chiều rộng màn hình.
-   **Tiêu đề (`th`) & Ô (`td`):** Áp dụng ràng buộc kích thước cố định để ngăn sụp đổ bố cục.
    -   Lớp CSS: `min-w-[150px] max-w-[300px]` (Có thể điều chỉnh nhưng nhất quán).
    -   Kiểu văn bản: `whitespace-nowrap overflow-hidden text-ellipsis`.

## 2. Triển khai Thành phần: `SmartCell.tsx`

Tạo một thành phần có thể tái sử dụng mới để render nội dung ô.

### Props
```typescript
interface SmartCellProps {
  value: any;
  type: string; // 'VARCHAR', 'INTEGER', 'JSONB', etc.
  onSave: (newValue: any) => void;
  onJsonClick?: () => void; // Callback to open existing JSON Modal
}
```

### Logic & Trạng thái
1.  **Chế độ Xem (Mặc định):**
    -   Render văn bản với `truncate` (một dòng).
    -   **Hiệu ứng Hover:** Hiển thị nút biểu tượng **Sao chép** nhỏ (`lucide-react`) căn phải. Nhấp vào nó sao chép nội dung vào clipboard.
    -   **Hành động Nhấp:** Vào Chế độ Chỉnh sửa.

2.  **Chế độ Chỉnh sửa (Chuyển đổi Thông minh):**
    -   **Điều kiện A (JSON):** Nếu `type` bao gồm 'JSON', render nút được style `[{ } Xem JSON]` kích hoạt `onJsonClick`. Không cho phép chỉnh sửa văn bản inline cho JSON.
    -   **Điều kiện B (Văn bản Ngắn < 50 ký tự):** Render `<input />` tiêu chuẩn vừa với ô.
    -   **Điều kiện C (Văn bản Dài > 50 ký tự):** Render **Popover/Overlay** (định vị `absolute`, `z-index` cao).
        -   Chứa `<textarea>` lớn để xem/chỉnh sửa nội dung đầy đủ.
        -   Có nút "Lưu" (biểu tượng Check) và "Hủy" (biểu tượng X).
        -   Kiểu: Nền trắng, shadow-xl, border, rounded-lg.

### Chi tiết Tương tác
-   **Autofocus:** Input/Textarea nên focus tự động khi mở.
-   **Phím:**
    -   `Enter`: Lưu (cho Input).
    -   `Shift + Enter`: Dòng mới (cho Textarea).
    -   `Escape`: Hủy chỉnh sửa.
-   **Blur:** Lưu thay đổi khi nhấp bên ngoài (cho Input).

# GIÁO CỤ MÃ

## 1. `SmartCell.tsx`
```tsx
import { useState, useEffect, useRef } from 'react';
import { Copy, Check, X, Maximize2 } from 'lucide-react';

export function SmartCell({ value, type, onSave, onJsonClick }: SmartCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const isLong = String(value).length > 50;

  // ... implementation ...
  // Remember to handle z-index correctly for the Popover so it floats above the table
}
```

## 2. Tích hợp trong `SampleDataEditor.tsx`
```tsx
// Inside the .map() of rows
<td className="px-4 py-2 whitespace-nowrap min-w-[150px] max-w-[300px] border-b border-border">
  <SmartCell 
    value={row[col.name]} 
    type={col.type}
    onSave={(val) => handleUpdateRow(rowIndex, col.name, val)}
    onJsonClick={() => openJsonModal(row[col.name])}
  />
</td>
```

# KIỂU TRỰC QUAN
-   Sử dụng **Tailwind CSS**.
-   **Chế độ Tối/Sáng:** Đảm bảo nền (`bg-white` vs `bg-gray-800`) và border thích ứng với chủ đề.
-   **Popover:** Nên trông như một thẻ nổi hơi lớn hơn ô.

# SẢN PHẨM GIAO
Tạo mã hoàn chỉnh cho `SmartCell.tsx` và logic render đã cập nhật cho bảng trong `SampleDataEditor.tsx`.