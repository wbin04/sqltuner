# VAI TRÒ
Bạn là một Kỹ sư Frontend cấp cao chuyên về React, TypeScript và Tailwind CSS.
Người dùng muốn nâng cấp thành phần `SQLBlock` hiện có để **Có thể chỉnh sửa** và **Tương tác**.

# NGỮ CẢNH
Hiện tại, `SQLBlock.tsx` hiển thị SQL trong thẻ `<pre>` chỉ đọc. Các nút hành động (Run/Explain/Optimize) kích hoạt callbacks dựa trên `queryLogId` *ban đầu*.
Chúng ta cần thay đổi điều này để người dùng có thể **chỉnh sửa SQL trực tiếp** trong khối, và các nút sẽ hành động trên **mã đã sửa đổi**.

# MÃ HIỆN TẠI
```tsx
import { useState, useEffect } from 'react';
import { Play, Zap, FileText, Copy, Check, AlignLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatSql } from '../../utils/sqlFormatter';

interface SQLBlockProps {
  sql: string;
  queryLogId?: string; // Made optional as we might run new ad-hoc queries
  onExplain?: (sql: string) => void;  // CHANGED: Now accepts SQL string
  onOptimize?: (sql: string) => void; // CHANGED: Now accepts SQL string
  onExecute?: (sql: string) => void;  // CHANGED: Now accepts SQL string
}

export function SQLBlock({ sql, queryLogId, onExplain, onOptimize, onExecute }: SQLBlockProps) {
  // ... existing implementation ...
}
```

# YÊU CẦU

## 1. Chuyển đổi thành Khu vực Có thể Chỉnh sửa
- Thay thế `<pre><code>...</code></pre>` chỉ đọc bằng `<textarea>` (hoặc input được kiểm soát).
- **Styling:** Textarea phải trông như một khối mã:
  - Font: `font-mono`.
  - Background: Phù hợp với chủ đề hiện tại (`bg-background` / `dark:bg-background-dark`).
  - Outline: Không có (`focus:outline-none`).
  - Màu văn bản: Phù hợp với màu syntax highlighting nếu có thể, hoặc màu văn bản tiêu chuẩn.
- **Auto-resize:** Textarea nên tự động mở rộng dựa trên độ dài nội dung (hoặc có min-height hợp lý).

## 2. Cập nhật Quản lý Trạng thái
- Trạng thái `displaySql` nên cập nhật qua handler `onChange` trên textarea.
- Hàm `handleFormat` nên cập nhật trạng thái `displaySql` với phiên bản đã định dạng của văn bản *hiện tại*.

## 3. Cập nhật Nút Hành động
- **Run Query:** Khi nhấp, gọi `onExecute(displaySql)` (truyền mã *đã chỉnh sửa hiện tại*).
- **Explain:** Khi nhấp, gọi `onExplain(displaySql)`.
- **Optimize:** Khi nhấp, gọi `onOptimize(displaySql)`.

## 4. Thay đổi Giao diện Props
- Cập nhật giao diện `SQLBlockProps`. Các callbacks (`onExecute`, v.v.) bây giờ nên chấp nhận đối số `sql: string` thay vì (hoặc ngoài) `queryLogId`.
- *Lý do:* Nếu người dùng chỉnh sửa SQL, `queryLogId` ban đầu không còn liên quan đến ngữ cảnh thực thi/tối ưu hóa.

# ĐẦU RA
Tạo mã `SQLBlock.tsx` đã refactor đầy đủ.
Đảm bảo giữ các lớp Tailwind hiện có cho container, header và buttons để duy trì tính nhất quán UI.