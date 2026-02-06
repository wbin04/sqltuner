# VAI TRÒ
Bạn là một Kỹ sư Backend cấp cao chuyên về Python, FastAPI, SQLAlchemy và OAuth2/OIDC standards.
Người dùng muốn tích hợp **"Đăng nhập bằng Google"** vào ứng dụng FastAPI hiện có sử dụng **Hệ thống Session được hỗ trợ bởi Cơ sở dữ liệu với HttpOnly Cookies**.

# NGỮ CẢNH
- **Auth hiện tại:** Hệ thống sử dụng bảng `UserSession`. Access và Refresh tokens được cấp bởi backend và lưu trữ trong HttpOnly Cookies.
- **Stack:** FastAPI, SQLAlchemy, `authlib`, `itsdangerous`.
- **Frontend:** React (chạy tại `http://localhost:3000`).
- **Backend:** FastAPI (chạy tại `http://localhost:8000`).

# MỤC TIÊU
Triển khai luồng OAuth do Backend điều khiển:
1. Frontend chuyển hướng người dùng đến Backend.
2. Backend chuyển hướng người dùng đến Google.
3. Google chuyển hướng lại đến Backend (`/callback`).
4. Backend xác thực danh tính Google, tạo/cập nhật người dùng cục bộ, tạo Session cục bộ, đặt HttpOnly Cookies và cuối cùng chuyển hướng người dùng trở lại Frontend Dashboard.

# YÊU CẦU

## 1. Cập nhật Schema Cơ sở dữ liệu (`models.py`)
Sửa đổi mô hình `User` để phù hợp với đăng nhập xã hội không mật khẩu:
- `password`: Thay đổi từ `nullable=False` thành `nullable=True`.
- `auth_provider`: Thêm `Column(String, default="email")` (giá trị: 'email', 'google').
- `google_id`: Thêm `Column(String, unique=True, nullable=True)`.
- `avatar_url`: Thêm `Column(String, nullable=True)`.

## 2. Cấu hình (`core/config.py`)
Thêm hỗ trợ cho Thông tin xác thực Google được tải từ biến môi trường:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FRONTEND_URL` (ví dụ: "http://localhost:3000/dashboard" cho chuyển hướng cuối cùng).

## 3. Thiết lập Middleware (`main.py`)
`Authlib` yêu cầu `SessionMiddleware` để quản lý tham số trạng thái OAuth (bảo vệ CSRF).
- Thêm `starlette.middleware.sessions.SessionMiddleware` vào ứng dụng FastAPI.
- Sử dụng một secret key cho middleware này.

## 4. Triển khai Logic Auth (`api/v1/endpoints/auth.py`)

### A. Thiết lập OAuth Object
- Khởi tạo `OAuth` của `Authlib`.
- Đăng ký 'google' sử dụng `server_metadata_url='https://accounts.google.com/.well-known/openid-configuration'`.
- Scope: `openid email profile`.

### B. Endpoint: `GET /login/google`
- Action: `await oauth.google.authorize_redirect(request, redirect_uri)`.
- `redirect_uri` nên trỏ đến endpoint callback backend (ví dụ: `http://localhost:8000/api/v1/auth/google/callback`).

### C. Endpoint: `GET /google/callback` (Logic Quan trọng)
Endpoint này kết nối danh tính Google với Hệ thống Session Nội bộ.
1. **Authorize:** `token = await oauth.google.authorize_access_token(request)`.
2. **UserInfo:** Trích xuất `user_info` (sub, email, name, picture) từ token (id_token).
3. **DB Sync (Tìm hoặc Tạo):**
   - Tìm kiếm `User` theo `email`.
   - **Trường hợp 1 (Người dùng Mới):** Tạo `User` (email=..., role='user', auth_provider='google', google_id=sub, avatar_url=picture).
   - **Trường hợp 2 (Người dùng Hiện có):** Nếu `auth_provider` là 'email', liên kết tài khoản bằng cách cập nhật `google_id` và `auth_provider` (hoặc xử lý logic merge). Cập nhật `avatar_url`.
   - **Kiểm tra Hoạt động:** Đảm bảo `user.is_active` là True.
4. **Tạo Session Nội bộ:**
   - Tạo bản ghi `UserSession` mới trong DB (logic giống như đăng nhập tiêu chuẩn).
   - Tạo `access_token` và `refresh_token` nội bộ.
5. **Response:**
   - Tạo `RedirectResponse` đến `settings.FRONTEND_URL`.
   - **Set Cookies:** Gắn `access_token` và `refresh_token` nội bộ vào response này bằng cách sử dụng các cài đặt bảo mật (HttpOnly, Secure, SameSite).

# PHÁC THẢO MÃ

## `main.py`
```python
from starlette.middleware.sessions import SessionMiddleware
# ...
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)
```

## `api/auth.py`
```python
from authlib.integrations.starlette_client import OAuth
from starlette.responses import RedirectResponse
# ... imports

oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@router.get("/login/google")
async def login_google(request: Request):
    redirect_uri = request.url_for('auth_google_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/google/callback", name="auth_google_callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    # 1. Get Google Token
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    
    # 2. Sync User Logic
    email = user_info.get('email')
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Create new user logic...
        pass
    else:
        # Update existing user logic...
        pass
        
    # 3. Create Internal Session (Reuse your existing create_session logic)
    # access_token, refresh_token = create_tokens_for_user(user)
    # save_session_to_db(...)

    # 4. Redirect with Cookies
    response = RedirectResponse(url=settings.FRONTEND_URL)
    
    # IMPORTANT: Set the same HttpOnly cookies as the normal login flow
    response.set_cookie(key="access_token", value=access_token, httponly=True, ...)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, ...)
    
    return response
```

# ĐẦU RA
1. Mã để cập nhật mô hình `User` trong `models.py`.
2. Mã cấu hình cho thiết lập `OAuth`.
3. Triển khai đầy đủ của các endpoint `login_google` và `auth_google_callback`.
4. Hướng dẫn cấu hình Middleware.