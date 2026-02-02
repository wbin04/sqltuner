# VAI TRÒ
Bạn là Senior Python Backend Engineer và System Architect.
Bạn được giao nhiệm vụ refactor `LLMService` để sửa vấn đề "Hallucination" nghiêm trọng khi LLM đề xuất indexes cho tables (ví dụ: `cart`) mà KHÔNG có trong SQL query của user (ví dụ: `SELECT * FROM users`).

# MỤC TIÊU
Triển khai architecture "Zero-Trust" cho SQL Optimization sử dụng **Context Pruning** và **Post-Generation Guardrails**.

# PREREQUISITES
1.  **Library:** Sử dụng `sqlglot` cho robust SQL parsing (thay vì weak Regex).
2.  **Fail-Safe:** Never fallback to sending full schema nếu filtering fails.

# REFACTORING REQUIREMENTS

## 1. Updates to `backend/app/services/llm_service.py`

### A. Imports
Thêm `import sqlglot` và `from sqlglot import exp`.

### B. Method: `_extract_table_names(self, sql_query: str) -> List[str]`
**Logic:**
1.  Sử dụng `sqlglot.parse_one(sql_query)` để tạo AST.
2.  Traverse AST để tìm tất cả `exp.Table` nodes.
3.  Extract `table.name`, convert thành **lowercase**, và store trong Set (đảm bảo uniqueness).
4.  **Fallback:** Wrap trong `try/except` block. Nếu `sqlglot` fails (syntax error), fall back sang existing Regex logic như safety net.

### C. Method: `_filter_schema(self, db_schema: str, used_tables: List[str]) -> str`
**Logic:**
1.  Parse `db_schema` (JSON).
2.  Filter tables where `table['name'].lower()` exists trong `used_tables`.
3.  **CRITICAL CHANGE (The Fail-Safe):**
    - Nếu `db_schema` invalid JSON hoặc bất kỳ error nào xảy ra, return `""` (Empty String).
    - **NEVER** return original `db_schema`. Returning full schema gây hallucination.

### D. Method: `optimize_sql(self, sql_query: str, db_schema: Optional[str] = None)`
**Workflow:**

1.  **Step 1: Pruning**
    - Call `_extract_table_names` để get `used_tables`.
    - Call `_filter_schema`. Nếu result empty, `schema_context` sent đến LLM phải empty.

2.  **Step 2: Strict JSON Prompting**
    - System Prompt phải emphasize: "Suggest indexes ONLY for tables listed in the provided Schema. Suggesting an index for a missing table is a CRITICAL ERROR."
    - Request STRICT JSON format: `{"optimized_sql": "...", "index_suggestion": "...", "reasoning": "..."}`.

3.  **Step 3: Post-Processing Guardrail (The "Ironclad" Rule)**
    - Parse JSON response.
    - Nếu `index_suggestion` present (ví dụ: "CREATE INDEX ON cart..."):
      - Sử dụng Regex hoặc String manipulation để extract table name từ `ON <table_name>` clause.
      - **Validation:** Check nếu `extracted_table_name.lower()` inside `used_tables`.
      - **Action:**
        - Nếu **YES**: Keep suggestion.
        - Nếu **NO**: Set `index_suggestion = None` và append warning đến `reasoning` (ví dụ: "[System Rejected: Hallucinated table 'cart']").

4.  **Step 4: Explanation**
    - Call Chat Model để explain final result (sau guardrail check).

# ĐẦU RA
Generate complete, fully refactored code cho `backend/app/services/llm_service.py`.

# RÀNG BUỘC
- Sử dụng `temperature=0.1` cho Coder model.
- Handle JSON parsing errors gracefully.
- Ensure tất cả table name comparisons đều **case-insensitive**.