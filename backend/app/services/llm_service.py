import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

import httpx
import sqlglot
from sqlglot import exp

from backend.app.core.config import settings
from backend.app.core.constants import LLM_REQUEST_TIMEOUT
from backend.app.core.prompts import (SQL_OPTIMIZATION_SYSTEM_PROMPT,
                                      get_sql_explanation_prompt,
                                      get_sql_optimization_prompt)

logger = logging.getLogger(__name__)


class LLMService:

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.coder_model = settings.MODEL_NAME
        self.chat_model = settings.MODEL_CHAT_NAME
        self.timeout = LLM_REQUEST_TIMEOUT

    async def _call_ollama(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None,
        json_mode: bool = False
    ) -> str:
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "60m",
            "options": {
                "temperature": temperature,
                "num_ctx": 4096,
                "num_predict": 512
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        if json_mode:
            payload["format"] = "json"
            logger.info("[LLM] JSON mode enabled")

        logger.info(f"[LLM] Calling Ollama at {url} with model={model}")

        timeout_config = httpx.Timeout(
            connect=10.0,
            read=float(self.timeout),
            write=30.0,
            pool=10.0
        )

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json().get("response", "").strip()
                logger.info(
                    f"[LLM] Ollama response received, length={len(result)}")
                return result
            except httpx.ConnectError as e:
                error_msg = (
                    f"Cannot connect to Ollama at {url}. Is Ollama running? "
                    f"Error: {str(e)}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama Connection Error: {error_msg}")
            except httpx.TimeoutException as e:
                error_msg = (
                    f"Ollama request timed out after {self.timeout}s. "
                    f"Error: {str(e)}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama Timeout Error: {error_msg}")
            except httpx.HTTPStatusError as e:
                error_msg = (
                    f"Ollama returned HTTP {e.response.status_code}: "
                    f"{e.response.text}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama HTTP Error: {error_msg}")
            except Exception as e:
                error_msg = (
                    f"Unexpected error calling Ollama: {type(e).__name__}: "
                    f"{str(e)}"
                )
                logger.error(f"[LLM] {error_msg}")
                raise Exception(f"Ollama API Error: {error_msg}")

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
        url = f"{self.base_url}/api/generate"

        payload = {
            "model": self.chat_model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "120m",
            "options": {
                "temperature": temperature,
                "num_ctx": 2048,
                "num_predict": max_tokens
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        logger.info(f"[CHAT] Calling Ollama"
                    f"with ctx={payload['options']['num_ctx']},"
                    f"predict={max_tokens}")

        timeout_config = httpx.Timeout(
            connect=10.0,
            read=float(self.timeout),
            write=30.0,
            pool=10.0
        )

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json().get("response", "").strip()
                logger.info(f"[CHAT] Response received, length={len(result)}")
                return result
            except httpx.ConnectError as e:
                error_msg = f"Cannot connect to Ollama. Error: {str(e)}"
                logger.error(f"[CHAT] {error_msg}")
                raise Exception(f"Ollama Connection Error: {error_msg}")
            except httpx.TimeoutException:
                error_msg = f"Ollama request timed out after {self.timeout}s"
                logger.error(f"[CHAT] {error_msg}")
                raise Exception(f"Ollama Timeout Error: {error_msg}")
            except httpx.HTTPStatusError as e:
                error_msg = f"Ollama HTTP {e.response.status_code}: " \
                            f"{e.response.text}"
                logger.error(f"[CHAT] {error_msg}")
                raise Exception(f"Ollama HTTP Error: {error_msg}")
            except Exception as exc:
                error_msg = "Unexpected error: " + type(exc).__name__ + \
                            ": " + str(exc)
                logger.error(f"[CHAT] {error_msg}")
                raise Exception(f"Ollama API Error: {error_msg}")

    def _extract_table_names(self, sql_query: str) -> List[str]:
        try:
            parsed = sqlglot.parse_one(sql_query)

            table_names = set()
            for table in parsed.find_all(exp.Table):
                if table.name:
                    table_names.add(table.name.lower())

            return list(table_names)

        except Exception:
            pattern = r'\b(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)'
            matches = re.findall(pattern, sql_query, re.IGNORECASE)
            return list(set(match.lower() for match in matches))

    def _filter_schema(self, db_schema: str, used_tables: List[str]) -> str:
        if not db_schema or not used_tables:
            return ""

        def _strip_table(table: dict) -> dict:
            return {
                "name": table.get("name", ""),
                "columns": [
                    {
                        "name": col.get("name", ""),
                        "data_type": (
                            col.get("data_type") or col.get("type", "")
                        ),
                        "primary_key": (
                            col.get("primary_key") or col.get("is_pk", False)
                        )
                    }
                    for col in table.get("columns", [])
                ],
                "indexes": table.get("indexes", [])
            }

        try:
            schema_data = json.loads(db_schema)

            if isinstance(schema_data, dict) and 'tables' in schema_data:
                filtered_tables = [
                    _strip_table(table) for table in schema_data['tables']
                    if table.get('name', '').lower() in used_tables
                ]
                return json.dumps({"tables": filtered_tables}, indent=2)

            elif isinstance(schema_data, list):
                filtered_tables = [
                    _strip_table(table) for table in schema_data
                    if table.get('name', '').lower() in used_tables
                ]
                return json.dumps(filtered_tables, indent=2)

            return ""

        except Exception:
            return ""

    async def optimize_sql(
            self,
            sql_query: str,
            db_schema: Optional[str] = None) -> dict:
        used_tables = self._extract_table_names(sql_query)

        original_schema_size = len(db_schema) if db_schema else 0
        logger.info(
            f"[OPTIMIZE] Original schema: {original_schema_size:,} bytes, "
            f"tables: {used_tables}"
        )

        filtered_schema = self._filter_schema(
            db_schema, used_tables) if db_schema else ""

        filtered_schema_size = len(filtered_schema)
        reduction = (
            (original_schema_size - filtered_schema_size) /
            original_schema_size * 100
        ) if original_schema_size > 0 else 0
        logger.info(
            f"[OPTIMIZE] Filtered schema: {filtered_schema_size:,} bytes "
            f"({reduction:.1f}% reduction)"
        )

        schema_text = (
            f"\nRelevant Schema:\n{filtered_schema}"
            if filtered_schema else ""
        )

        system_prompt = SQL_OPTIMIZATION_SYSTEM_PROMPT

        user_prompt = get_sql_optimization_prompt(sql_query, schema_text)

        prompt_size = len(system_prompt or "") + len(user_prompt)
        print(f"[DEBUG-OPTIMIZE] Total prompt: {prompt_size:,} bytes")
        logger.info(f"[OPTIMIZE] Total prompt: {prompt_size:,} bytes")

        llm_start = time.time()

        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.coder_model,
            "prompt": user_prompt,
            "stream": False,
            "keep_alive": "120m",
            "format": "json",
            "options": {
                "temperature": 0.1,
                "num_ctx": 2048,
                "num_predict": 150
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        logger.info(
            "[OPTIMIZE] Calling Ollama with ctx=%s, predict=%s",
            payload['options']['num_ctx'],
            payload['options']['num_predict']
        )

        timeout_config = httpx.Timeout(
            connect=10.0,
            read=float(self.timeout),
            write=30.0,
            pool=10.0
        )

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                raw_response = response.json().get("response", "").strip()
            except Exception as exc:
                logger.error(f"[OPTIMIZE] Ollama API error: {str(exc)}")
                raise Exception(f"Ollama API Error: {str(exc)}")

        llm_duration = time.time() - llm_start
        print(
            f"[DEBUG-OPTIMIZE] LLM took: {llm_duration:.2f}s, "
            f"response size: {len(raw_response)} bytes"
        )
        logger.info(f"[OPTIMIZE] LLM took: {llm_duration:.2f}s")

        logger.info(f"[OPTIMIZE] Raw LLM response: {raw_response}")

        try:
            clean_json = re.sub(r"```json|```", "", raw_response).strip()
            parsed = json.loads(clean_json)

            optimized_sql = parsed.get("optimized_sql", sql_query)
            index_suggestion = parsed.get("index_suggestion", None)
            explanation = parsed.get("explanation", "Analysis completed")

        except json.JSONDecodeError as e:
            logger.error(f"[OPTIMIZE] Failed to parse JSON response: {e}")
            optimized_sql = sql_query
            index_suggestion = None
            explanation = "Analysis failed due to response parsing error"

        reasoning = "Analyzed with Qwen model"

        if index_suggestion and used_tables:
            index_table_pattern = r'\bON\s+([a-zA-Z0-9_]+)'
            index_table_matches = re.findall(
                index_table_pattern, index_suggestion, re.IGNORECASE)

            for suggested_table in index_table_matches:
                if suggested_table.lower() not in used_tables:
                    index_suggestion = None
                    reasoning += (
                        f" [System Rejected: Hallucinated table "
                        f"'{suggested_table}' - not in query]"
                    )
                    break

        return {
            "optimized_sql": optimized_sql.strip(),
            "index_suggestion": index_suggestion,
            "explanation": explanation.strip(),
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
            url = f"{self.base_url}/api/tags"
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
                sql_query="SELECT * FROM test",
                db_schema='{"tables": []}'
            )
            logger.info(
                f"[LLM-WARMUP] Warmed up coder model: {self.coder_model}"
            )

            logger.info("[LLM-WARMUP] Model warm-up completed successfully")
        except Exception as e:
            logger.warning(f"[LLM-WARMUP] Failed to warm up models: {str(e)}")


llm_service = LLMService()
