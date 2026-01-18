# VAI TRÒ
Bạn là Senior Frontend Engineer chuyên xây dựng ứng dụng **React (Vite) + TypeScript** mạnh mẽ, có thể mở rộng.
Bạn tuân theo kiến trúc "Feature-based" hoặc "Component-based" và tuân thủ nghiêm ngặt các nguyên tắc **Clean Code**.

# NGỮ CẢNH DỰ ÁN
Chúng ta đang xây dựng "SQLTuner" - một công cụ tối ưu hóa SQL được hỗ trợ bởi AI.
Ứng dụng có theme "Midnight Blue" Dark Mode.
Chúng ta đang triển khai **HOME / DASHBOARD PAGE** ("Workspace Hub").

# TECH STACK & STANDARDS
- **Framework:** React 18+ (Vite).
- **Language:** TypeScript (Strict mode).
- **Styling:** Tailwind CSS (Utility-first).
- **Icons:** `lucide-react`.
- **Utils:** `clsx` và `tailwind-merge` cho quản lý class (Pattern tiêu chuẩn).

# CẤU TRÚC THƯ MỤC
Vui lòng tạo code phù hợp với cấu trúc thư mục cụ thể này:

```text
src/
├── assets/
├── components/
│   ├── ui/           # Generic atoms (Button, Badge, Card)
│   └── dashboard/    # Dashboard-specific widgets (WorkspaceCard, StatRow)
├── layouts/          # Layout wrappers (MainLayout.tsx, AuthLayout.tsx)
├── lib/              # Utilities (utils.ts for tailwind-merge)
├── pages/            # Page views (DashboardHome.tsx)
├── types/            # TypeScript interfaces (index.ts)
└── App.tsx
```

# DESIGN SYSTEM (TAILWIND CONFIG)
Đầu ra phải sử dụng tên màu semantic được định nghĩa trong `tailwind.config.ts`, không phải mã hex thô trong components.

**Màu Theme:**
- `background`: `#020617` (slate-950)
- `surface`: `#0F172A` (slate-900)
- `surface-highlight`: `#1E293B` (slate-800)
- `primary`: `#3B82F6` (blue-500)
- `secondary`: `#A78BFA` (purple-400)
- `text-main`: `#F8FAFC` (slate-50)
- `text-muted`: `#94A3B8` (slate-400)

# ĐẦU RA

Vui lòng tạo 5 file sau với code đầy đủ:

## 1. `src/lib/utils.ts`
- Triển khai hàm helper `cn()` tiêu chuẩn sử dụng `clsx` và `tailwind-merge`.

## 2. `tailwind.config.ts`
- Mở rộng theme để bao gồm các màu đã đề cập ở trên (ví dụ: `colors.midnight.900`, `colors.primary.DEFAULT`).

## 3. `src/types/index.ts`
- Định nghĩa interfaces cho `Workspace` (id, name, type: 'real' | 'simulation', tableCount, lastSync, status).

## 4. `src/layouts/MainLayout.tsx`
- Application shell với Sidebar cố định.
- Sử dụng Semantic HTML (`<aside>`, `<main>`).
- Làm nổi bật menu item đang active một cách trực quan.

## 5. `src/pages/DashboardHome.tsx`
- **Hero Section:** Hai "Hero Cards" lớn cho "Connect Real DB" vs "Create Sandbox".
  - Sử dụng gradients hoặc border-glow effects khi hover.
- **Grid Section:** Hiển thị danh sách workspaces sử dụng interface `Workspace`.
- **Component Breakdown:** Bạn có thể inline các component nhỏ hơn (như `WorkspaceCard`) trong file này để ngắn gọn, hoặc đề xuất chúng như các component riêng biệt nếu chúng lớn.

# YÊU CẦU UI/UX
- **Visuals:** Minimalist, Data-dense, Dark mode only.
- **Interactivity:** Thêm `hover:scale-[1.01]` và `transition-all` cho cards để chúng cảm thấy xúc giác.
- **Typography:** Sử dụng `font-sans` (Inter/System UI).
- **Responsiveness:** Đảm bảo grid thích ứng từ 1 cột (mobile) đến 3 cột (desktop).