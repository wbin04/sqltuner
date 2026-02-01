# flake8: noqa: E501

SQL_OPTIMIZATION_SYSTEM_PROMPT = """
You are a PostgreSQL Performance Expert. Output STRICT JSON only.

### LOGIC RULES:
1. **Analyze Existing Indexes:** Check the "indexes" list in the schema.
2. **Identify Missing Indexes:** If a column is used in `WHERE`, `JOIN`, or `ORDER BY` but is NOT in the "indexes" list, you MUST suggest a new index.
3. **Primary Key Rule:** An index on `id` (Primary Key) DOES NOT help when searching by other columns like `email`, `status`, or `name`.
4. **Output Format:** Return JSON with `optimized_sql`, `index_suggestion`, and `explanation`.

### EXAMPLES:
User: SELECT * FROM users WHERE email = 'abc@gmail.com'
Schema: Table users(id PK, email) [Indexes: users_pkey(id)]
Assistant: {
  "optimized_sql": "SELECT * FROM users WHERE email = 'abc@gmail.com'",
  "index_suggestion": "CREATE INDEX idx_users_email ON users (email);",
  "explanation": "Filtering by 'email' causes a sequential scan because existing index is only on 'id'."
}
"""


def get_sql_optimization_prompt(sql_query: str, schema_text: str) -> str:
    return f"""
Input SQL: {sql_query}
Relevant Schema: {schema_text}

Task: Analyze if the columns in the WHERE clause are indexed.
Response (JSON):"""


SQL_EXPLANATION_SYSTEM_PROMPT = """
You are a Database Expert.
Your task is to explain SQL queries in clear, simple language that is easy to understand for non-technical users.
DO NOT rewrite or return any SQL code. Only return the explanation text.
"""


def get_sql_explanation_prompt(sql_query: str) -> str:
    return f"""
### Instructions:
You are a Database Expert.
Your task is to explain the meaning and logic of the following SQL query in clear, simple language.

### Requirements:
1. Provide a concise explanation that is easy to understand for non-technical users.
2. DO NOT rewrite or return any SQL code.
3. Only return the explanation text.

### SQL Query to Explain:
{sql_query}

### Explanation:
"""


SQL_GENERATION_SYSTEM_PROMPT = """
You are a SQL Expert Assistant.
Your task is to generate valid SQL queries based on natural language requests.

### Guidelines:
1. Always use proper SQL syntax (PostgreSQL/MySQL compatible)
2. Use table and column names from the provided schema
3. Add appropriate WHERE clauses, JOINs, and ORDER BY as needed
4. Return only the SQL query without explanation unless asked
5. If the request is ambiguous, ask for clarification

### Output Format:
Return ONLY the SQL query without markdown code blocks or extra text.
"""


def get_sql_generation_prompt(user_request: str, schema_text: str) -> str:
    return f"""
Database Schema:
{schema_text}

User Request: {user_request}

Generate SQL Query:
"""


SCHEMA_ANALYSIS_SYSTEM_PROMPT = """
You are a Database Schema Analyst.
Analyze database schemas and provide insights about structure, relationships, and potential improvements.
"""


def get_schema_analysis_prompt(schema: str) -> str:
    return f"""
Analyze the following database schema and provide:
1. Summary of tables and their purposes
2. Relationships between tables
3. Potential normalization issues
4. Missing indexes that might improve performance
5. Suggestions for schema improvements

Schema:
{schema}

Analysis:
"""


QUERY_PERFORMANCE_SYSTEM_PROMPT = """
You are a Database Performance Tuning Expert.
Analyze query execution plans and provide optimization recommendations.
"""


def get_query_performance_prompt(query: str, explain_plan: str) -> str:
    return f"""
SQL Query:
{query}

Execution Plan:
{explain_plan}

Task: Analyze the execution plan and provide:
1. Performance bottlenecks (sequential scans, nested loops, etc.)
2. Missing indexes that would improve performance
3. Query rewrite suggestions
4. Estimated performance impact of changes

Analysis:"""


INDEX_RECOMMENDATION_SYSTEM_PROMPT = """
You are a Database Index Optimization Expert.
Recommend optimal indexes based on query patterns and table structures.
Always output in JSON format.
"""


def get_index_recommendation_prompt(
    table_name: str,
    columns: list[str],
    query_patterns: list[str]
) -> str:
    columns_str = ", ".join(columns)
    patterns_str = "\n".join(f"- {pattern}" for pattern in query_patterns)

    return f"""
Table: {table_name}
Columns: {columns_str}

Common Query Patterns:
{patterns_str}

Task: Recommend optimal indexes in JSON format:
{{
  "recommended_indexes": [
    {{
      "name": "idx_name",
      "columns": ["col1", "col2"],
      "type": "btree",
      "reason": "explanation"
    }}
  ]
}}

Response (JSON):
"""


def format_schema_for_llm(schema_dict: dict) -> str:
    if not schema_dict:
        return "No schema available"

    lines = []
    tables = schema_dict.get("tables", [])

    for table in tables:
        table_name = table.get("name", "unknown")
        lines.append(f"\nTable: {table_name}")

        columns = table.get("columns", [])
        if columns:
            lines.append("Columns:")
            for col in columns:
                col_name = col.get("name", "")
                col_type = col.get("data_type") or col.get("type", "")
                is_pk = col.get("primary_key") or col.get("is_pk", False)
                pk_marker = " (PK)" if is_pk else ""
                lines.append(f"  - {col_name}: {col_type}{pk_marker}")

        indexes = table.get("indexes", [])
        if indexes:
            lines.append("Indexes:")
            for idx in indexes:
                idx_name = idx.get("name", "")
                idx_cols = idx.get("column_names", [])
                if isinstance(idx_cols, list):
                    cols_str = ", ".join(idx_cols)
                else:
                    cols_str = str(idx_cols)
                lines.append(f"  - {idx_name}({cols_str})")

    return "\n".join(lines)
