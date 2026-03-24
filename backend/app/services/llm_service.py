import json
import logging
import re
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import httpx
import sqlglot
from app.core.config import settings
from app.core.constants import (APP_CONFIG_KEY_LLM_URL,
                                LLM_HTTP_CONNECT_TIMEOUT,
                                LLM_HTTP_POOL_TIMEOUT, LLM_HTTP_WRITE_TIMEOUT,
                                LLM_REQUEST_TIMEOUT, LLM_URL_CACHE_TTL)
from app.core.exceptions import LLMServiceError
from app.core.prompts import (SCHEMA_CLARIFICATION_SYSTEM_PROMPT,
                              SCHEMA_GENERATION_SYSTEM_PROMPT,
                              SQL_OPTIMIZATION_SYSTEM_PROMPT,
                              get_schema_clarification_prompt,
                              get_schema_generation_prompt,
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

    @staticmethod
    def _extract_json_object(text: str) -> str:
        start = text.find('{')
        if start == -1:
            raise ValueError("No JSON object found")
        depth = 0
        in_string = False
        escaped = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_string:
                if escaped:
                    escaped = False
                    continue
                if ch == '\\':
                    escaped = True
                    continue
                if ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
                continue
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return text[start:i + 1]
        raise ValueError("Unclosed JSON object")

    @staticmethod
    def _extract_json_array(text: str) -> str:
        start = text.find('[')
        if start == -1:
            raise ValueError("No JSON array found")
        depth = 0
        in_string = False
        escaped = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_string:
                if escaped:
                    escaped = False
                    continue
                if ch == '\\':
                    escaped = True
                    continue
                if ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
                continue
            if ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    return text[start:i + 1]
        raise ValueError("Unclosed JSON array")

    async def _call_ollama_with_timeout(
        self,
        prompt: str,
        system_prompt: str,
        max_tokens: int,
        read_timeout: float = 120.0,
        json_mode: bool = True,
    ) -> str:
        url = self._build_api_url()
        payload_config = OllamaPayload(
            model=self.chat_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            num_ctx=2048,
            num_predict=max_tokens,
            json_mode=json_mode,
        )
        payload = payload_config.to_dict()
        payload["keep_alive"] = "120m"

        timeout_config = httpx.Timeout(
            connect=LLM_HTTP_CONNECT_TIMEOUT,
            read=read_timeout,
            write=LLM_HTTP_WRITE_TIMEOUT,
            pool=LLM_HTTP_POOL_TIMEOUT,
        )

        async with httpx.AsyncClient(timeout=timeout_config) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json().get("response", "").strip()

    async def generate_schema_two_phase(
        self,
        description: str,
        clarification_context: str = "",
    ) -> dict:
        from app.core.prompts import (
            SCHEMA_PHASE1_SYSTEM_PROMPT,
            SCHEMA_PHASE2_SYSTEM_PROMPT,
        )

        # Phase 1: table structure
        phase1_prompt = (
            f"List the tables needed for this system: {description}"
            f"{clarification_context}"
        )

        logger.info("[SCHEMA-2P] Phase 1 — description: %s...", description[:60])

        try:
            phase1_raw = await self._call_ollama_with_timeout(
                prompt=phase1_prompt,
                system_prompt=SCHEMA_PHASE1_SYSTEM_PROMPT,
                max_tokens=500,
                read_timeout=120.0,
            )
            clean1 = re.sub(r"```(?:json)?\s*|```", "", phase1_raw).strip()
            structure = json.loads(self._extract_json_object(clean1))
            tables_raw = structure.get("tables", [])

            if not tables_raw:
                raise ValueError("Phase 1 returned empty tables list")

            logger.info(
                "[SCHEMA-2P] Phase 1 done: %s tables: %s",
                len(tables_raw),
                [t.get("name") for t in tables_raw],
            )
        except Exception as e:
            logger.error("[SCHEMA-2P] Phase 1 failed: %s", e)
            raise ValueError(f"Schema structure generation failed: {e}")

        # Phase 2: enrich columns per batch
        BATCH_SIZE = 2
        enriched_tables: list[dict] = []

        for batch_idx in range(0, len(tables_raw), BATCH_SIZE):
            batch = tables_raw[batch_idx:batch_idx + BATCH_SIZE]

            batch_lines = []
            for t in batch:
                fk_refs = t.get("has_fk_to", [])
                fk_info = f", references: {', '.join(fk_refs)}" if fk_refs else ""
                batch_lines.append(
                    f'Table "{t["name"]}": {t.get("purpose", "")}{fk_info}'
                )

            phase2_prompt = (
                f"System context: {description}\n\n"
                f"Add columns to these tables:\n"
                + "\n".join(batch_lines)
            )

            batch_num = batch_idx // BATCH_SIZE + 1
            total_batches = (len(tables_raw) + BATCH_SIZE - 1) // BATCH_SIZE
            logger.info(
                "[SCHEMA-2P] Phase 2 batch %d/%d: %s",
                batch_num, total_batches, [t["name"] for t in batch],
            )

            try:
                phase2_raw = await self._call_ollama_with_timeout(
                    prompt=phase2_prompt,
                    system_prompt=SCHEMA_PHASE2_SYSTEM_PROMPT,
                    max_tokens=700,
                    read_timeout=180.0,
                )
                clean2 = re.sub(r"```(?:json)?\s*|```", "", phase2_raw).strip()
                batch_result = json.loads(self._extract_json_array(clean2))

                for table in batch_result:
                    cols = table.get("columns", [])
                    if not isinstance(cols, list) or len(cols) < 2:
                        raise ValueError(
                            f"Table '{table.get('name')}' has insufficient columns"
                        )

                enriched_tables.extend(batch_result)

            except Exception as e:
                logger.warning(
                    "[SCHEMA-2P] Phase 2 batch %d failed: %s — fallback",
                    batch_num, e,
                )
                for t in batch:
                    enriched_tables.append({
                        "name": t["name"],
                        "purpose": t.get("purpose", ""),
                        "design_rationale": t.get("purpose", ""),
                        "columns": [
                            {"name": "id", "type": "UUID", "is_pk": True,
                             "is_nullable": False, "default": None},
                            {"name": "created_at", "type": "TIMESTAMP", "is_pk": False,
                             "is_nullable": False, "default": None},
                        ],
                        "foreign_keys": [],
                        "indexes": [],
                    })

        # Merge: attach purpose/rationale from Phase 1
        phase1_map = {t["name"]: t for t in tables_raw}
        final_tables = []
        for table in enriched_tables:
            p1 = phase1_map.get(table["name"], {})
            table["purpose"] = table.get("purpose") or p1.get("purpose", "")
            table["design_rationale"] = (
                table.get("design_rationale") or p1.get("purpose", "")
            )
            final_tables.append(table)

        # Build relationships from Phase 1 FK info
        relationships = []
        for t in tables_raw:
            for ref in t.get("has_fk_to", []):
                relationships.append({
                    "from_table": t["name"],
                    "to_table": ref,
                    "type": "many_to_one",
                    "description": f"{t['name']} references {ref}",
                })

        logger.info(
            "[SCHEMA-2P] Complete: %s tables, %s relationships",
            len(final_tables), len(relationships),
        )

        return {
            "system_name": structure.get("system_name", "GeneratedSchema"),
            "tables": final_tables,
            "relationships": relationships,
            "design_notes": structure.get("design_notes", []),
        }

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

    async def chat_schema_design(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> str:
        """Delegate to 2-phase generation. Returns JSON string."""
        description = prompt
        clarification_context = ""

        prefix = "Design a database schema for: "
        context_marker = "\n\nAdditional context:\n"

        if prompt.startswith(prefix):
            body = prompt[len(prefix):]
            if context_marker in body:
                parts = body.split(context_marker, 1)
                description = parts[0].strip()
                clarification_context = f"{context_marker}{parts[1]}"
            else:
                description = body.strip()

        result = await self.generate_schema_two_phase(
            description=description,
            clarification_context=clarification_context,
        )
        return json.dumps(result, ensure_ascii=False)

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
        self,
        sql_query: str,
        schema_text: str,
        detected_issues: str = "",
    ) -> OllamaPayload:
        user_prompt = get_sql_optimization_prompt(
            sql_query=sql_query,
            schema_text=schema_text,
            detected_issues=detected_issues,
        )

        return OllamaPayload(
            model=self.coder_model,
            prompt=user_prompt,
            system_prompt=SQL_OPTIMIZATION_SYSTEM_PROMPT,
            temperature=0.1,
            num_ctx=2048,
            num_predict=300,
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
                "rewrite_type": parsed.get("rewrite_type", "none"),
                "changes_made": parsed.get("changes_made", []),
                "explanation": parsed.get("explanation", "Analysis completed"),
            }

        except json.JSONDecodeError as e:
            logger.error(f"[OPTIMIZE] Failed to parse JSON response: {e}")
            return {
                "optimized_sql": original_query,
                "index_suggestion": None,
                "rewrite_type": "none",
                "changes_made": [],
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
        self,
        sql_query: str,
        db_schema: Optional[str] = None,
        static_issues: Optional[list] = None,
    ) -> Dict[str, Any]:
        used_tables = self._extract_table_names(sql_query)
        original_schema_size = len(db_schema) if db_schema else 0
        filtered_schema = (
            self._filter_schema(db_schema, used_tables) if db_schema else ""
        )

        self._log_schema_filtering_stats(
            original_schema_size, len(filtered_schema), used_tables
        )

        schema_text = filtered_schema if filtered_schema else ""

        issues_text = ""
        if static_issues:
            issues_text = "\n".join(
                f"- [{i.severity.upper()}] {i.type}: {i.message}"
                for i in static_issues
            )

        payload_config = self._create_optimization_payload(
            sql_query,
            schema_text,
            issues_text,
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
            "rewrite_type": parsed_result.get("rewrite_type", "none"),
            "changes_made": parsed_result.get("changes_made", []),
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

    async def check_schema_clarification(
        self, user_description: str
    ) -> Dict[str, Any]:
        prompt = get_schema_clarification_prompt(user_description)

        payload_config = OllamaPayload(
            model=self.chat_model,
            prompt=prompt,
            system_prompt=SCHEMA_CLARIFICATION_SYSTEM_PROMPT,
            temperature=0.2,
            num_ctx=1024,
            num_predict=256,
            json_mode=True,
        )

        url = self._build_api_url()
        payload = payload_config.to_dict()

        try:
            raw = await self._make_ollama_request(payload, url)
            clean = re.sub(r"```json|```", "", raw).strip()
            result = json.loads(clean)
            logger.info(
                "[SCHEMA-GEN] Clarification check: "
                "needs_clarification=%s",
                result.get("needs_clarification"),
            )
            return result
        except Exception as e:
            logger.warning(f"[SCHEMA-GEN] Clarification check failed: {e}")
            return {"needs_clarification": False, "questions": []}

    async def generate_schema_from_prompt(
        self,
        user_description: str,
        clarifications: Optional[list[dict]] = None,
    ) -> Dict[str, Any]:
        prompt = get_schema_generation_prompt(user_description, clarifications)

        payload_config = OllamaPayload(
            model=self.chat_model,
            prompt=prompt,
            system_prompt=SCHEMA_GENERATION_SYSTEM_PROMPT,
            temperature=0.1,
            num_ctx=3072,
            num_predict=2500,
            json_mode=True,
        )

        url = self._build_api_url()
        payload = payload_config.to_dict()
        payload["keep_alive"] = "120m"

        logger.info(
            "[SCHEMA-GEN] Generating schema for: %s...",
            user_description[:80],
        )

        raw = ""
        try:
            raw = await self._make_ollama_request(payload, url)
            clean = re.sub(r"```(?:json)?\s*", "", raw)
            clean = re.sub(r"```", "", clean).strip()

            brace_start = clean.find("{")
            brace_end = clean.rfind("}")
            if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
                clean = clean[brace_start:brace_end + 1]

            try:
                schema_json = json.loads(clean)
            except json.JSONDecodeError:
                logger.warning("[SCHEMA-GEN] JSON malformed, attempting repair")
                schema_json = self._repair_truncated_schema_json(clean)

            if "tables" not in schema_json or not schema_json["tables"]:
                raise ValueError("LLM response missing 'tables' key or empty tables")

            logger.info(
                "[SCHEMA-GEN] Generated %s tables: %s",
                len(schema_json["tables"]),
                ", ".join(t.get("name", "") for t in schema_json["tables"]),
            )
            return schema_json

        except ValueError:
            raise
        except Exception as e:
            logger.error(
                "[SCHEMA-GEN] Generation failed: %s | raw snippet: %s",
                e,
                raw[:300],
            )
            raise ValueError(
                "Schema generation failed: LLM returned invalid JSON. "
                "Try describing your system with fewer tables or more specific details."
            )

    def _repair_truncated_schema_json(self, broken_json: str) -> Dict[str, Any]:
        tables_start = broken_json.find('"tables"')
        if tables_start == -1:
            raise ValueError("Cannot find 'tables' key in response")

        arr_start = broken_json.find('[', tables_start)
        if arr_start == -1:
            raise ValueError("Cannot find tables array start")

        depth = 0
        last_complete_end = arr_start

        for i in range(arr_start, len(broken_json)):
            ch = broken_json[i]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    last_complete_end = i

        if last_complete_end == arr_start:
            raise ValueError("No complete table object found")

        tables_section = broken_json[arr_start:last_complete_end + 1]

        try:
            sys_name_match = re.search(r'"system_name"\s*:\s*"([^"]+)"', broken_json)
            system_name = sys_name_match.group(1) if sys_name_match else "Generated Schema"
        except Exception:
            system_name = "Generated Schema"

        complete_tables: list[Dict[str, Any]] = []
        depth = 0
        obj_start = -1

        for i, ch in enumerate(tables_section):
            if ch == '{':
                if depth == 0:
                    obj_start = i
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0 and obj_start != -1:
                    try:
                        obj = json.loads(tables_section[obj_start:i + 1])
                        if "name" in obj and "columns" in obj:
                            complete_tables.append(obj)
                    except Exception:
                        pass
                    obj_start = -1

        if not complete_tables:
            raise ValueError("No parseable table objects found")

        logger.info("[SCHEMA-GEN] Repaired JSON: recovered %s tables", len(complete_tables))

        return {
            "system_name": system_name,
            "tables": complete_tables,
            "relationships": [],
            "design_notes": [
                "Schema was partially recovered due to response truncation."
            ],
        }

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
