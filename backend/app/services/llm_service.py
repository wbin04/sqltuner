import json
import logging
import re
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import httpx
import sqlglot
from app.core.config import settings
from app.core.constants import (
    APP_CONFIG_KEY_LLM_URL,
    LLM_HTTP_CONNECT_TIMEOUT,
    LLM_HTTP_POOL_TIMEOUT,
    LLM_HTTP_WRITE_TIMEOUT,
    LLM_REQUEST_TIMEOUT,
    LLM_URL_CACHE_TTL,
)
from app.core.exceptions import LLMServiceError
from app.core.prompts import (SQL_OPTIMIZATION_SYSTEM_PROMPT,
                              get_sql_explanation_prompt,
                              get_sql_optimization_prompt)
from sqlglot import exp

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class OllamaPayload:
    model: str
    prompt: str
    system_prompt: Optional[str] = None
    temperature: float = 0.1
    num_ctx: int = 4096
    num_predict: int = 512
    json_mode: bool = False

    def to_dict(self) -> Dict[str, Any]:
        payload = {
            "model": self.model,
            "prompt": self.prompt,
            "stream": False,
            "keep_alive": "60m",
            "options": {
                "temperature": self.temperature,
                "num_ctx": self.num_ctx,
                "num_predict": self.num_predict,
            },
        }

        if self.system_prompt:
            payload["system"] = self.system_prompt

        if self.json_mode:
            payload["format"] = "json"

        return payload


class LLMService:
    def __init__(self) -> None:
        self.base_url: str = settings.OLLAMA_BASE_URL
        self.coder_model: str = settings.MODEL_NAME
        self.chat_model: str = settings.MODEL_CHAT_NAME
        self.timeout: int = LLM_REQUEST_TIMEOUT
        self._url_cache: Optional[str] = None
        self._cache_timestamp: float = 0
        self._cache_ttl: int = LLM_URL_CACHE_TTL

    def update_base_url(self, new_url: str) -> None:
        if new_url and new_url.strip():
            self.base_url = new_url.strip().rstrip('/')
            self._url_cache = self.base_url
            self._cache_timestamp = time.time()
            logger.info(f"[LLM] Base URL updated to: {self.base_url}")

    async def fetch_and_update_url_from_db(
        self, db: "AsyncSession"
    ) -> None:
        try:
            from app.repositories.config_repository import config_repository

            llm_url = await config_repository.get_config(
                db, APP_CONFIG_KEY_LLM_URL
            )
            if llm_url and llm_url.strip():
                self.update_base_url(llm_url)
                logger.info(
                    f"[LLM] Loaded URL from database: {llm_url}"
                )
            else:
                logger.info(
                    f"[LLM] No URL in database, using default: "
                    f"{settings.OLLAMA_BASE_URL}"
                )
        except Exception as e:
            logger.warning(
                f"[LLM] Failed to fetch URL from database: {e}, "
                f"using default"
            )

    def _create_timeout_config(self) -> httpx.Timeout:
        return httpx.Timeout(
            connect=LLM_HTTP_CONNECT_TIMEOUT,
            read=float(self.timeout),
            write=LLM_HTTP_WRITE_TIMEOUT,
            pool=LLM_HTTP_POOL_TIMEOUT
        )

    def _build_api_url(self, endpoint: str = "generate") -> str:
        return f"{self.base_url}/api/{endpoint}"

    async def _make_ollama_request(
        self, payload: Dict[str, Any], url: str
    ) -> str:
        timeout_config = self._create_timeout_config()

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json().get("response", "").strip()
                logger.info(
                    f"[LLM] Ollama response received, length={len(result)}"
                )
                return result

            except httpx.ConnectError as e:
                error_msg = (
                    f"Cannot connect to Ollama at {url}. Is Ollama running? "
                    f"Error: {str(e)}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise LLMServiceError(f"Ollama Connection Error: {error_msg}")

            except httpx.TimeoutException as e:
                error_msg = (
                    f"Ollama request timed out after {self.timeout}s. "
                    f"Error: {str(e)}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise LLMServiceError(f"Ollama Timeout Error: {error_msg}")

            except httpx.HTTPStatusError as e:
                error_msg = (
                    f"Ollama returned HTTP {e.response.status_code}: "
                    f"{e.response.text}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise LLMServiceError(f"Ollama HTTP Error: {error_msg}")

            except Exception as e:
                error_msg = (
                    f"Unexpected error calling Ollama: {type(e).__name__}: "
                    f"{str(e)}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise LLMServiceError(f"Ollama API Error: {error_msg}")

    async def _call_ollama(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> str:
        url = self._build_api_url()

        payload_config = OllamaPayload(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            num_predict=max_tokens or 512,
            json_mode=json_mode,
        )

        if json_mode:
            logger.info("[LLM] JSON mode enabled")

        logger.info(f"[LLM] Calling Ollama at {url} with model={model}")

        return await self._make_ollama_request(payload_config.to_dict(), url)

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        response_text = await self._call_ollama(
            model=self.coder_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return {"response": response_text}

    async def chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 256
    ) -> str:
        url = self._build_api_url()

        payload_config = OllamaPayload(
            model=self.chat_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            num_ctx=2048,
            num_predict=max_tokens,
        )

        payload = payload_config.to_dict()
        payload["keep_alive"] = "120m"

        logger.info(
            f"[CHAT] Calling Ollama with ctx={payload['options']['num_ctx']}, "
            f"predict={max_tokens}"
        )

        return await self._make_ollama_request(payload, url)

    def _is_sql_query(self, message: str) -> bool:
        try:
            clean_message = re.sub(
                r'```sql\s*|\s*```', '', message, flags=re.IGNORECASE
            )
            clean_message = clean_message.strip()

            sqlglot.parse_one(clean_message)
            logger.info("[INTENT] SQL detected via sqlglot parsing")
            return True
        except Exception:
            pass

        sql_keywords = [
            'SELECT', 'INSERT', 'UPDATE', 'DELETE',
            'CREATE', 'ALTER', 'DROP', 'WITH',
            'TRUNCATE', 'MERGE', 'GRANT', 'REVOKE'
        ]

        message_upper = message.upper()

        for keyword in sql_keywords:
            if re.search(rf'\b{keyword}\b', message_upper):
                logger.info(f"[INTENT] SQL detected via keyword: {keyword}")
                return True

        logger.info("[INTENT] No SQL detected - treating as general chat")
        return False

    def _extract_sql_from_message(self, message: str) -> Optional[str]:
        markdown_pattern = r'```sql\s*(.*?)\s*```'
        markdown_matches = re.findall(
            markdown_pattern, message, re.DOTALL | re.IGNORECASE
        )

        if markdown_matches:
            for candidate_sql in markdown_matches:
                candidate_sql = candidate_sql.strip()
                if self._validate_sql(candidate_sql):
                    logger.info("[EXTRACT] SQL extracted from markdown block")
                    return candidate_sql

        sql_pattern = (
            r'\b(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|'
            r'ALTER|DROP|TRUNCATE)\b.*?(?:;|$)'
        )
        raw_matches = re.findall(
            sql_pattern, message, re.DOTALL | re.IGNORECASE
        )

        if raw_matches:
            for candidate_sql in raw_matches:
                candidate_sql = candidate_sql.strip()
                if self._validate_sql(candidate_sql):
                    logger.info("[EXTRACT] SQL extracted from raw text")
                    return candidate_sql

        logger.info("[EXTRACT] No valid SQL found in message")
        return None

    def _validate_sql(self, sql: str) -> bool:
        try:
            sqlglot.parse_one(sql)
            return True
        except Exception:
            return False

    def _extract_table_names(self, sql_query: str) -> List[str]:
        try:
            parsed = sqlglot.parse_one(sql_query)
            table_names = {
                table.name.lower()
                for table in parsed.find_all(exp.Table)
                if table.name
            }
            return list(table_names)

        except Exception:
            pattern = r"\b(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)"
            matches = re.findall(pattern, sql_query, re.IGNORECASE)
            return list(set(match.lower() for match in matches))

    def _create_minimal_column_info(
        self, column: Dict[str, Any]
    ) -> Dict[str, Any]:
        return {
            "name": column.get("name", ""),
            "data_type": (
                column.get("data_type") or column.get("type", "")
            ),
            "primary_key": (
                column.get("primary_key") or column.get("is_pk", False)
            ),
        }

    def _create_minimal_table_info(
        self, table: Dict[str, Any]
    ) -> Dict[str, Any]:
        return {
            "name": table.get("name", ""),
            "columns": [
                self._create_minimal_column_info(col)
                for col in table.get("columns", [])
            ],
            "indexes": table.get("indexes", []),
        }

    def _filter_tables_by_names(
        self, schema_data: Any, used_tables: List[str]
    ) -> List[Dict[str, Any]]:
        if isinstance(schema_data, dict) and "tables" in schema_data:
            tables = schema_data["tables"]
        elif isinstance(schema_data, list):
            tables = schema_data
        else:
            return []

        return [
            self._create_minimal_table_info(table)
            for table in tables
            if table.get("name", "").lower() in used_tables
        ]

    def _filter_schema(self, db_schema: str, used_tables: List[str]) -> str:
        if not db_schema or not used_tables:
            return ""

        try:
            schema_data = json.loads(db_schema)
            filtered_tables = self._filter_tables_by_names(
                schema_data, used_tables
            )

            if isinstance(schema_data, dict) and "tables" in schema_data:
                return json.dumps(
                    {"tables": filtered_tables}, indent=2
                )
            else:
                return json.dumps(filtered_tables, indent=2)

        except Exception:
            return ""

    def _calculate_schema_reduction(
        self, original_size: int, filtered_size: int
    ) -> float:
        if original_size == 0:
            return 0.0
        return (original_size - filtered_size) / original_size * 100

    def _log_schema_filtering_stats(
        self, original_size: int, filtered_size: int, used_tables: List[str]
    ) -> None:
        reduction = self._calculate_schema_reduction(
            original_size, filtered_size
        )
        logger.info(
            f"[OPTIMIZE] Original schema: {original_size:,} bytes, "
            f"tables: {used_tables}"
        )
        logger.info(
            f"[OPTIMIZE] Filtered schema: {filtered_size:,} bytes "
            f"({reduction:.1f}% reduction)"
        )

    def _create_optimization_payload(
        self, sql_query: str, schema_text: str
    ) -> OllamaPayload:
        user_prompt = get_sql_optimization_prompt(sql_query, schema_text)

        return OllamaPayload(
            model=self.coder_model,
            prompt=user_prompt,
            system_prompt=SQL_OPTIMIZATION_SYSTEM_PROMPT,
            temperature=0.1,
            num_ctx=2048,
            num_predict=150,
            json_mode=True,
        )

    def _clean_json_response(self, raw_response: str) -> str:
        return re.sub(r"```json|```", "", raw_response).strip()

    def _parse_optimization_response(
        self, raw_response: str, original_query: str
    ) -> Dict[str, Any]:
        try:
            clean_json = self._clean_json_response(raw_response)
            parsed = json.loads(clean_json)

            return {
                "optimized_sql": parsed.get("optimized_sql", original_query),
                "index_suggestion": parsed.get("index_suggestion"),
                "explanation": parsed.get("explanation", "Analysis completed"),
            }

        except json.JSONDecodeError as e:
            logger.error(f"[OPTIMIZE] Failed to parse JSON response: {e}")
            return {
                "optimized_sql": original_query,
                "index_suggestion": None,
                "explanation": "Analysis failed due to response parsing error",
            }

    def _validate_index_suggestion(
        self, index_suggestion: Optional[str], used_tables: List[str]
    ) -> tuple[Optional[str], str]:
        if not index_suggestion or not used_tables:
            return index_suggestion, ""

        index_table_pattern = r"\bON\s+([a-zA-Z0-9_]+)"
        index_table_matches = re.findall(
            index_table_pattern, index_suggestion, re.IGNORECASE
        )

        for suggested_table in index_table_matches:
            if suggested_table.lower() not in used_tables:
                reasoning = (
                    f" [System Rejected: Hallucinated table "
                    f"'{suggested_table}' - not in query]"
                )
                return None, reasoning

        return index_suggestion, ""

    async def optimize_sql(
        self, sql_query: str, db_schema: Optional[str] = None
    ) -> Dict[str, Any]:
        used_tables = self._extract_table_names(sql_query)
        original_schema_size = len(db_schema) if db_schema else 0
        filtered_schema = (
            self._filter_schema(db_schema, used_tables) if db_schema else ""
        )

        self._log_schema_filtering_stats(
            original_schema_size, len(filtered_schema), used_tables
        )

        schema_text = (
            f"\nRelevant Schema:\n{filtered_schema}" if filtered_schema else ""
        )
        payload_config = self._create_optimization_payload(
            sql_query, schema_text
        )

        system_len = len(payload_config.system_prompt or "")
        prompt_len = len(payload_config.prompt)
        prompt_size = system_len + prompt_len
        logger.info(f"[OPTIMIZE] Total prompt: {prompt_size:,} bytes")

        llm_start = time.time()
        url = self._build_api_url()
        payload = payload_config.to_dict()
        payload["keep_alive"] = "120m"

        logger.info(
            "[OPTIMIZE] Calling Ollama with ctx=%s, predict=%s",
            payload["options"]["num_ctx"],
            payload["options"]["num_predict"],
        )

        try:
            raw_response = await self._make_ollama_request(payload, url)
        except Exception as exc:
            logger.error(f"[OPTIMIZE] Ollama API error: {str(exc)}")
            raise

        llm_duration = time.time() - llm_start
        logger.info(f"[OPTIMIZE] LLM took: {llm_duration:.2f}s")
        logger.info(f"[OPTIMIZE] Raw LLM response: {raw_response}")

        parsed_result = self._parse_optimization_response(
            raw_response, sql_query
        )
        index_suggestion, rejection_note = self._validate_index_suggestion(
            parsed_result["index_suggestion"],
            used_tables
        )

        reasoning = "Analyzed with Qwen model" + rejection_note

        return {
            "optimized_sql": parsed_result["optimized_sql"].strip(),
            "index_suggestion": index_suggestion,
            "explanation": parsed_result["explanation"].strip(),
            "reasoning": reasoning
        }

    async def explain_query(self, sql_query: str) -> str:
        prompt = get_sql_explanation_prompt(sql_query)
        return await self._call_ollama(
            model=self.chat_model,
            prompt=prompt,
            temperature=0.4
        )

    async def check_health(self) -> bool:
        try:
            url = self._build_api_url("tags")
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                models = data.get("models", [])
                model_names = [m.get("name") for m in models]
                has_coder = self.coder_model in model_names
                has_chat = self.chat_model in model_names
                return has_coder and has_chat

        except Exception:
            return False

    async def warmup_models(self) -> None:
        try:
            logger.info("[LLM-WARMUP] Starting model warm-up...")

            await self.chat(
                prompt="Hi",
                system_prompt="You are a SQL expert",
                max_tokens=50
            )
            logger.info(
                f"[LLM-WARMUP] Warmed up chat model: {self.chat_model}"
            )

            await self.optimize_sql(
                sql_query="SELECT * FROM test", db_schema='{"tables": []}'
            )
            logger.info(
                f"[LLM-WARMUP] Warmed up coder model: {self.coder_model}"
            )

            logger.info("[LLM-WARMUP] Model warm-up completed successfully")

        except Exception as e:
            logger.warning(f"[LLM-WARMUP] Failed to warm up models: {str(e)}")


llm_service = LLMService()
