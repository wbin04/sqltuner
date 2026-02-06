# VAI TRÒ
Bạn là Senior Python Backend Engineer chuyên về LLM Integration và Prompt Engineering.
Bạn được giao nhiệm vụ refactor class `LLMService` để sửa vấn đề "Hallucination" nghiêm trọng.

# VẤN ĐỀ
Hiện tại, method `optimize_sql` gửi **TOÀN BỘ** database schema đến LLM.
**Hậu quả:** Khi user query bảng `users`, LLM thấy bảng `cart` trong context và hallucinate đề xuất index cho `cart` (ví dụ: `CREATE INDEX ON cart...`), điều này không liên quan và logic sai cho query hiện tại.

# MỤC TIÊU
Refactor `backend/app/services/llm_service.py` để triển khai **Context Pruning** và **Strict JSON Output**.

# YÊU CẦU

## 1. Triển khai Helper Methods
Thêm private methods để parse SQL và filter schema data.

### Method: `_extract_table_names(self, sql_query: str) -> List[str]`
- Sử dụng Regex để identify table names xuất hiện sau keywords `FROM` và `JOIN`.
- Regex pattern suggestion: `r'\b(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)'`.
- Return unique list của table names.

### Method: `_filter_schema(self, db_schema: str, used_tables: List[str]) -> str`
- Input `db_schema` được expect là JSON string (chứa list của tables).
- Parse JSON này.
- Filter list của tables, giữ **CHỈ** những table có `name` tồn tại trong `used_tables`.
- Return filtered data như formatted JSON string.
- *Error Handling:* Nếu `db_schema` không valid JSON hoặc None, return as-is hoặc empty string.

## 2. Refactor `optimize_sql` Method

### Step A: Context Pruning
Trước khi gọi LLM, sử dụng helper methods ở trên để generate `filtered_schema`.
- **Logic:** Chỉ provide cho LLM table definitions relevant cho specific SQL query.

### Step B: Strict JSON Prompting
Thay đổi Prompt strategy để force LLM output structured JSON.

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
- Clean LLM response (remove markdown code blocks như ```json).
- Parse string thành Python Dictionary.
- Fallback: Nếu JSON parsing fails, assume LLM returned raw text và handle gracefully.

### Step D: Explanation (Chained Call)
- Giữ second call đến Chat Model để generate human-readable explanation dựa trên JSON result từ Step B.

# ĐẦU RA
Generate full updated code cho `backend/app/services/llm_service.py`.

# RÀNG BUỘC
- Sử dụng standard Python libraries (`re`, `json`) where possible.
- Set LLM `temperature` to `0.1` cho optimization step để reduce creativity/hallucination.
- Ensure type hinting (`List`, `Optional`, `Dict`, `Any`) được preserve.