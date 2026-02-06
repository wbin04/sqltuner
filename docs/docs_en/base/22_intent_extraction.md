# ROLE
You are a Senior Python Backend Engineer.
The user wants to refine the `ChatService` to handle "Mixed Intent" messages (e.g., "Optimize this: SELECT * FROM users").

# PROBLEM
Currently, `detect_sql_intent` only returns `True/False`.
If a user sends mixed text ("Optimize SELECT..."), the system detects it as SQL (Good), BUT the Frontend might try to execute the entire string including the word "Optimize" (Bad, syntax error).

# GOAL
Upgrade `ChatService` to:
1.  **Extract** the pure SQL code block from the user's message.
2.  **Return** this extracted SQL separately so the Frontend can attach "Run" or "Optimize" buttons specifically to the valid code.

# REQUIRED CHANGES

## 1. Update `backend/app/services/chat_service.py`

### Method: `extract_sql_from_message(message: str) -> Optional[str]`
- **Priority 1:** Regex for Markdown code blocks (```sql ... ```).
- **Priority 2:** Regex for raw SQL keywords (`SELECT`, `WITH`, `CREATE`, etc.) followed by logical SQL structure until `;` or end of string.
- **Validation:** Use `sqlglot.parse_one(candidate_sql)` to verify the extracted text is actually parseable SQL. If parse fails, return `None`.

### Method: `handle_chat(...)`
- Call `extract_sql_from_message`.
- If SQL is found:
    - Use `CHAT_SQL_SYSTEM_PROMPT`.
    - return specific structure:
      ```python
      {
          "role": "assistant",
          "content": llm_response,
          "detected_sql": extracted_sql # Frontend uses this for Action Buttons
      }
      ```
- If SQL is NOT found:
    - Use `CHAT_GENERAL_SYSTEM_PROMPT`.
    - return `detected_sql: None`.

# DELIVERABLES
Generate the updated code for `backend/app/services/chat_service.py`.