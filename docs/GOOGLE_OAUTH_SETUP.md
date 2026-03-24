# Google OAuth Setup Guide

## 1. Tạo Google OAuth Credentials

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo hoặc chọn một project
3. Vào **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Chọn **Application type**: Web application
6. Cấu hình:
   - **Name**: SQLTuner
   - **Authorized JavaScript origins**: 
     - Development: `http://localhost:8000`, `http://localhost:5173`
     - Production: `https://your-frontend-url`, `https://your-backend-url`
   - **Authorized redirect URIs**:
     - Development: `http://localhost:8000/api/v1/auth/google/callback`
     - Production: `https://your-backend-url/api/v1/auth/google/callback`
7. Click **Create** và lưu lại **Client ID** và **Client Secret**

## 2. Cấu hình Backend

### Development (Local)

Thêm vào file `.env`:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
FRONTEND_URL=http://localhost:5173/workspaces
```

### Production (Cloud Run)

Thêm vào file `.env` hoặc Cloud Run environment variables:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
FRONTEND_URL=https://your-frontend-url/workspaces
BACKEND_URL=https://your-backend-url
```

**Lưu ý:** `BACKEND_URL` phải sử dụng `https://` để redirect URI khớp với cấu hình trong Google Cloud Console.

## 3. Cài đặt Dependencies

```bash
cd backend
pip install authlib itsdangerous
```

## 4. Chạy Migration

```bash
cd backend
alembic upgrade head
```

## 5. Kiểm tra

1. Khởi động backend: `python run.py`
2. Khởi động frontend: `npm run dev`
3. Truy cập `http://localhost:5173/login`
4. Click nút "Sign in with Google"
5. Đăng nhập bằng Google account
6. Sau khi đăng nhập thành công, bạn sẽ được redirect về trang Workspaces

## Flow hoạt động

```
Frontend (/login)
    ↓ Click "Sign in with Google"
Backend (/api/v1/auth/login/google)
    ↓ Redirect to Google
Google OAuth
    ↓ User authorizes
Backend (/api/v1/auth/google/callback)
    ↓ Get user info from Google
    ↓ Create/Update user in DB
    ↓ Create session
    ↓ Set HttpOnly cookies
Frontend (/workspaces)
    ✓ Logged in
```

## Lưu ý

- Password field trong User model đã chuyển sang `nullable=True` để hỗ trợ OAuth login
- Thêm các fields mới: `auth_provider`, `google_id`, `avatar_url`
- Cookies được set với cùng config như email/password login
- Google OAuth có thể disable bằng cách để trống `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`

## Troubleshooting

### Lỗi redirect_uri_mismatch

Nếu gặp lỗi: `redirect_uri=http://...` nhưng config trong Google Cloud Console là `https://...`

**Nguyên nhân:** Backend không sử dụng đúng HTTPS URL khi tạo redirect URI.

**Giải pháp:**
1. Đảm bảo đã set biến môi trường `BACKEND_URL` với giá trị `https://your-backend-url`
2. Kiểm tra redirect URI trong Google Cloud Console phải khớp chính xác: `https://your-backend-url/api/v1/auth/google/callback`
3. Xóa cache trình duyệt và thử lại
