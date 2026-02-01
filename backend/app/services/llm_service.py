import httpx
import re
import json
import sqlglot
from sqlglot import exp
from typing import Optional, Dict, Any, List
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
        max_tokens: Optional[int] = None,
        json_mode: bool = False  # New: Enable JSON output format
    ) -> str:
        """
        Private helper method to call Ollama API
        
        Args:
            model: Model name to use
            prompt: User prompt/query
            system_prompt: Optional system instruction
            temperature: Sampling temperature (0.0 - 1.0)
            max_tokens: Maximum tokens to generate
            json_mode: If True, force JSON output (faster for structured responses)
            
        Returns:
            Response text from Ollama API
        """
        import logging
        logger = logging.getLogger(__name__)
        
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "60m",
            "options": {
                "temperature": temperature,
                "num_ctx": 4096,
                "num_predict": 512  # Limit output tokens for faster response
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens
        
        # Enable JSON mode for structured output (like test_model.py)
        if json_mode:
            payload["format"] = "json"
            logger.info(f"[LLM] JSON mode enabled")
        
        logger.info(f"[LLM] Calling Ollama at {url} with model={model}")
        
        # Use proper httpx.Timeout with high read timeout for LLM inference
        timeout_config = httpx.Timeout(
            connect=10.0,  # Connection timeout: 10 seconds
            read=float(self.timeout),  # Read timeout: 300 seconds for LLM
            write=30.0,  # Write timeout: 30 seconds
            pool=10.0  # Pool timeout: 10 seconds
        )
        
        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json().get("response", "").strip()
                logger.info(f"[LLM] Ollama response received, length={len(result)}")
                return result
            except httpx.ConnectError as e:
                error_msg = f"Cannot connect to Ollama at {url}. Is Ollama running? Error: {str(e)}"
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama Connection Error: {error_msg}")
            except httpx.TimeoutException as e:
                error_msg = f"Ollama request timed out after {self.timeout}s. Error: {str(e)}"
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama Timeout Error: {error_msg}")
            except httpx.HTTPStatusError as e:
                error_msg = f"Ollama returned HTTP {e.response.status_code}: {e.response.text}"
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama HTTP Error: {error_msg}")
            except Exception as e:
                error_msg = f"Unexpected error calling Ollama: {type(e).__name__}: {str(e)}"
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama API Error: {error_msg}")
    
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
    
    def _extract_table_names(self, sql_query: str) -> List[str]:
        """
        Extract table names from SQL query using sqlglot AST parsing.
        Falls back to regex if sqlglot fails.
        
        Args:
            sql_query: SQL query string
            
        Returns:
            List of unique table names (lowercase) found in the query
        """
        try:
            # Use sqlglot to parse SQL into AST
            parsed = sqlglot.parse_one(sql_query)
            
            # Extract all Table nodes from the AST
            table_names = set()
            for table in parsed.find_all(exp.Table):
                if table.name:
                    # Convert to lowercase for case-insensitive comparison
                    table_names.add(table.name.lower())
            
            return list(table_names)
            
        except Exception:
            # Fallback: Use regex if sqlglot parsing fails
            pattern = r'\b(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)'
            matches = re.findall(pattern, sql_query, re.IGNORECASE)
            # Convert to lowercase and deduplicate
            return list(set(match.lower() for match in matches))
    
    def _filter_schema(self, db_schema: str, used_tables: List[str]) -> str:
        """
        Filter database schema to include only tables used in the query.
        Also strips sample_data and other large fields to reduce prompt size.
        FAIL-SAFE: Returns empty string on any error to prevent hallucination.
        
        Args:
            db_schema: JSON string containing database schema
            used_tables: List of table names to keep (lowercase)
            
        Returns:
            Filtered schema as JSON string, or EMPTY STRING if error occurs
        """
        if not db_schema or not used_tables:
            return ""  # Fail-safe: Return empty instead of original
        
        def _strip_table(table: dict) -> dict:
            """Strip unnecessary large fields from table definition"""
            return {
                "name": table.get("name", ""),
                "columns": [
                    {
                        "name": col.get("name", ""),
                        "data_type": col.get("data_type") or col.get("type", ""),
                        "primary_key": col.get("primary_key") or col.get("is_pk", False)
                    }
                    for col in table.get("columns", [])
                ],
                "indexes": table.get("indexes", [])
                # Explicitly NOT including: sample_data, sample_count, etc.
            }
        
        try:
            # Try to parse as JSON
            schema_data = json.loads(db_schema)
            
            # If it's a dict with 'tables' key
            if isinstance(schema_data, dict) and 'tables' in schema_data:
                filtered_tables = [
                    _strip_table(table) for table in schema_data['tables']
                    if table.get('name', '').lower() in used_tables  # Case-insensitive
                ]
                return json.dumps({"tables": filtered_tables}, indent=2)
            
            # If it's a list of tables directly
            elif isinstance(schema_data, list):
                filtered_tables = [
                    _strip_table(table) for table in schema_data
                    if table.get('name', '').lower() in used_tables  # Case-insensitive
                ]
                return json.dumps(filtered_tables, indent=2)
            
            # Unknown format - fail-safe
            return ""
            
        except Exception:
            # CRITICAL: Never return original schema on error
            # This prevents sending full schema to LLM which causes hallucination
            return ""
    
    async def optimize_sql(self, sql_query: str, db_schema: Optional[str] = None) -> dict:
        """
        Optimize SQL query using Coder LLM with Context Pruning and Strict JSON Output.
        
        Context Pruning: Only sends schema for tables actually used in the query
        to prevent LLM hallucination (e.g., suggesting indexes for unrelated tables).
        
        Args:
            sql_query: Original SQL query
            db_schema: Optional database schema information (JSON format)
            
        Returns:
            Dictionary with 'optimized_sql', 'index_suggestion', and 'explanation' keys
        """
        # --- STEP A: CONTEXT PRUNING ---
        # Extract table names from the SQL query
        used_tables = self._extract_table_names(sql_query)
        
        # Filter schema to only include relevant tables
        filtered_schema = self._filter_schema(db_schema, used_tables) if db_schema else ""
        
        schema_text = f"\nRelevant Schema (Only tables used in query):\n{filtered_schema}" if filtered_schema else ""
        
        # --- STEP B: JSON PROMPTING FOR QWEN MODEL ---
        # Use JSON format for structured output
        system_prompt = """You are a PostgreSQL Performance Expert. Output STRICT JSON only.

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
        
        user_prompt = f"""Input SQL: {sql_query}
Relevant Schema: {schema_text}

Task: Analyze if the columns in the WHERE clause are indexed.
Response (JSON):"""
        
        # --- STEP C: JSON RESPONSE PARSING ---
        # Enable json_mode for faster, structured output (matches test_model.py)
        raw_response = await self._call_ollama(
            model=self.coder_model,
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            json_mode=True  # CRITICAL: Force JSON output for speed
        )
        
        # Log raw response for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[OPTIMIZE] Raw LLM response: {raw_response}")
        
        # Parse JSON response
        try:
            # Clean response (remove markdown if any)
            clean_json = re.sub(r"```json|```", "", raw_response).strip()
            parsed = json.loads(clean_json)
            
            optimized_sql = parsed.get("optimized_sql", sql_query)
            index_suggestion = parsed.get("index_suggestion", None)
            explanation = parsed.get("explanation", "Analysis completed")
            
        except json.JSONDecodeError as e:
            logger.error(f"[OPTIMIZE] Failed to parse JSON response: {e}")
            # Fallback to original behavior
            optimized_sql = sql_query
            index_suggestion = None
            explanation = "Analysis failed due to response parsing error"
        
        reasoning = "Analyzed with Qwen model"
        
        # --- POST-PROCESSING VALIDATION (Ironclad Guardrail) ---
        # Validate that index_suggestion only references tables used in the query
        if index_suggestion and used_tables:
            # Extract table name from index suggestion (e.g., "CREATE INDEX ... ON table_name")
            index_table_pattern = r'\bON\s+([a-zA-Z0-9_]+)'
            index_table_matches = re.findall(index_table_pattern, index_suggestion, re.IGNORECASE)
            
            # Check if suggested index is for a table NOT in the query (case-insensitive)
            for suggested_table in index_table_matches:
                if suggested_table.lower() not in used_tables:  # Case-insensitive comparison
                    # REJECT: LLM hallucinated an index for an irrelevant table
                    index_suggestion = None
                    reasoning += f" [System Rejected: Hallucinated table '{suggested_table}' - not in query]"
                    break

        return {
            "optimized_sql": optimized_sql.strip(),
            "index_suggestion": index_suggestion,
            "explanation": explanation.strip(),
            "reasoning": reasoning  # Internal technical reasoning
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
