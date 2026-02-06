# ROLE
You are a Senior Backend Lead and Business Analyst. Your task is to define the Core Business Logic and Sequence Diagrams for the "SQLTuner".

# PROJECT CONTEXT
- **Application:** SQL Optimization Tool.
- **Key Constraints:**
  - Passwords for Target DBs must be encrypted (Fernet).
  - Schema extraction must be read-only and lightweight.
  - The AI Tuning process involves "Chain-of-Thought" (Analyze Plan -> Identify Bottleneck -> Suggest Index).

# OUTPUT REQUIREMENTS

## PART 1: Sequence Diagrams (Mermaid)
Generate Mermaid Sequence Diagrams for the following flows:
1.  **Flow A: Schema Introspection.**
    - User selects a DB Connection -> Backend decrypts credentials -> Connects via SQLAlchemy Inspector -> Fetches Table/Column names -> Returns JSON structure.
2.  **Flow B: SQL Tuning Request.**
    - User submits SQL -> Backend runs `EXPLAIN ANALYZE` -> Backend constructs Prompt (Schema + Plan) -> Calls Ollama API -> Parser extracts JSON advice -> Response to User.

## PART 2: Pseudo-Code / Logic Description
Write detailed pseudo-code (Python-like) for the **Tuner Service**:
- Input: `target_db_id`, `sql_query`.
- Steps:
  1. Retrieve connection details from Internal DB.
  2. Decrypt password.
  3. Establish temporary connection to Target DB.
  4. Run `EXPLAIN (ANALYZE, FORMAT JSON)`.
  5. Parse the JSON result to find nodes with `Node Type = 'Seq Scan'` or high `Total Cost`.
  6. Construct the prompt for the LLM.

## PART 3: Security & Error Handling
- How to handle cases where the User's SQL query is `DROP TABLE` or destructive? (Mention: Read-only transaction mode or Rollback).
- How to handle LLM timeout or hallucination (returning invalid SQL)?