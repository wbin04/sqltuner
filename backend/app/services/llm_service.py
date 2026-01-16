import httpx
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.constants import LLM_REQUEST_TIMEOUT


class LLMService:
    """
    Service for interacting with Ollama LLM API
    Uses httpx for async HTTP requests
    """
    
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.MODEL_NAME
        self.timeout = LLM_REQUEST_TIMEOUT
    
    async def generate(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate completion from Ollama model
        
        Args:
            prompt: User prompt/query
            system_prompt: Optional system instruction
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Response from Ollama API
        """
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
    
    async def optimize_sql(self, sql_query: str, db_schema: Optional[str] = None) -> str:
        """
        Optimize SQL query using LLM
        
        Args:
            sql_query: Original SQL query
            db_schema: Optional database schema information
            
        Returns:
            Optimized SQL query
        """
        system_prompt = """You are a SQL optimization expert. 
Analyze the given SQL query and provide an optimized version.
Focus on: indexes, query structure, joins, subqueries, and performance.
Return ONLY the optimized SQL query without explanations."""

        prompt = f"Optimize this SQL query:\n\n{sql_query}"
        
        if db_schema:
            prompt += f"\n\nDatabase schema:\n{db_schema}"
        
        result = await self.generate(prompt=prompt, system_prompt=system_prompt)
        return result.get("response", "")
    
    async def explain_query(self, sql_query: str) -> str:
        """
        Get explanation of SQL query
        
        Args:
            sql_query: SQL query to explain
            
        Returns:
            Human-readable explanation
        """
        system_prompt = """You are a SQL expert. 
Explain the given SQL query in clear, simple terms.
Focus on what the query does and how it works."""

        prompt = f"Explain this SQL query:\n\n{sql_query}"
        
        result = await self.generate(prompt=prompt, system_prompt=system_prompt)
        return result.get("response", "")
    
    async def check_health(self) -> bool:
        """
        Check if Ollama service is healthy and model is available
        
        Returns:
            True if service is healthy, False otherwise
        """
        try:
            url = f"{self.base_url}/api/tags"
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                # Check if our model is in the list
                models = data.get("models", [])
                return any(m.get("name") == self.model_name for m in models)
        except Exception:
            return False


# Singleton instance
llm_service = LLMService()
