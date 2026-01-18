# VAI TRÒ
Bạn là Senior Fullstack Developer thành thạo **FastAPI (Python)** và **React (TypeScript)**.
Nhiệm vụ của bạn là triển khai hệ thống **Authentication & Role-Based Authorization** hoàn chỉnh cho dự án SQLTuner.

# NGỮ CẢNH
- **Backend:** FastAPI, PostgreSQL, SQLAlchemy.
- **Frontend:** React, Vite, Tailwind CSS.
- **Database:** Bảng `users` đã tồn tại với các cột: `email`, `password` (hashed), và `role` (ENUM: 'admin', 'user').
- **Trạng thái Hiện tại:** Nút login hiện tại là simulation. Chúng ta cần kết nối nó với API thực.

# YÊU CẦU

## 1. Backend: Authentication API (FastAPI)
Triển khai router mới với tag `auth` và prefix `/api/v1/auth`.

### A. Login Endpoint
- **Path:** `POST /api/v1/auth/login`
- **Request Body:** Định dạng JSON.
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Logic:**
  1. Lấy user từ DB theo email.
  2. Xác minh password sử dụng `passlib` (bcrypt).
  3. Tạo **JWT Access Token** (với expiration).
- **Response:**
  ```json
  {
    "access_token": "eyJhbG...",
    "token_type": "bearer",
    "user": {
        "id": "uuid...",
        "email": "admin@example.com",
        "role": "admin",
        "name": "Admin User"
    }
  }
  ```
  *(Lưu ý: Trả về user object ngay lập tức cho phép frontend redirect mà không cần API call thứ hai).*

### B. Security Utilities
- Triển khai dependency `get_current_user` để bảo vệ routes sử dụng `OAuth2PasswordBearer`.

## 2. Frontend: Auth Logic & Routing (React)

### A. Auth Service & Context
- **`authService.ts`**: Axios calls cho login.
- **`AuthContext.tsx`**:
  - Quản lý state: `user` (User | null), `isAuthenticated` (boolean), `isLoading` (boolean).
  - Persist token trong `localStorage` để giữ user đăng nhập sau refresh.
  - Cung cấp methods `login(email, password)` và `logout()`.

### B. Login Page Logic (Quan trọng)
- Trong `src/pages/LoginPage.tsx`, bên trong hàm `handleLogin`:
  1. Gọi `auth.login(data)`.
  2. **Kiểm tra `response.user.role`**.
  3. **Redirect dựa trên role:**
     - IF role là `'admin'` -> Navigate đến `/admin/dashboard`.
     - IF role là `'user'` -> Navigate đến `/dashboard`.

### C. Protected Routes
- Tạo component wrapper `ProtectedRoute`.
  - Nếu chưa đăng nhập -> Redirect đến `/login`.
  - Nếu đã đăng nhập nhưng `role` không khớp với role yêu cầu (ví dụ: User cố truy cập Admin) -> Redirect đến `/403` hoặc `/dashboard`.

# ĐẦU RA

Vui lòng tạo code cho các file sau:

## Backend
1. `backend/app/schemas/token.py` (Pydantic models cho Token & LoginRequest).
2. `backend/app/api/v1/endpoints/auth.py` (Triển khai login router).
3. `backend/app/api/v1/api.py` (Đăng ký router).

## Frontend
4. `src/types/auth.ts` (Interfaces cho User, LoginResponse).
5. `src/context/AuthContext.tsx` (Triển khai provider đầy đủ).
6. `src/pages/LoginPage.tsx` (Cập nhật với API call và Redirect logic).
7. `src/routes/AppRoutes.tsx` (Thiết lập routes với `ProtectedRoute`).

# RÀNG BUỘC
- Sử dụng **JSON Web Tokens (JWT)** qua `python-jose`.
- Đảm bảo typing TypeScript nghiêm ngặt cho User Role.
- Sử dụng `react-router-dom` v6 cho navigation (`useNavigate`).