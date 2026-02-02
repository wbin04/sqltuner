# ROLE
You are a Senior Python Backend Architect specializing in FastAPI, SQLAlchemy, and Clean Architecture.
Your task is to refactor the `SQLTuner` backend codebase to strictly follow the **Repository-Service Pattern** and **Centralize LLM Prompts**.

# CONTEXT & CURRENT STRUCTURE
The project uses FastAPI and SQLAlchemy.
Current Directory Tree:
```text
backend/app/
├── api/v1/endpoints/  # Controllers
├── core/              # Config (Add prompts.py here)
├── models/models.py   # ALL SQLAlchemy models
├── repositories/      # (To be created)
├── services/          # Business logic (currently hardcoding prompts)
│   ├── llm_service.py
│   └── ...
└── main.py
```

# PROBLEM
1.  **Tight Coupling:** API endpoints directly access DB.
2.  **Hardcoded Prompts:** LLM System Prompts are hardcoded strings inside `llm_service.py`, making them hard to manage and version.
3.  **No Abstraction:** Lack of a Repository layer for CRUD.

# GOAL
1.  Refactor Data Access: `API` -> `Service` -> `Repository` -> `Database`.
2.  Refactor Prompts: Move all LLM instructions to `backend/app/core/prompts.py`.

# REQUIRED CHANGES

## 1. Create Directory: `backend/app/repositories/`
Create this new package.

## 2. Implement `BaseRepository`
**File:** `backend/app/repositories/base.py`
Create a generic class `BaseRepository[ModelType, CreateSchemaType, UpdateSchemaType]`.
- Implement: `get`, `get_multi`, `create`, `update`, `delete`.

## 3. Implement Concrete Repositories
**File:** `backend/app/repositories/connection_repository.py`
- Inherit from `BaseRepository`.
- Model: `DBConnection` (from `backend.app.models.models`).

## 4. Centralize Prompts (NEW)
**File:** `backend/app/core/prompts.py`
- Move all system prompts and user prompt templates from `llm_service.py` to this file.
- Define them as string constants or functions.
- Example:
  ```python
  SQL_OPTIMIZATION_SYSTEM_PROMPT = """You are a PostgreSQL Expert..."""
  
  def get_explain_prompt(query: str) -> str:
      return f"Explain this SQL: {query}"
  ```

## 5. Refactor Services
**Target:** `backend/app/services/llm_service.py`
- **Import Prompts:** Import the constants from `backend.app.core.prompts`.
- **Remove Hardcoded Strings:** Replace the hardcoded strings with the imported constants.

**Target:** `backend/app/services/connection_service.py`
- Use `ConnectionRepository` instead of direct `db.query()`.

## 6. Refactor API Endpoints
**Target:** `backend/app/api/v1/endpoints/connections.py`
- Inject `db: Session`.
- Call `connection_service` methods.

# CODING STANDARDS
- **Imports:** Use absolute imports (e.g., `from backend.app.core.prompts import SQL_OPTIMIZATION_SYSTEM_PROMPT`).
- **Clean Code:** Keep `llm_service.py` focused on *calling* the API and handling JSON parsing, not storing text.

# OUTPUT DELIVERABLES
Please generate the full code for:
1.  `backend/app/repositories/base.py`
2.  `backend/app/repositories/connection_repository.py`
3.  `backend/app/core/prompts.py` (New file with extracted prompts)
4.  `backend/app/services/llm_service.py` (Refactored to use prompts.py)
5.  `backend/app/api/v1/endpoints/connections.py` (Refactored endpoint)