# ROLE
You are a Senior Python Backend Engineer specializing in LLM integration and Intent Detection.
Your task is to upgrade the `ChatService` in `SQLTuner` to support **Context-Aware Prompting**.

# PROBLEM
Currently, the Chat API treats all user messages as generic conversation.
When a user pastes a SQL script (e.g., for debugging or explanation), the LLM responds like a casual chatbot, often missing the technical depth required for database engineering (e.g., syntax validation, performance risks).

# GOAL
Implement an **Intent Detection** mechanism in the backend:
1.  **Detect:** Check if the user's message contains SQL code.
2.  **Switch:**
    - If SQL is detected -> Use a `SQL_REVIEWER_SYSTEM_PROMPT`.
    - If no SQL -> Use the standard `GENERAL_CHAT_SYSTEM_PROMPT`.

# REQUIRED CHANGES

## 1. Centralize Prompts
**File:** `backend/app/core/prompts.py`
Add two new constants:

1.  `CHAT_GENERAL_SYSTEM_PROMPT`: "You are a helpful assistant for SQLTuner..."
2.  `CHAT_SQL_SYSTEM_PROMPT`:
    - Role: Senior Database Administrator.
    - Instructions:
        1. Check syntax validity (PostgreSQL).
        2. Explain the query's intent.
        3. Identify performance risks (e.g., `SELECT *`, leading wildcards `%...`, missing joins).
        4. Suggest a corrected version if the SQL is invalid.
    - Constraint: Do NOT execute the query. Analysis only.

## 2. Implement Intent Detection Logic
**File:** `backend/app/services/chat_service.py`
Refactor the `chat` method (or create a helper) to detect SQL.

**Logic for `detect_sql_intent(message: str) -> bool`:**
- **Step A:** Use `sqlglot` (already installed) to attempt parsing the first token of the message. If it parses successfully as a SQL expression -> Return `True`.
- **Step B:** If parsing fails (loose text), fallback to Keyword Matching. Check if the message contains uppercase or lowercase keywords like: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `WITH`.
- **Step C:** If detected, set the `system_prompt` to `CHAT_SQL_SYSTEM_PROMPT`. Otherwise, use `CHAT_GENERAL_SYSTEM_PROMPT`.

## 3. Refactor Chat Service
Update the main chat function to use the dynamic system prompt before calling the LLM.

# CODING STANDARDS
- **Libraries:** Use `sqlglot` for parsing detection.
- **Type Hinting:** Strictly typed (`bool`, `str`, `List[dict]`).
- **Clean Code:** Separate the detection logic into a private method `_is_sql_query()`.

# DELIVERABLES
Generate code for:
1.  `backend/app/core/prompts.py` (Updated with new prompts).
2.  `backend/app/services/chat_service.py` (Full refactor with detection logic).

# EXAMPLE SCENARIO
- **Input:** "Hello, how are you?"
  -> **Action:** Uses `GENERAL_PROMPT`.
- **Input:** "SELECT * FROM users WHERE email LIKE '%@gmail.com'"
  -> **Action:** Uses `SQL_REVIEWER_PROMPT`.
  -> **Output:** "This query performs a Full Table Scan due to the leading wildcard..."