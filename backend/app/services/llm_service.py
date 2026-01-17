import httpx
from typing import Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.core.constants import LLM_REQUEST_TIMEOUT


class LLMService:
    """
    Service for interacting with Ollama LLM API
    Uses httpx for async HTTP requests
    Supports multi-model strategy:
    - Coder model (sqlcoder-thesis) for SQL generation
    - Chat model (qwen2.5:3b) for SQL explanation
    """
    
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.coder_model = settings.MODEL_NAME  # For SQL generation
        self.chat_model = settings.MODEL_CHAT_NAME  # For explanation
        self.timeout = LLM_REQUEST_TIMEOUT
    
    async def _call_ollama(
        self, 
        model: str,
        prompt: str, 
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Private helper method to call Ollama API
        
        Args:
            model: Model name to use
            prompt: User prompt/query
            system_prompt: Optional system instruction
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Response text from Ollama API
        """
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_ctx": 4096
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return response.json().get("response", "").strip()
            except Exception as e:
                raise Exception(f"Ollama API Error: {str(e)}")
    
    async def generate(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate completion from Ollama model (legacy method for backward compatibility)
        
        Args:
            prompt: User prompt/query
            system_prompt: Optional system instruction
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Response from Ollama API
        """
        response_text = await self._call_ollama(
            model=self.coder_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return {"response": response_text}
    
    async def optimize_sql(self, sql_query: str, db_schema: Optional[str] = None) -> dict:
        """
        Optimize SQL query using Coder LLM and explain with Chat LLM
        
        Args:
            sql_query: Original SQL query
            db_schema: Optional database schema information
            
        Returns:
            Dictionary with 'optimized_sql' and 'explanation' keys
        """
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
            model=self.coder_model,
            prompt=opt_prompt,
            temperature=0.1
        )

        # --- STEP 2: EXPLAIN (Using Chat Model - English) ---
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
            model=self.chat_model,
            prompt=explain_prompt,
            temperature=0.3
        )

        return {
            "optimized_sql": optimized_sql.strip(),
            "explanation": explanation.strip()
        }
    
    async def explain_query(self, sql_query: str) -> str:
        """
        Explain SQL query using Chat-optimized model
        Uses a separate model designed for natural language explanations
        
        Args:
            sql_query: SQL query to explain
            
        Returns:
            Human-readable explanation
        """
        prompt = f"""### Instructions:
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
        
        return await self._call_ollama(
            model=self.chat_model,  # Use chat model (qwen2.5:3b)
            prompt=prompt,
            temperature=0.4  # Higher temperature for more natural language
        )
    
    async def check_health(self) -> bool:
        """
        Check if Ollama service is healthy and both models are available
        
        Returns:
            True if service is healthy and both models exist, False otherwise
        """
        try:
            url = f"{self.base_url}/api/tags"
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                # Check if both models are in the list
                models = data.get("models", [])
                model_names = [m.get("name") for m in models]
                has_coder = self.coder_model in model_names
                has_chat = self.chat_model in model_names
                return has_coder and has_chat
        except Exception:
            return False


# Singleton instance
llm_service = LLMService()
