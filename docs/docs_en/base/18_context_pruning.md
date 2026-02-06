# ROLE
You are a Senior Python Backend Engineer specializing in LLM Integration and Prompt Engineering.
You are tasked with refactoring the `LLMService` class to fix a critical "Hallucination" issue.

# PROBLEM
Currently, the `optimize_sql` method sends the **ENTIRE** database schema to the LLM.
**Consequence:** When the user queries the `users` table, the LLM sees the `cart` table in the context and hallucinates an index suggestion for `cart` (e.g., `CREATE INDEX ON cart...`), which is irrelevant and logically incorrect for the current query.

# GOAL
Refactor `backend/app/services/llm_service.py` to implement **Context Pruning** and **Strict JSON Output**.

# REQUIREMENTS

## 1. Implement Helper Methods
Add private methods to parse SQL and filter schema data.

### Method: `_extract_table_names(self, sql_query: str) -> List[str]`
- Use Regex to identify table names appearing after `FROM` and `JOIN` keywords.
- Regex pattern suggestion: `r'\b(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)'`.
- Return a unique list of table names.

### Method: `_filter_schema(self, db_schema: str, used_tables: List[str]) -> str`
- Input `db_schema` is expected to be a JSON string (containing a list of tables).
- Parse this JSON.
- Filter the list of tables, keeping **ONLY** those whose `name` exists in `used_tables`.
- Return the filtered data as a formatted JSON string.
- *Error Handling:* If `db_schema` is not valid JSON or None, return it as-is or return an empty string.

## 2. Refactor `optimize_sql` Method

### Step A: Context Pruning
Before calling the LLM, use the helper methods above to generate `filtered_schema`.
- **Logic:** Only provide the LLM with the table definitions relevant to the specific SQL query.

### Step B: Strict JSON Prompting
Change the Prompt strategy to force the LLM to output structured JSON.

- **System Prompt:**
  > "You are a PostgreSQL Performance Expert. Output STRICT JSON only.
  > Rules:
  > 1. Analyze the input SQL and the provided filtered Schema.
  > 2. Suggest a rewritten SQL query if performance can be improved.
  > 3. Suggest Indexes ONLY for the tables explicitly mentioned in the input SQL (FROM/JOIN clauses).
  > 4. DO NOT hallucinate indexes for unrelated tables.
  > 5. If no optimization is needed, return the original SQL."

- **User Prompt:**
  > Input SQL: {sql_query}
  > Relevant Schema: {filtered_schema}
  >
  > Response Format (JSON):
  > {
  >   "optimized_sql": "string",
  >   "index_suggestion": "string or null",
  >   "reasoning": "string"
  > }

### Step C: Response Parsing
- Clean the LLM response (remove markdown code blocks like ```json).
- Parse the string into a Python Dictionary.
- Fallback: If JSON parsing fails, assume the LLM returned raw text and handle gracefully.

### Step D: Explanation (Chained Call)
- Keep the second call to the Chat Model to generate the human-readable explanation based on the JSON result from Step B.

# DELIVERABLES
Generate the full updated code for `backend/app/services/llm_service.py`.

# CONSTRAINTS
- Use standard Python libraries (`re`, `json`) where possible.
- Set LLM `temperature` to `0.1` for the optimization step to reduce creativity/hallucination.
- Ensure type hinting (`List`, `Optional`, `Dict`, `Any`) is preserved.