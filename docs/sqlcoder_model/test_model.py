import requests
import json
import re

# --- 1. CẤU HÌNH ---
# Nên dùng model 3B trở lên cho task suy luận (reasoning) index. 
# Nếu 1.5B trả lời sai logic, hãy đổi sang qwen2.5:3b
MODEL_NAME = "qwen2.5:3b"  
API_URL = "http://localhost:11434/api/generate"

# --- 2. DATA ĐẦU VÀO (Như bạn cung cấp) ---
db_schema = {
    "tables": [
        {
            "name": "users",
            "columns": [
                {"name": "id", "data_type": "INTEGER", "primary_key": True},
                {"name": "email", "data_type": "VARCHAR"},
                {"name": "password", "data_type": "VARCHAR"},
                {"name": "role", "data_type": "VARCHAR"},
                {"name": "created_at", "data_type": "TIMESTAMP"}
            ],
            "indexes": [
                {"name": "users_pkey", "columns": ["id"], "unique": True}
            ]
        },
        {
            "name": "cart",
            "columns": [
                {"name": "id", "data_type": "INTEGER"},
                {"name": "user_id", "data_type": "INTEGER"},
                {"name": "total", "data_type": "DECIMAL"}
            ]
        }
    ]
}

input_sql = "SELECT * FROM users WHERE email = 'kfc@gmail.com'"

# --- 3. HÀM XỬ LÝ SCHEMA (Dict -> Text) ---
def format_schema_to_text(schema_dict):
    """Chuyển schema từ dict sang text gọn nhẹ để tiết kiệm token cho LLM"""
    schema_text = []
    for table in schema_dict.get("tables", []):
        cols = []
        for col in table["columns"]:
            col_str = f"{col['name']} {col['data_type']}"
            if col.get("primary_key"):
                col_str += " PK"
            cols.append(col_str)
        
        indexes = []
        if "indexes" in table:
            for idx in table["indexes"]:
                indexes.append(f"INDEX({', '.join(idx['columns'])})")
        
        table_desc = f"TABLE {table['name']} ({', '.join(cols)})"
        if indexes:
            table_desc += f" [Existing Indexes: {', '.join(indexes)}]"
        schema_text.append(table_desc)
    
    return "\n".join(schema_text)

# --- 4. GỌI OLLAMA ---
def suggest_optimization(sql, schema_dict):
    # Chuẩn bị schema dạng text
    filtered_schema_text = format_schema_to_text(schema_dict)
    
    # SYSTEM PROMPT (Của bạn)
    sys_prompt = """You are a PostgreSQL Performance Expert. Output STRICT JSON only.

### LOGIC RULES:
1. **Analyze Existing Indexes:** Check the "indexes" list in the schema.
2. **Identify Missing Indexes:** If a column is used in `WHERE`, `JOIN`, or `ORDER BY` but is NOT in the "indexes" list, you MUST suggest a new index.
3. **Primary Key Rule:** An index on `id` (Primary Key) DOES NOT help when searching by other columns like `email`, `status`, or `name`.
4. **Output Format:** Return JSON with `optimized_sql`, `index_suggestion`, and `reasoning`.

### EXAMPLES:
User: SELECT * FROM users WHERE email = 'abc@gmail.com'
Schema: Table users(id PK, email) [Indexes: users_pkey(id)]
Assistant: {
  "optimized_sql": "SELECT * FROM users WHERE email = 'abc@gmail.com'",
  "index_suggestion": "CREATE INDEX idx_users_email ON users (email);",
  "reasoning": "Filtering by 'email' causes a sequential scan because existing index is only on 'id'."
}
"""

    # USER PROMPT (Của bạn)
    user_prompt = f"""Input SQL: {input_sql}
Relevant Schema: {format_schema_to_text(db_schema)}

Task: Analyze if the columns in the WHERE clause are indexed.
Response (JSON):"""

    payload = {
        "model": MODEL_NAME,
        "prompt": user_prompt,
        "system": sys_prompt,
        "stream": False,
        "keep_alive": "60m",
        "options": {
            "temperature": 0.1, # Cần chút sáng tạo để viết reasoning nhưng vẫn phải đúng format
            "num_predict": 512, # Đủ dài cho JSON
            "top_p": 0.9
        },
        "format": "json" # <--- QUAN TRỌNG: Ollama hỗ trợ mode JSON native
    }

    print(f"--- Đang phân tích SQL với {MODEL_NAME}... ---")
    try:
        response = requests.post(API_URL, json=payload)
        res_json = response.json()
        
        raw_content = res_json.get("response", "")
        
        # Parse JSON từ kết quả (đề phòng model trả về markdown block)
        # Qwen hay bọc trong ```json ... ```
        clean_json = re.sub(r"```json|```", "", raw_content).strip()
        
        return json.loads(clean_json)

    except Exception as e:
        return {"error": str(e), "raw": raw_content if 'raw_content' in locals() else ""}

# --- 5. CHẠY THỬ ---
import time
start_time = time.time()
result = suggest_optimization(input_sql, db_schema)
end_time = time.time()

print(f"Time: {end_time - start_time}")
print("\n=== KẾT QUẢ TỪ MODEL ===")
print(json.dumps(result, indent=2, ensure_ascii=False))