# VAI TRÒ
Bạn là Senior Python Backend Developer.

# NHIỆM VỤ
Cập nhật phương thức `optimize_sql` trong `app/services/llm_service.py`.

# YÊU CẦU
Prompt giải thích nên bằng **tiếng Anh** (hoặc trung lập), cho phép LLM giải thích logic tối ưu hóa một cách tự nhiên bằng tiếng Anh kỹ thuật.

# THAY ĐỔI CODE
Thay thế phương thức `optimize_sql` bằng triển khai sau:

```python
    async def optimize_sql(self, sql_query: str, db_schema: Optional[str] = None) -> dict:
        # --- STEP 1: OPTIMIZE (Using Coder Model) ---
        schema_text = f"\nDatabase Schema:\n{db_schema}" if db_schema else ""
        
        opt_prompt = f"""
        ### Task:
        Optimize the following SQL query for PostgreSQL performance.
        1. Use JOINs instead of subqueries where possible.
        2. Ensure valid syntax.
        3. OUTPUT ONLY THE SQL CODE. NO COMMENTS.
        
        ### Original SQL:
        {sql_query}
        {schema_text}
        
        ### Optimized SQL:
        """
        
        optimized_sql = await self._call_ollama(
            model=settings.MODEL_SQL_CODER,
            prompt=opt_prompt,
            temperature=0.1
        )

        # --- STEP 2: EXPLAIN (Using Chat Model - English/Neutral) ---
        # REMOVED: Vietnamese language constraint.
        explain_prompt = f"""
        ### Role:
        You are a Database Performance Expert.

        ### Task:
        Compare the Original SQL and the Optimized SQL below.
        Explain briefly and concisely **WHY** the optimized version is better (e.g., performance benefits, index usage, readability).

        (1) Original: {sql_query}
        (2) Optimized: {optimized_sql}

        ### Explanation:
        """

        explanation = await self._call_ollama(
            model=settings.MODEL_CHAT,
            prompt=explain_prompt,
            temperature=0.3
        )

        return {
            "optimized_sql": optimized_sql.strip(),
            "explanation": explanation.strip()
        }
```