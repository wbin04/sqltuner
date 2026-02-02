# ROLE
You are a Senior Backend Engineer specializing in Python (FastAPI), SQLAlchemy, and Docker.
Your task is to implement a **Secure & Automated Database Seeding Mechanism** for the SQLTuner project.

# CONTEXT
Currently, we are inserting initial users via raw SQL (`INSERT INTO...`) in `init.sql`. This is insecure because passwords are stored in plain text.
We need to refactor this to use a Python script that automatically hashes passwords before storing them.

# REQUIREMENTS

## 1. Create Seeding Script: `backend/app/db/init_db.py`
Create a Python script that connects to the database and inserts initial users.
- **Dependencies:** Import `get_password_hash` from `app.core.security`.
- **Idempotency:** The script must be **idempotent**. It should check if a user exists (by email) before inserting.
  - IF user exists: Log "User already exists. Skipping."
  - IF user does not exist:
    1. Hash the plain text password using `get_password_hash`.
    2. Insert the user into the `users` table.
    3. Log "User created successfully."
- **Data to Seed:**
  - Admin: `admin@gmail.com` / `admin` (Role: `admin`)
  - User: `quochuy04.ar@gmail.com` / `quochuy04` (Role: `user`)

## 2. Update Entrypoint: `docker/backend/start.sh`
Modify the startup script to execute the seeding script automatically before the server starts.
- **Location:** Insert the command `python app/db/init_db.py` after database migrations/checks and before starting `uvicorn`.
- **Goal:** Ensure every time the container starts, the database is checked and seeded if empty.

## 3. Cleanup & Deployment Instructions
Provide a step-by-step guide to reset the environment to ensure the new seeding logic takes effect without conflicts.
- **Action 1:** Remove legacy `INSERT INTO users...` statements from `docker/database/init.sql`.
- **Action 2:** Command to destroy old volumes and rebuild: `docker-compose down -v && docker-compose up --build`.

# DELIVERABLES
Please provide the full code for:
1. `backend/app/db/init_db.py`
2. `docker/backend/start.sh` (Updated version)