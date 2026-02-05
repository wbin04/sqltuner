# ROLE
You are a Senior Python Backend Engineer and Database Architect.
The current `ChatService` uses a hardcoded PostgreSQL system prompt. We need to refactor this to support **Multi-DBMS** (PostgreSQL, MySQL, SQLite, SQL Server) dynamically based on the active connection.

# PROBLEM
When a user is connected to a **MySQL** or **SQL Server** database, the LLM still generates PostgreSQL-specific syntax (e.g., `::date` casting, `INTERVAL` syntax), causing syntax errors during execution.

# GOAL
Refactor the prompt generation logic to inject specific syntax rules based on the `dialect` of the current database connection.

# REQUIRED CHANGES

## 1. Refactor `backend/app/core/prompts.py`

**Task:** Replace the static `CHAT_SQL_SYSTEM_PROMPT` constant with a function:
`def get_chat_sql_system_prompt(dialect: str = "postgresql") -> str`

**Logic inside the function:**
1.  Normalize `dialect` to lowercase.
2.  Define a `syntax_rules` string variable based on the dialect:
    - **PostgreSQL:**
      - Casts: `'value'::type`
      - Date Math: `NOW() - INTERVAL '1 day'`
      - Quoting: Double quotes `"` for identifiers.
    - **MySQL/MariaDB:**
      - Casts: `CAST('value' AS DATE)` (No `::` operator)
      - Date Math: `DATE_SUB(NOW(), INTERVAL 1 DAY)`
      - Quoting: Backticks `` ` `` for identifiers.
    - **SQLite:**
      - Date Math: `datetime('now', '-1 day')`
      - Quoting: Double quotes `"` or Backticks `` ` ``.
    - **SQL Server (MSSQL):**
      - Date Math: `DATEADD(day, -1, GETDATE())`
      - Limit: Use `TOP n` instead of `LIMIT n`.
      - Quoting: Brackets `[]`.

**Return:**
Return the f-string prompt injecting `{dialect}` and `{syntax_rules}`.
*Keep the existing "Text Intent > Provided SQL" logic and the 3-line response template.*

## 2. Update `backend/app/services/chat_service.py`

**Task:** Update the `chat` method to retrieve the dialect and call the new prompt function.

**Logic:**
1.  Retrieve the `DBConnection` object using `self.connection_repo.get(db, id=connection_id)`.
2.  Extract the dialect (e.g., `connection.type` or `connection.dialect`). Default to `"postgresql"` if connection is not found.
3.  If `extracted_sql` is detected:
    - Call `system_prompt = get_chat_sql_system_prompt(current_dialect)`.
    - Append a system note to the user message: `"\n[SYSTEM: Detect intent and ensure valid {current_dialect} syntax.]"`

# DELIVERABLES
1.  Full code for the new function in `backend/app/core/prompts.py`.
2.  Updated `chat` method in `backend/app/services/chat_service.py`.

# CONSTRAINT
- Ensure the prompt strictly enforces: **"If User Text conflicts with SQL Logic, User Text wins."**
- The SQL block must be valid for the specific `dialect` requested.