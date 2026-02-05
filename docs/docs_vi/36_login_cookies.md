# VAI TRÒ
Bạn là một Kỹ sư Backend Cấp cao chuyên về Python, FastAPI, SQLAlchemy và Bảo mật Web (tiêu chuẩn OWASP).

# MỤC TIÊU
Refactor hệ thống Xác thực hiện tại từ "Phản hồi Token Bearer đơn giản" sang **"Hệ thống Token Kép dựa trên Cookie HttpOnly (Truy cập + Làm mới)"** với Quản lý Phiên Cơ sở dữ liệu.

# TRẠNG THÁI HIỆN TẠI
-   **Ngăn xếp:** FastAPI, SQLAlchemy, Pydantic, PostgreSQL.
-   **Xác thực Hiện tại:** Token truy cập JWT đơn trả về trong thân phản hồi JSON.
-   **Mô hình Người dùng Hiện tại:** `id`, `email`, `password`, `role`, `created_at`.

# YÊU CẦU

## 1. Cập nhật Lược đồ Cơ sở dữ liệu (`models.py`)

### A. Cập nhật Bảng `User`
Thêm cột sau:
-   `is_active`: Boolean, mặc định `True`.

### B. Tạo Bảng `UserSession`
Tạo bảng mới `user_sessions` để quản lý token làm mới và phiên thiết bị.
-   `session_id`: UUID (Khóa Chính).
-   `user_id`: UUID (Khóa Ngoại đến `users.id`).
-   `refresh_token`: String (Được lập chỉ mục, duy nhất).
-   `user_agent`: String (Có thể null, để theo dõi thiết bị).
-   `ip_address`: String (Có thể null).
-   `expires_at`: DateTime (Dấu thời gian khi token làm mới hết hạn).
-   `created_at`: DateTime (Mặc định bây giờ).
-   `is_revoked`: Boolean (Mặc định `False`).
-   **Mối quan hệ:** Một Người dùng có nhiều UserSessions (`cascade="all, delete-orphan"`).

## 2. Cấu hình Bảo mật (`core/config.py` & `core/security.py`)
-   **Token Truy cập:** Tuổi thọ ngắn (ví dụ: 15-30 phút).
-   **Token Làm mới:** Tuổi thọ dài (ví dụ: 7 ngày).
-   **Cài đặt Cookie:**
    -   `httponly=True` (Ngăn XSS).
    -   `secure=True` (Sản xuất) / `False` (Localhost).
    -   `samesite='Lax'` (Bảo vệ CSRF).
    -   `path='/'` cho Token Truy cập.
    -   `path='/api/v1/auth/refresh'` cho Token Làm mới (Tối ưu hóa).

## 3. Triển khai Logic Xác thực (`api/v1/endpoints/auth.py`)

### A. Điểm cuối: `POST /login`
1.  Xác thực email/mật khẩu.
2.  Kiểm tra `user.is_active`.
3.  Tạo `access_token` và `refresh_token`.
4.  **Hành động DB:** Tạo bản ghi `UserSession` mới với `refresh_token`.
5.  **Phản hồi:**
    -   **Set-Cookie:** `access_token` (HttpOnly).
    -   **Set-Cookie:** `refresh_token` (HttpOnly).
    -   **Thân:** Trả về lược đồ `UserResponse` (Thông tin Người dùng CHỈ, KHÔNG có token).

### B. Điểm cuối: `POST /refresh`
1.  Lấy `refresh_token` từ **Cookie**.
2.  **Xác thực DB:** Tìm `UserSession` theo token này.
    -   Nếu không tìm thấy hoặc `is_revoked=True` hoặc `expires_at < now`: Nâng 401 & Xóa cookie.
3.  **Logic Xoay vòng (Tùy chọn nhưng khuyến nghị):**
    -   Thu hồi token làm mới cũ (hoặc cập nhật tùy thuộc vào chính sách).
    -   Phát hành `access_token` MỚI.
4.  **Phản hồi:**
    -   **Set-Cookie:** `access_token` mới.
    -   Thân: `{"message": "Refreshed"}`.

### C. Điểm cuối: `POST /logout`
1.  Lấy `refresh_token` từ Cookie.
2.  **Hành động DB:** Đánh dấu `UserSession` tương ứng là `is_revoked=True`.
3.  **Phản hồi:**
    -   Xóa cookie `access_token`.
    -   Xóa cookie `refresh_token`.

## 4. Middleware / Phụ thuộc (`api/deps.py`)
Refactor `get_current_user`:
-   **CŨ:** Trích xuất token từ header `Authorization: Bearer ...`.
-   **MỚI:** Trích xuất token từ `request.cookies.get("access_token")`.
-   Xác thực JWT như thường.
-   Kiểm tra `user.is_active` là True.

# GIÁO CỤ MÃ

## `models.py`
```python
class UserSession(Base):
    __tablename__ = "user_sessions"
    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    refresh_token = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False)
    # ... other fields
```

## `api/auth.py` (Ví dụ Đăng nhập)
```python
@router.post("/login", response_model=UserResponse)
def login(response: Response, login_data: LoginRequest, db: Session = Depends(get_db)):
    # ... authenticate user ...
    
    # Create Session
    session_db = UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(session_db)
    db.commit()

    # Set Cookies
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="Lax")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="Lax", path="/api/v1/auth/refresh")

    return user # Return user info only
```

# SẢN PHẨM GIAO
1.  `models.py` đã cập nhật với `UserSession` và `User.is_active`.
2.  `security.py` đã cập nhật với các hàm tạo token riêng biệt.
3.  `auth.py` đã refactor triển khai luồng Đăng nhập/Làm mới/Đăng xuất với Cookie.
4.  `deps.py` đã cập nhật để đọc token từ Cookie.