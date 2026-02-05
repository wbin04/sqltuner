# ROLE
You are a Senior Backend Engineer expert in Python, FastAPI, SQLAlchemy, and OAuth2/OIDC standards.
The user wants to integrate **"Login with Google"** into an existing FastAPI application that uses a **Database-backed Session system with HttpOnly Cookies**.

# CONTEXT
-   **Current Auth:** The system uses a `UserSession` table. Access and Refresh tokens are issued by the backend and stored in HttpOnly Cookies.
-   **Stack:** FastAPI, SQLAlchemy, `authlib`, `itsdangerous`.
-   **Frontend:** React (running at `http://localhost:3000`).
-   **Backend:** FastAPI (running at `http://localhost:8000`).

# GOAL
Implement the Backend-driven OAuth flow:
1.  Frontend redirects user to Backend.
2.  Backend redirects user to Google.
3.  Google redirects back to Backend (`/callback`).
4.  Backend validates Google identity, creates/updates a local User, creates a local Session, sets HttpOnly Cookies, and finally redirects the user back to the Frontend Dashboard.

# REQUIREMENTS

## 1. Database Schema Updates (`models.py`)
Modify the `User` model to accommodate password-less social login:
-   `password`: Change from `nullable=False` to `nullable=True`.
-   `auth_provider`: Add `Column(String, default="email")` (values: 'email', 'google').
-   `google_id`: Add `Column(String, unique=True, nullable=True)`.
-   `avatar_url`: Add `Column(String, nullable=True)`.

## 2. Configuration (`core/config.py`)
Add support for Google Credentials loaded from environment variables:
-   `GOOGLE_CLIENT_ID`
-   `GOOGLE_CLIENT_SECRET`
-   `FRONTEND_URL` (e.g., "http://localhost:3000/dashboard" for the final redirect).

## 3. Middleware Setup (`main.py`)
`Authlib` requires `SessionMiddleware` to manage the OAuth state parameter (CSRF protection).
-   Add `starlette.middleware.sessions.SessionMiddleware` to the FastAPI app.
-   Use a secret key for this middleware.

## 4. Auth Logic Implementation (`api/v1/endpoints/auth.py`)

### A. Setup OAuth Object
-   Initialize `Authlib`'s `OAuth`.
-   Register 'google' using `server_metadata_url='https://accounts.google.com/.well-known/openid-configuration'`.
-   Scope: `openid email profile`.

### B. Endpoint: `GET /login/google`
-   Action: `await oauth.google.authorize_redirect(request, redirect_uri)`.
-   `redirect_uri` should point to the backend callback endpoint (e.g., `http://localhost:8000/api/v1/auth/google/callback`).

### C. Endpoint: `GET /google/callback` (Crucial Logic)
This endpoint bridges Google Identity with the Internal Session System.
1.  **Authorize:** `token = await oauth.google.authorize_access_token(request)`.
2.  **UserInfo:** Extract `user_info` (sub, email, name, picture) from the token (id_token).
3.  **DB Sync (Find or Create):**
    -   Search `User` by `email`.
    -   **Case 1 (New User):** Create `User` (email=..., role='user', auth_provider='google', google_id=sub, avatar_url=picture).
    -   **Case 2 (Existing User):** If `auth_provider` is 'email', link the account by updating `google_id` and `auth_provider` (or handle merge logic). Update `avatar_url`.
    -   **Check Active:** Ensure `user.is_active` is True.
4.  **Internal Session Creation:**
    -   Create a new `UserSession` record in DB (same logic as standard login).
    -   Generate internal `access_token` and `refresh_token`.
5.  **Response:**
    -   Create a `RedirectResponse` to `settings.FRONTEND_URL`.
    -   **Set Cookies:** Attach the internal `access_token` and `refresh_token` to this response using the secure settings (HttpOnly, Secure, SameSite).

# CODE SKELETON

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
    server_metadata_url='[https://accounts.google.com/.well-known/openid-configuration](https://accounts.google.com/.well-known/openid-configuration)',
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

# DELIVERABLES
1.  Code for updating `User` model in `models.py`.
2.  Configuration code for `OAuth` setup.
3.  Full implementation of `login_google` and `auth_google_callback` endpoints.
4.  Middleware configuration instruction.