import json
import logging
import re
import time
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import sqlglot
from app.core.config import settings
from app.core.constants import (APP_CONFIG_KEY_LLM_URL,
                                LLM_REQUEST_TIMEOUT, LLM_URL_CACHE_TTL)
from app.core.prompts import (SCHEMA_CLARIFICATION_SYSTEM_PROMPT,
                              SCHEMA_GENERATION_SYSTEM_PROMPT,
                              SCHEMA_PHASE1_SYSTEM_PROMPT,
                              SCHEMA_PHASE2_SYSTEM_PROMPT,
                              SQL_OPTIMIZATION_SYSTEM_PROMPT,
                              SQL_TARGETED_FIX_SYSTEM_PROMPT,
                              SQL_VERIFICATION_SYSTEM_PROMPT,
                              get_schema_clarification_prompt,
                              get_schema_generation_prompt,
                              get_sql_explanation_prompt,
                              get_sql_optimization_prompt,
                              get_sql_targeted_fix_prompt,
                              get_sql_verification_prompt)

from app.repositories.config_repository import config_repository
from app.services.llm_backends import OllamaBackend, GroqBackend
from app.services.llm_backends.base import BaseLLMBackend
from sqlglot import exp as sqlglot_exp


if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self) -> None:
        self.base_url: str = settings.OLLAMA_BASE_URL
        self.timeout: int = LLM_REQUEST_TIMEOUT
        self._url_cache: Optional[str] = None
        self._cache_timestamp: float = 0
        self._cache_ttl: int = LLM_URL_CACHE_TTL

        # Select backend + models based on LLM_SERVICE config
        service = settings.LLM_SERVICE.lower()
        if service == "groq":
            self._backend: BaseLLMBackend = GroqBackend(
                api_key=settings.GROQ_API_KEY
            )
            self.coder_model: str = settings.GROQ_MODEL_NAME
            self.chat_model: str = settings.GROQ_CHAT_MODEL_NAME
            logger.info(
                "[LLM] Using Groq backend — coder=%s, chat=%s",
                self.coder_model, self.chat_model,
            )
        else:
            self._backend = OllamaBackend(base_url=self.base_url)
            self.coder_model = settings.MODEL_NAME
            self.chat_model = settings.MODEL_CHAT_NAME
            logger.info(
                "[LLM] Using Ollama backend — coder=%s, chat=%s",
                self.coder_model, self.chat_model,
            )

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
        num_ctx: int = 2048,
    ) -> str:
        return await self._backend.call(
            model=self.chat_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            max_tokens=max_tokens,
            num_ctx=num_ctx,
            json_mode=json_mode,
            keep_alive="120m",
            read_timeout=read_timeout,
        )

    async def generate_schema_two_phase(
        self,
        description: str,
        clarification_context: str = "",
    ) -> dict:
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

        # Phase 2: enrich ALL tables in a single call
        all_lines = []
        for t in tables_raw:
            fk_refs = t.get("has_fk_to", [])
            fk_info = f", FK to: {', '.join(fk_refs)}" if fk_refs else ""
            key_cols = t.get("key_columns", [])
            cols_hint = (
                f", include columns: {', '.join(key_cols)}" if key_cols else ""
            )
            all_lines.append(
                f'Table "{t["name"]}": {t.get("purpose", "")}{fk_info}{cols_hint}'
            )

        phase2_prompt = (
            f"System: {description}"
            + (
                f"\nUser requirements: {clarification_context.strip()}"
                if clarification_context.strip()
                else ""
            )
            + f"\n\nGenerate columns for ALL these tables:\n"
            + "\n".join(all_lines)
        )

        logger.info(
            "[SCHEMA-2P] Phase 2 — single call for %d tables: %s",
            len(tables_raw),
            [t.get("name") for t in tables_raw],
        )

        enriched_tables: list[dict] = []

        try:
            phase2_raw = await self._call_ollama_with_timeout(
                prompt=phase2_prompt,
                system_prompt=SCHEMA_PHASE2_SYSTEM_PROMPT,
                max_tokens=1300,      # đủ cho ~5-6 tables với 6-7 cols mỗi table
                read_timeout=180.0,   # single call lớn hơn → timeout cao hơn
                num_ctx=3072,         # đủ cho input + output
            )
            clean2 = re.sub(r"```(?:json)?\s*|```", "", phase2_raw).strip()
            parsed2 = json.loads(self._extract_json_object(clean2))
            batch_result = parsed2.get("tables", [])

            if not batch_result:
                raise ValueError("Phase 2 response missing 'tables' key or empty")

            for table in batch_result:
                if not isinstance(table, dict) or "name" not in table:
                    raise ValueError("Invalid table object in response")
                cols = table.get("columns", [])
                if not isinstance(cols, list) or len(cols) < 3:
                    raise ValueError(
                        f"Table '{table.get('name')}' has only {len(cols)} columns"
                    )

            enriched_tables.extend(batch_result)
            logger.info(
                "[SCHEMA-2P] Phase 2 done: %d tables enriched",
                len(enriched_tables),
            )

        except Exception as e:
            logger.warning(
                "[SCHEMA-2P] Phase 2 failed: %s — using key_columns fallback for all tables",
                e,
            )
            # Fallback: dùng key_columns từ Phase 1 với type inference
            for t in tables_raw:
                fallback_cols = [
                    {"name": "id", "type": "UUID", "is_pk": True,
                     "is_nullable": False, "default": None},
                    {"name": "created_at", "type": "TIMESTAMP", "is_pk": False,
                     "is_nullable": False, "default": None},
                ]
                for col_name in t.get("key_columns", []):
                    if col_name.endswith("_id"):
                        col_type = "UUID"
                    elif any(k in col_name for k in ["price", "amount", "total", "cost", "salary", "fee"]):
                        col_type = "DECIMAL(10,2)"
                    elif any(k in col_name for k in ["count", "quantity", "age", "number", "stock"]):
                        col_type = "INTEGER"
                    elif any(k in col_name for k in ["is_", "has_", "active", "enabled", "available"]):
                        col_type = "BOOLEAN"
                    elif any(k in col_name for k in ["date", "time", "_at", "due", "expiry"]):
                        col_type = "TIMESTAMP"
                    elif any(k in col_name for k in ["description", "notes", "content", "text", "detail"]):
                        col_type = "TEXT"
                    else:
                        col_type = "VARCHAR(255)"
                    fallback_cols.append({
                        "name": col_name,
                        "type": col_type,
                        "is_pk": False,
                        "is_nullable": True,
                        "default": None,
                    })
                enriched_tables.append({
                    "name": t["name"],
                    "purpose": t.get("purpose", ""),
                    "design_rationale": t.get("purpose", ""),
                    "columns": fallback_cols,
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
            # Propagate to Ollama backend if active
            if isinstance(self._backend, OllamaBackend):
                self._backend.base_url = self.base_url
            logger.info(f"[LLM] Base URL updated to: {self.base_url}")

    async def fetch_and_update_url_from_db(
        self, db: "AsyncSession"
    ) -> None:
        try:

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

    async def _call_ollama(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
    ) -> str:
        return await self._backend.call(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens or 512,
            json_mode=json_mode,
        )

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
        max_tokens: int = 2048
    ) -> str:
        logger.info(
            "[CHAT] Calling LLM with model=%s, predict=%s",
            self.chat_model, max_tokens,
        )
        return await self._backend.call(
            model=self.chat_model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            num_ctx=2048,
            keep_alive="120m",
        )

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
            body = prompt.removeprefix(prefix)
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
        sql_keywords = [
            'SELECT', 'INSERT', 'UPDATE', 'DELETE',
            'CREATE', 'ALTER', 'DROP', 'WITH',
            'TRUNCATE', 'MERGE', 'GRANT', 'REVOKE',
        ]
        message_upper = message.upper()
        has_keyword = any(
            re.search(rf'\b{kw}\b', message_upper)
            for kw in sql_keywords
        )
        if has_keyword:
            logger.info("[INTENT] SQL detected via keyword")
            return True

        try:
            clean_message = re.sub(
                r'```sql\s*|\s*```', '', message, flags=re.IGNORECASE
            ).strip()

            if len(clean_message.split()) < 3:
                return False

            parsed = sqlglot.parse_one(clean_message)

            is_real_sql = isinstance(parsed, (
                sqlglot_exp.Select,
                sqlglot_exp.Insert,
                sqlglot_exp.Update,
                sqlglot_exp.Delete,
                sqlglot_exp.Create,
                sqlglot_exp.Drop,
                sqlglot_exp.Alter,
                sqlglot_exp.With,
            ))
            if is_real_sql:
                logger.info("[INTENT] SQL detected via sqlglot statement parsing")
                return True
        except Exception:
            pass

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
                for table in parsed.find_all(sqlglot_exp.Table)
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
    ) -> Dict[str, Any]:
        user_prompt = get_sql_optimization_prompt(
            sql_query=sql_query,
            schema_text=schema_text,
            detected_issues=detected_issues,
        )
        return {
            "model": self.coder_model,
            "prompt": user_prompt,
            "system_prompt": SQL_OPTIMIZATION_SYSTEM_PROMPT,
            "temperature": 0.1,
            "num_ctx": 2048,
            "max_tokens": 2048,
            "json_mode": True,
        }

    def _clean_json_response(self, raw_response: str) -> str:
        return re.sub(r"```json|```", "", raw_response).strip()

    def _parse_optimization_response(
        self, raw_response: str, original_query: str
    ) -> Dict[str, Any]:
        try:
            clean_json = self._clean_json_response(raw_response)

            try:
                parsed = json.loads(clean_json)
            except json.JSONDecodeError:
                # JSON bị cắt: tìm dấu { cuối cùng hợp lệ và đóng lại
                last_brace = clean_json.rfind('"')
                if last_brace != -1:
                    clean_json = clean_json[:last_brace] + '"}'
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
        self, index_suggestion: Any, used_tables: List[str]
    ) -> tuple[Optional[str], str]:
        if not index_suggestion or not used_tables:
            return None, ""

        # Handle cases where the LLM returns an array of index suggestions
        if isinstance(index_suggestion, list):
            index_suggestion = "\n".join(str(idx) for idx in index_suggestion)
        elif not isinstance(index_suggestion, str):
            index_suggestion = str(index_suggestion)

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

        # ── Pass 1: Rewrite ──
        logger.info("[OPTIMIZE] === Pass 1: Rewrite ===")
        pass1_result = await self._run_optimization_pass(
            sql_query, schema_text, issues_text, used_tables
        )

        pass1_sql = pass1_result["optimized_sql"].strip()
        pass1_changed = pass1_sql.lower().strip() != sql_query.lower().strip()

        if not pass1_changed:
            logger.info("[OPTIMIZE] Pass 1 made no changes — skipping Pass 2")
            return pass1_result

        # ── Pass 2: Verify & fix remaining issues ──
        logger.info("[OPTIMIZE] === Pass 2: Verify ===")
        pass2_result = await self._run_verification_pass(
            pass1_sql, sql_query, schema_text, used_tables
        )

        # Merge results: use Pass 2 SQL but combine changes from both passes
        all_changes = list(pass1_result.get("changes_made", []))
        pass2_changes = pass2_result.get("changes_made", [])
        if pass2_changes:
            all_changes.extend(
                f"[Pass 2] {c}" for c in pass2_changes
            )

        # Use the better index suggestion (prefer Pass 2 if it produced one)
        final_index = (
            pass2_result.get("index_suggestion")
            or pass1_result.get("index_suggestion")
        )

        # Combine explanations
        pass1_explanation = pass1_result.get("explanation", "").strip()
        pass2_explanation = pass2_result.get("explanation", "").strip()
        if pass2_explanation and pass2_explanation != pass1_explanation:
            combined_explanation = f"{pass1_explanation} | Verification: {pass2_explanation}"
        else:
            combined_explanation = pass1_explanation

        final_sql = pass2_result["optimized_sql"].strip()
        final_rewrite_type = (
            pass2_result.get("rewrite_type")
            if pass2_result.get("rewrite_type") != "none"
            else pass1_result.get("rewrite_type", "none")
        )

        # ── Pass 3: Targeted fix for remaining structural issues ──
        remaining = self._detect_structural_issues(final_sql)
        if remaining:
            issue_types = [i.type for i in remaining]
            logger.info(
                "[OPTIMIZE] === Pass 3: Targeted fix for %d remaining issue(s): %s ===",
                len(remaining), issue_types,
            )
            pass3_result = await self._run_targeted_fix_pass(
                final_sql, schema_text, remaining, used_tables
            )
            pass3_sql = pass3_result["optimized_sql"].strip()
            pass3_changed = pass3_sql.lower().strip() != final_sql.lower().strip()

            if pass3_changed:
                final_sql = pass3_sql
                final_rewrite_type = "multiple"

                pass3_changes = pass3_result.get("changes_made", [])
                if pass3_changes:
                    all_changes.extend(
                        f"[Pass 3] {c}" for c in pass3_changes
                    )

                final_index = (
                    pass3_result.get("index_suggestion")
                    or final_index
                )

                pass3_explanation = pass3_result.get("explanation", "").strip()
                if pass3_explanation:
                    combined_explanation += f" | Targeted fix: {pass3_explanation}"

                logger.info("[OPTIMIZE] Pass 3 applied %d fix(es)", len(pass3_changes))
            else:
                logger.info("[OPTIMIZE] Pass 3 made no changes")
        else:
            logger.info("[OPTIMIZE] No structural issues remain after Pass 2 — skipping Pass 3")

        num_passes = 3 if remaining else 2
        return {
            "optimized_sql": final_sql,
            "index_suggestion": final_index,
            "rewrite_type": final_rewrite_type,
            "changes_made": all_changes,
            "explanation": combined_explanation,
            "reasoning": f"{num_passes}-pass analysis with {self.coder_model}",
        }

    async def _run_optimization_pass(
        self,
        sql_query: str,
        schema_text: str,
        issues_text: str,
        used_tables: List[str],
    ) -> Dict[str, Any]:
        """Pass 1: Rewrite SQL based on the ANALYSIS CHECKLIST."""
        opt_payload = self._create_optimization_payload(
            sql_query, schema_text, issues_text,
        )

        system_len = len(opt_payload["system_prompt"] or "")
        prompt_len = len(opt_payload["prompt"])
        logger.info(f"[OPTIMIZE-P1] Prompt: {system_len + prompt_len:,} bytes")

        llm_start = time.time()
        logger.info(
            "[OPTIMIZE-P1] Calling LLM model=%s, max_tokens=%s",
            opt_payload["model"], opt_payload["max_tokens"],
        )

        try:
            raw_response = await self._backend.call(
                model=opt_payload["model"],
                prompt=opt_payload["prompt"],
                system_prompt=opt_payload["system_prompt"],
                temperature=opt_payload["temperature"],
                max_tokens=opt_payload["max_tokens"],
                num_ctx=opt_payload["num_ctx"],
                json_mode=opt_payload["json_mode"],
                keep_alive="120m",
            )
        except Exception as exc:
            logger.error(f"[OPTIMIZE-P1] LLM API error: {str(exc)}")
            raise

        logger.info(f"[OPTIMIZE-P1] LLM took: {time.time() - llm_start:.2f}s")
        logger.info(f"[OPTIMIZE-P1] Raw response: {raw_response}")

        parsed = self._parse_optimization_response(raw_response, sql_query)
        index_suggestion, rejection_note = self._validate_index_suggestion(
            parsed["index_suggestion"], used_tables
        )
        if rejection_note:
            logger.info(f"[OPTIMIZE-P1] Index rejection: {rejection_note}")

        return {
            "optimized_sql": parsed["optimized_sql"].strip(),
            "index_suggestion": index_suggestion,
            "rewrite_type": parsed.get("rewrite_type", "none"),
            "changes_made": parsed.get("changes_made", []),
            "explanation": parsed.get("explanation", "").strip(),
        }

    async def _run_verification_pass(
        self,
        optimized_sql: str,
        original_sql: str,
        schema_text: str,
        used_tables: List[str],
    ) -> Dict[str, Any]:
        """Pass 2: Verify rewritten SQL against checklist, fix remaining issues."""
        verify_prompt = get_sql_verification_prompt(
            optimized_sql=optimized_sql,
            original_sql=original_sql,
            schema_text=schema_text,
        )

        prompt_len = len(verify_prompt) + len(SQL_VERIFICATION_SYSTEM_PROMPT)
        logger.info(f"[OPTIMIZE-P2] Prompt: {prompt_len:,} bytes")

        llm_start = time.time()
        logger.info("[OPTIMIZE-P2] Calling LLM for verification...")

        try:
            raw_response = await self._backend.call(
                model=self.coder_model,
                prompt=verify_prompt,
                system_prompt=SQL_VERIFICATION_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=2048,
                num_ctx=2048,
                json_mode=True,
                keep_alive="120m",
            )
        except Exception as exc:
            logger.warning(f"[OPTIMIZE-P2] Verification LLM failed: {exc}")
            # If verification fails, return Pass 1 result unchanged
            return {
                "optimized_sql": optimized_sql,
                "index_suggestion": None,
                "rewrite_type": "none",
                "changes_made": [],
                "explanation": "Verification pass skipped due to LLM error",
            }

        logger.info(f"[OPTIMIZE-P2] LLM took: {time.time() - llm_start:.2f}s")
        logger.info(f"[OPTIMIZE-P2] Raw response: {raw_response}")

        parsed = self._parse_optimization_response(raw_response, optimized_sql)
        index_suggestion, rejection_note = self._validate_index_suggestion(
            parsed["index_suggestion"], used_tables
        )
        if rejection_note:
            logger.info(f"[OPTIMIZE-P2] Index rejection: {rejection_note}")

        return {
            "optimized_sql": parsed["optimized_sql"].strip(),
            "index_suggestion": index_suggestion,
            "rewrite_type": parsed.get("rewrite_type", "none"),
            "changes_made": parsed.get("changes_made", []),
            "explanation": parsed.get("explanation", "").strip(),
        }

    # ── Issue types that warrant a targeted Pass 3 ──
    _TARGETED_FIX_TYPES = {
        "correlated_subquery",
        "cte_group_by_non_key",
        "in_subquery",
        "function_on_column",
    }

    def _detect_structural_issues(self, sql: str) -> list:
        """Re-run static analysis and filter for structural issues
        that the LLM may have missed in the full-query context."""
        from app.services.sql_analyzer import sql_analyzer

        all_issues = sql_analyzer.detect(sql)
        structural = [
            i for i in all_issues if i.type in self._TARGETED_FIX_TYPES
        ]
        if structural:
            logger.info(
                "[OPTIMIZE-P3] Detected %d structural issue(s): %s",
                len(structural),
                [(i.type, i.severity) for i in structural],
            )
        return structural

    async def _run_targeted_fix_pass(
        self,
        sql_query: str,
        schema_text: str,
        remaining_issues: list,
        used_tables: List[str],
    ) -> Dict[str, Any]:
        """Pass 3: Targeted fix — send only the specific remaining issues
        to the LLM with a focused prompt, narrowing its attention."""
        targeted_prompt = get_sql_targeted_fix_prompt(
            sql_query=sql_query,
            remaining_issues=remaining_issues,
            schema_text=schema_text,
        )

        prompt_len = len(targeted_prompt) + len(SQL_TARGETED_FIX_SYSTEM_PROMPT)
        logger.info(f"[OPTIMIZE-P3] Prompt: {prompt_len:,} bytes")

        llm_start = time.time()
        logger.info(
            "[OPTIMIZE-P3] Calling LLM for targeted fix (%d issues)...",
            len(remaining_issues),
        )

        try:
            raw_response = await self._backend.call(
                model=self.coder_model,
                prompt=targeted_prompt,
                system_prompt=SQL_TARGETED_FIX_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=2048,
                num_ctx=2048,
                json_mode=True,
                keep_alive="120m",
            )
        except Exception as exc:
            logger.warning(f"[OPTIMIZE-P3] Targeted fix LLM failed: {exc}")
            return {
                "optimized_sql": sql_query,
                "index_suggestion": None,
                "rewrite_type": "none",
                "changes_made": [],
                "explanation": "Targeted fix pass skipped due to LLM error",
            }

        logger.info(f"[OPTIMIZE-P3] LLM took: {time.time() - llm_start:.2f}s")
        logger.info(f"[OPTIMIZE-P3] Raw response: {raw_response}")

        parsed = self._parse_optimization_response(raw_response, sql_query)
        index_suggestion, rejection_note = self._validate_index_suggestion(
            parsed["index_suggestion"], used_tables
        )
        if rejection_note:
            logger.info(f"[OPTIMIZE-P3] Index rejection: {rejection_note}")

        return {
            "optimized_sql": parsed["optimized_sql"].strip(),
            "index_suggestion": index_suggestion,
            "rewrite_type": parsed.get("rewrite_type", "none"),
            "changes_made": parsed.get("changes_made", []),
            "explanation": parsed.get("explanation", "").strip(),
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

        try:
            raw = await self._backend.call(
                model=self.chat_model,
                prompt=prompt,
                system_prompt=SCHEMA_CLARIFICATION_SYSTEM_PROMPT,
                temperature=0.2,
                max_tokens=512,
                num_ctx=2048,
                json_mode=True,
            )
            clean = re.sub(r"```json|```", "", raw).strip()
            result = json.loads(self._extract_json_object(clean))
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

        logger.info(
            "[SCHEMA-GEN] Generating schema for: %s...",
            user_description[:80],
        )

        raw = ""
        try:
            raw = await self._backend.call(
                model=self.chat_model,
                prompt=prompt,
                system_prompt=SCHEMA_GENERATION_SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=2500,
                num_ctx=3072,
                json_mode=True,
                keep_alive="120m",
            )
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
        return await self._backend.check_health(
            coder_model=self.coder_model,
            chat_model=self.chat_model,
        )

    async def warmup_models(self) -> None:
        try:
            logger.info("[LLM-WARMUP] Starting model warm-up...")
            await self._backend.warmup(
                coder_model=self.coder_model,
                chat_model=self.chat_model,
            )
            logger.info("[LLM-WARMUP] Model warm-up completed successfully")
        except Exception as e:
            logger.warning(f"[LLM-WARMUP] Failed to warm up models: {str(e)}")


llm_service = LLMService()
