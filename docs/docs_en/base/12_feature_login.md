# ROLE
You are a Senior Fullstack Developer proficient in **FastAPI (Python)** and **React (TypeScript)**.
Your task is to implement a complete **Authentication & Role-Based Authorization** system for the SQLTuner project.

# CONTEXT
- **Backend:** FastAPI, PostgreSQL, SQLAlchemy.
- **Frontend:** React, Vite, Tailwind CSS.
- **Database:** The `users` table already exists with columns: `email`, `password` (hashed), and `role` (ENUM: 'admin', 'user').
- **Current State:** The login button is currently a simulation. We need to connect it to a real API.

# REQUIREMENTS

## 1. Backend: Authentication API (FastAPI)
Implement a new router tag `auth` with the prefix `/api/v1/auth`.

### A. Login Endpoint
- **Path:** `POST /api/v1/auth/login`
- **Request Body:** JSON format.
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Logic:**
  1. Fetch user from DB by email.
  2. Verify password using `passlib` (bcrypt).
  3. Create a **JWT Access Token** (with expiration).
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
  *(Note: Returning the user object immediately allows the frontend to redirect without a second API call).*

### B. Security Utilities
- Implement `get_current_user` dependency to protect routes using `OAuth2PasswordBearer`.

## 2. Frontend: Auth Logic & Routing (React)

### A. Auth Service & Context
- **`authService.ts`**: Axios calls for login.
- **`AuthContext.tsx`**:
  - Manage state: `user` (User | null), `isAuthenticated` (boolean), `isLoading` (boolean).
  - Persist the token in `localStorage` to keep the user logged in after refresh.
  - Provide `login(email, password)` and `logout()` methods.

### B. Login Page Logic (Crucial)
- In `src/pages/LoginPage.tsx`, inside the `handleLogin` function:
  1. Call `auth.login(data)`.
  2. **Check `response.user.role`**.
  3. **Redirect based on role:**
     - IF role is `'admin'` -> Navigate to `/admin/dashboard`.
     - IF role is `'user'` -> Navigate to `/dashboard`.

### C. Protected Routes
- Create a `ProtectedRoute` component wrapper.
  - If not logged in -> Redirect to `/login`.
  - If logged in but `role` does not match required role (e.g., User trying to access Admin) -> Redirect to `/403` or `/dashboard`.

# DELIVERABLES

Please generate code for the following files:

## Backend
1. `backend/app/schemas/token.py` (Pydantic models for Token & LoginRequest).
2. `backend/app/api/v1/endpoints/auth.py` (The login router implementation).
3. `backend/app/api/v1/api.py` (Registration of the router).

## Frontend
4. `src/types/auth.ts` (Interfaces for User, LoginResponse).
5. `src/context/AuthContext.tsx` (Full provider implementation).
6. `src/pages/LoginPage.tsx` (Updated with API call and Redirect logic).
7. `src/routes/AppRoutes.tsx` (Setup routes with `ProtectedRoute`).

# CONSTRAINTS
- Use **JSON Web Tokens (JWT)** via `python-jose`.
- Ensure strict TypeScript typing for the User Role.
- Use `react-router-dom` v6 for navigation (`useNavigate`).