# VAI TRÒ
Bạn là Senior Python Backend Developer. Nhiệm vụ của bạn là refactor `LLMService` trong ứng dụng FastAPI để hỗ trợ **Chiến lược Multi-Model**.

# NGỮ CẢNH
- Hiện tại, ứng dụng sử dụng một mô hình duy nhất (`sqlcoder-thesis`) cho cả việc tạo SQL và Giải thích.
- **Vấn đề:** Mô hình coder kém trong việc giải thích ngôn ngữ tự nhiên (nó cố gắng viết code thay vì giải thích).
- **Giải pháp:** Chúng ta cần sử dụng hai mô hình riêng biệt:
  1.  **Coder Model** (`sqlcoder-thesis`): Để tạo SQL.
  2.  **Chat Model** (`qwen2.5:3b`): Để giải thích SQL bằng tiếng Việt.

# NHIỆM VỤ
Vui lòng cập nhật các file sau để triển khai logic này.

## 1. Cập nhật `app/core/config.py`
Thêm biến cấu hình mới cho tên mô hình chat.
```python
class Settings(BaseSettings):
    # ... existing configs ...
    OLLAMA_BASE_URL: str = "http://localhost:11434/api/generate"
    MODEL_NAME: str = "sqlcoder-thesis"      # Keep for generation
    MODEL_CHAT_NAME: str = "qwen2.5:3b"      # NEW: Add this for explanation
    
    # ...
```

## 2. Refactor `app/services/llm_service.py`
Viết lại lớp `LLMService` để sử dụng mô hình đúng dựa trên nhiệm vụ.

**Yêu cầu cho phương thức `explain_query`:**
- Sử dụng `settings.MODEL_CHAT_NAME`.
- Xây dựng prompt cụ thể cho **giải thích bằng tiếng Việt**.
- Thực thi ràng buộc "No Code" trong system prompt.
- Sử dụng nhiệt độ cao hơn (ví dụ: `0.5`) cho cách diễn đạt tự nhiên hơn.

**Tham khảo Triển khai:**

```python
import httpx
from app.core.config import settings

class LLMService:
    async def _call_ollama(self, model: str, prompt: str, temperature: float = 0.1) -> str:
        """Helper private method to call Ollama API"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    settings.OLLAMA_BASE_URL,
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_ctx": 4096 
                        }
                    }
                )
                response.raise_for_status()
                return response.json().get("response", "").strip()
            except Exception as e:
                # Log error here usually
                raise Exception(f"Ollama API Error: {str(e)}")

    async def explain_query(self, sql_query: str) -> str:
        """
        Explains a SQL query using a Chat-optimized model (Qwen/Gemma).
        """
        # 1. Define the Persona and Constraints
        prompt = f"""
        ### Instructions:
        Bạn là một chuyên gia về Cơ sở dữ liệu (Database Expert).
        Nhiệm vụ của bạn là giải thích ý nghĩa và logic của câu lệnh SQL dưới đây bằng tiếng Việt.
        
        ### Yêu cầu bắt buộc:
        1. Giải thích ngắn gọn, dễ hiểu cho người không chuyên kỹ thuật.
        2. TUYỆT ĐỐI KHÔNG viết lại code SQL hoặc trả về code.
        3. Chỉ trả về văn bản giải thích.

        ### Câu lệnh SQL cần giải thích:
        {sql_query}

        ### Lời giải thích (Tiếng Việt):
        """

        # 2. Call Ollama using the CHAT MODEL
        return await self._call_ollama(
            model=settings.MODEL_CHAT_NAME, # Use qwen2.5:3b
            prompt=prompt,
            temperature=0.4 # Higher temp for natural language
        )

    async def generate_sql(self, schema_context: str, question: str) -> str:
        """
        Generates SQL using the Coder model.
        """
        # ... (Keep your existing generation logic here) ...
        # Ensure this method uses settings.MODEL_NAME (sqlcoder-thesis)
        pass 
```

## 3. Xác minh `app/api/v1/endpoints/sql.py`
Đảm bảo router gọi service đúng cách (Phần này có lẽ đã đúng, nhưng hãy kiểm tra lại).

```python
@router.post("/explain", response_model=SQLExplainResponse)
async def explain_sql(request: SQLExplainRequest):
    try:
        # The logic is now encapsulated in the service
        explanation = await llm_service.explain_query(request.sql_query)
        
        return SQLExplainResponse(
            sql_query=request.sql_query,
            explanation=explanation
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```