# ROLE
You are a Senior Python Backend Developer. Your task is to refactor the `LLMService` in the FastAPI application to support a **Multi-Model Strategy**.

# CONTEXT
- Currently, the application uses a single model (`sqlcoder-thesis`) for both SQL generation and Explanation.
- **Problem:** The coder model is bad at natural language explanation (it tries to write code instead of explaining).
- **Solution:** We need to use two separate models:
  1.  **Coder Model** (`sqlcoder-thesis`): For generating SQL.
  2.  **Chat Model** (`qwen2.5:3b`): For explaining SQL in Vietnamese.

# TASK
Please update the following files to implement this logic.

## 1. Update `app/core/config.py`
Add a new configuration variable for the chat model name.
```python
class Settings(BaseSettings):
    # ... existing configs ...
    OLLAMA_BASE_URL: str = "http://localhost:11434/api/generate"
    MODEL_NAME: str = "sqlcoder-thesis"      # Keep for generation
    MODEL_CHAT_NAME: str = "qwen2.5:3b"      # NEW: Add this for explanation
    
    # ...
```

## 2. Refactor `app/services/llm_service.py`
Rewrite the `LLMService` class to use the correct model based on the task.

**Requirements for `explain_query` method:**
- Use `settings.MODEL_CHAT_NAME`.
- Construct a prompt specifically for **Vietnamese explanation**.
- Enforce a "No Code" constraint in the system prompt.
- Use a higher temperature (e.g., `0.5`) for more natural phrasing.

**Implementation Reference:**

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

## 3. Verify `app/api/v1/endpoints/sql.py`
Ensure the router calls the service correctly (This part is likely already correct, but just double-check).

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