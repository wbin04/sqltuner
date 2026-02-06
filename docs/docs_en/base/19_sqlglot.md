# ROLE
You are a Senior Python Backend Engineer and System Architect.
You are tasked with refactoring the `LLMService` to fix a critical "Hallucination" issue where the LLM suggests indexes for tables (e.g., `cart`) that are NOT present in the user's SQL query (e.g., `SELECT * FROM users`).

# GOAL
Implement a "Zero-Trust" architecture for SQL Optimization using **Context Pruning** and **Post-Generation Guardrails**.

# PREREQUISITES
1.  **Library:** Use `sqlglot` for robust SQL parsing (instead of weak Regex).
2.  **Fail-Safe:** Never fallback to sending the full schema if filtering fails.

# REFACTORING REQUIREMENTS

## 1. Updates to `backend/app/services/llm_service.py`

### A. Imports
Add `import sqlglot` and `from sqlglot import exp`.

### B. Method: `_extract_table_names(self, sql_query: str) -> List[str]`
**Logic:**
1.  Use `sqlglot.parse_one(sql_query)` to create an AST.
2.  Traverse the AST to find all `exp.Table` nodes.
3.  Extract `table.name`, convert to **lowercase**, and store in a Set (to ensure uniqueness).
4.  **Fallback:** Wrap in a `try/except` block. If `sqlglot` fails (syntax error), fall back to the existing Regex logic as a safety net.

### C. Method: `_filter_schema(self, db_schema: str, used_tables: List[str]) -> str`
**Logic:**
1.  Parse `db_schema` (JSON).
2.  Filter tables where `table['name'].lower()` exists in `used_tables`.
3.  **CRITICAL CHANGE (The Fail-Safe):**
    - If `db_schema` is invalid JSON or any error occurs, return `""` (Empty String).
    - **NEVER** return the original `db_schema`. Returning the full schema causes hallucination.

### D. Method: `optimize_sql(self, sql_query: str, db_schema: Optional[str] = None)`
**Workflow:**

1.  **Step 1: Pruning**
    - Call `_extract_table_names` to get `used_tables`.
    - Call `_filter_schema`. If the result is empty, `schema_context` sent to LLM must be empty.

2.  **Step 2: Strict JSON Prompting**
    - System Prompt must emphasize: "Suggest indexes ONLY for tables listed in the provided Schema. Suggesting an index for a missing table is a CRITICAL ERROR."
    - Request STRICT JSON format: `{"optimized_sql": "...", "index_suggestion": "...", "reasoning": "..."}`.

3.  **Step 3: Post-Processing Guardrail (The "Ironclad" Rule)**
    - Parse the JSON response.
    - If `index_suggestion` is present (e.g., "CREATE INDEX ON cart..."):
      - Use Regex or String manipulation to extract the table name from the `ON <table_name>` clause.
      - **Validation:** Check if `extracted_table_name.lower()` is inside `used_tables`.
      - **Action:**
        - If **YES**: Keep the suggestion.
        - If **NO**: Set `index_suggestion = None` and append a warning to `reasoning` (e.g., "[System Rejected: Hallucinated table 'cart']").

4.  **Step 4: Explanation**
    - Call the Chat Model to explain the final result (after the guardrail check).

# DELIVERABLES
Generate the complete, fully refactored code for `backend/app/services/llm_service.py`.

# CONSTRAINTS
- Use `temperature=0.1` for the Coder model.
- Handle JSON parsing errors gracefully.
- Ensure all table name comparisons are **case-insensitive**.