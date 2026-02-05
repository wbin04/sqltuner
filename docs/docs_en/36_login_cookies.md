# ROLE
You are a Senior Backend Engineer expert in Python, FastAPI, SQLAlchemy, and Web Security (OWASP standards).

# GOAL
Refactor the current Authentication system from a simple "Bearer Token response" to a secure **"HttpOnly Cookie-based Dual Token System (Access + Refresh)"** with Database Session Management.

# CURRENT STATE
-   **Stack:** FastAPI, SQLAlchemy, Pydantic, PostgreSQL.
-   **Current Auth:** Single JWT access token returned in the JSON response body.
-   **Current User Model:** `id`, `email`, `password`, `role`, `created_at`.

# REQUIREMENTS

## 1. Database Schema Updates (`models.py`)

### A. Update `User` Table
Add the following column:
-   `is_active`: Boolean, default `True`.

### B. Create `UserSession` Table
Create a new table `user_sessions` to manage refresh tokens and device sessions.
-   `session_id`: UUID (Primary Key).
-   `user_id`: UUID (Foreign Key to `users.id`).
-   `refresh_token`: String (Indexed, unique).
-   `user_agent`: String (Nullable, to track device).
-   `ip_address`: String (Nullable).
-   `expires_at`: DateTime (Timestamp when refresh token expires).
-   `created_at`: DateTime (Default now).
-   `is_revoked`: Boolean (Default `False`).
-   **Relationship:** One User has many UserSessions (`cascade="all, delete-orphan"`).

## 2. Security Configuration (`core/config.py` & `core/security.py`)

-   **Access Token:** Short lifespan (e.g., 15-30 minutes).
-   **Refresh Token:** Long lifespan (e.g., 7 days).
-   **Cookie Settings:**
    -   `httponly=True` (Prevent XSS).
    -   `secure=True` (Production) / `False` (Localhost).
    -   `samesite='Lax'` (CSRF protection).
    -   `path='/'` for Access Token.
    -   `path='/api/v1/auth/refresh'` for Refresh Token (Optimization).

## 3. Auth Logic Implementation (`api/v1/endpoints/auth.py`)

### A. Endpoint: `POST /login`
1.  Validate email/password.
2.  Check `user.is_active`.
3.  Generate `access_token` and `refresh_token`.
4.  **DB Action:** Create a new `UserSession` record with the `refresh_token`.
5.  **Response:**
    -   **Set-Cookie:** `access_token` (HttpOnly).
    -   **Set-Cookie:** `refresh_token` (HttpOnly).
    -   **Body:** Return `UserResponse` schema (User info ONLY, NO tokens).

### B. Endpoint: `POST /refresh`
1.  Retrieve `refresh_token` from **Cookie**.
2.  **DB Validation:** Find `UserSession` by this token.
    -   If not found or `is_revoked=True` or `expires_at < now`: Raise 401 & Delete cookies.
3.  **Rotation Logic (Optional but recommended):**
    -   Revoke the old refresh token (or update it depending on policy).
    -   Issue a NEW `access_token`.
4.  **Response:**
    -   **Set-Cookie:** New `access_token`.
    -   Body: `{"message": "Refreshed"}`.

### C. Endpoint: `POST /logout`
1.  Retrieve `refresh_token` from Cookie.
2.  **DB Action:** Mark the corresponding `UserSession` as `is_revoked=True`.
3.  **Response:**
    -   Delete `access_token` cookie.
    -   Delete `refresh_token` cookie.

## 4. Middleware / Dependency (`api/deps.py`)

Refactor `get_current_user`:
-   **OLD:** Extract token from `Authorization: Bearer ...` header.
-   **NEW:** Extract token from `request.cookies.get("access_token")`.
-   Validate JWT as usual.
-   Check `user.is_active` is True.

# CODE SKELETON

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

## `api/auth.py` (Login Example)
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

# DELIVERABLES
1.  Updated `models.py` with `UserSession` and `User.is_active`.
2.  Updated `security.py` with separate token creation functions.
3.  Refactored `auth.py` implementing Login/Refresh/Logout flows with Cookies.
4.  Updated `deps.py` to read token from Cookie.