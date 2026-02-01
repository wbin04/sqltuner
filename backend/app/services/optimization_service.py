import hashlib
import json
import logging
import time
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.security import decrypt_password
from backend.app.models.models import (Conversation, DBConnection, DBType,
                                       PerformanceAnalysis, QueryLog)
from backend.app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class OptimizationService:
    _optimization_cache: Dict[str, Dict[str, Any]] = {}
    _cache_max_size = 100

    @staticmethod
    def _get_cache_key(sql_query: str, connection_id: UUID) -> str:
        normalized_sql = ' '.join(sql_query.strip().lower().split())
        cache_str = f"{connection_id}:{normalized_sql}"
        return hashlib.md5(cache_str.encode()).hexdigest()

    @staticmethod
    def _get_cached_optimization(cache_key: str) -> Optional[Dict[str, Any]]:
        return OptimizationService._optimization_cache.get(cache_key)

    @staticmethod
    def _cache_optimization(cache_key: str, result: Dict[str, Any]) -> None:
        if (len(OptimizationService._optimization_cache) >=
                OptimizationService._cache_max_size):
            oldest_key = next(iter(OptimizationService._optimization_cache))
            del OptimizationService._optimization_cache[oldest_key]
            logger.info(
                f"[CACHE] Evicted oldest entry: {oldest_key[:8]}..."
            )

        OptimizationService._optimization_cache[cache_key] = result
        logger.info(f"[CACHE] Stored result for key: {cache_key[:8]}...")

    @staticmethod
    def _resolve_docker_host(host: str) -> str:
        if host in ['localhost', '127.0.0.1']:
            return 'host.docker.internal'
        return host

    @staticmethod
    def _build_connection_string(connection: DBConnection) -> str:
        password = decrypt_password(
            connection.db_password) if connection.db_password else ""
        resolved_host = OptimizationService._resolve_docker_host(
            connection.host)
        if connection.db_type == DBType.POSTGRES:
            return (f"postgresql://{connection.username}:{password}@"
                    f"{resolved_host}:{connection.port}/{connection.db_name}")
        elif connection.db_type == DBType.MYSQL:
            return (f"mysql+pymysql://{connection.username}:{password}@"
                    f"{resolved_host}:{connection.port}/{connection.db_name}")
        else:
            raise ValueError(
                f"Unsupported database type: {connection.db_type}")

    @staticmethod
    def _format_schema_for_llm(meta_schema: dict) -> str:
        if not meta_schema or "tables" not in meta_schema:
            return "No schema information available."
        lines = []
        tables = meta_schema.get("tables", [])
        for table in tables:
            table_name = table.get("name", "unknown")
            columns = table.get("columns", [])
            indexes = table.get("indexes", [])
            sample_count = len(table.get("sample_data", []))
            lines.append(f"\n--- Table: {table_name} ---")
            lines.append(f"Estimated rows: {sample_count} (sampled)")
            lines.append("Columns:")
            for col in columns:
                col_info = f"  - {col.get('name')}: {col.get('data_type')}"
                if col.get("primary_key"):
                    col_info += " [PRIMARY KEY]"
                if col.get("nullable") is False:
                    col_info += " [NOT NULL]"
                lines.append(col_info)
            if indexes:
                lines.append("Indexes:")
                for idx in indexes:
                    idx_cols = ", ".join(idx.get("columns", []))
                    idx_type = " [UNIQUE]" if idx.get("unique") else ""
                    lines.append(
                        f"  - {idx.get('name')}: ({idx_cols}){idx_type}")
            else:
                lines.append("Indexes: None (consider adding indexes)")
        return "\n".join(lines)

    @staticmethod
    async def _get_explain_plan(
        connection: DBConnection,
        sql_query: str
    ) -> Optional[Dict[str, Any]]:
        if connection.db_type == DBType.SIMULATION:
            logger.info(
                "[OPTIMIZE] Skipping EXPLAIN for SIMULATION connection")
            return None
        try:
            conn_string = OptimizationService._build_connection_string(
                connection)
            engine = create_engine(
                conn_string, pool_pre_ping=True, pool_recycle=3600)
            with engine.connect() as conn:
                if connection.db_type == DBType.POSTGRES:
                    explain_query = (f"EXPLAIN (ANALYZE, FORMAT JSON) "
                                     f"{sql_query}")
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(
                        explain_output, str) else explain_output
                    total_cost = (plan_data[0]["Plan"]["Total Cost"]
                                  if plan_data else 0.0)
                elif connection.db_type == DBType.MYSQL:
                    explain_query = f"EXPLAIN FORMAT=JSON {sql_query}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(
                        explain_output, str) else explain_output
                    total_cost = plan_data.get("query_block", {}).get(
                        "cost_info", {}).get("query_cost", 0.0)
                else:
                    logger.warning(
                        f"[OPTIMIZE] Unsupported DB: {connection.db_type}")
                    return None
            engine.dispose()
            return {
                "plan": plan_data,
                "total_cost": float(total_cost)
            }
        except Exception as e:
            logger.error(f"[OPTIMIZE] EXPLAIN failed: {str(e)}")
            return None

    @staticmethod
    def _extract_bottlenecks(
            explain_plan: Dict[str, Any], db_type: DBType) -> list:
        bottlenecks = []
        try:
            if db_type == DBType.POSTGRES:
                plan = explain_plan.get("plan", [{}])[0].get("Plan", {})

                def traverse_plan(node):
                    node_type = node.get("Node Type", "")
                    relation_name = node.get("Relation Name", "")
                    if "Seq Scan" in node_type:
                        bottlenecks.append(
                            f"Sequential Scan on '{relation_name}' "
                            f"(no index used)")
                    if "Hash Join" in node_type and node.get(
                            "Total Cost", 0) > 1000:
                        bottlenecks.append(
                            f"High-cost Hash Join (cost: "
                            f"{node.get('Total Cost')})")
                    if "Nested Loop" in node_type and node.get(
                            "Actual Loops", 1) > 1000:
                        bottlenecks.append(
                            f"Expensive Nested Loop (loops: "
                            f"{node.get('Actual Loops')})")
                    for child in node.get("Plans", []):
                        traverse_plan(child)
                traverse_plan(plan)
            elif db_type == DBType.MYSQL:
                query_block = explain_plan.get(
                    "plan", {}).get("query_block", {})
                table = query_block.get("table", {})
                access_type = table.get("access_type", "")
                if access_type in ["ALL", "index"]:
                    table_name = table.get("table_name", "unknown")
                    bottlenecks.append(
                        f"Full table scan on '{table_name}' "
                        f"(access_type: {access_type})")
        except Exception as e:
            logger.warning(
                f"[OPTIMIZE] Failed to extract bottlenecks: {str(e)}")
        return bottlenecks

    @staticmethod
    async def analyze_query(
        connection_id: UUID,
        sql_query: str,
        db: AsyncSession,
        conversation_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        start_total = time.time()
        logger.info(
            f"[OPTIMIZE] Starting analysis for connection {connection_id}")
        start_step = time.time()
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()
        if not connection:
            raise ValueError(f"Connection {connection_id} not found")
        logger.info(
            f"[OPTIMIZE] Step 1 - Fetch connection: "
            f"{time.time() - start_step:.2f}s")
        query_log = None
        if conversation_id:
            result = await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")
            query_log = QueryLog(
                conversation_id=conversation.id,
                role="assistant",
                action_type="optimize",
                content=sql_query,
                sql_generated=None
            )
            db.add(query_log)
            await db.flush()
            logger.info(
                f"[OPTIMIZE] Log {query_log.id} created")
        else:
            logger.info(
                "[OPTIMIZE] No conversation_id, skipping log creation")
        start_step = time.time()
        explain_result = await OptimizationService._get_explain_plan(
            connection, sql_query)
        if explain_result:
            explain_plan = explain_result["plan"]
            original_cost = explain_result["total_cost"]
            bottlenecks = OptimizationService._extract_bottlenecks(
                {"plan": explain_plan},
                connection.db_type
            )
            logger.info(
                f"[OPTIMIZE] Step 2 - EXPLAIN: "
                f"{time.time() - start_step:.2f}s, cost={original_cost}")
        else:
            explain_plan = None
            original_cost = None
            bottlenecks = []
            logger.info(
                f"[OPTIMIZE] Step 2 - EXPLAIN: "
                f"{time.time() - start_step:.2f}s (skipped)")
        db_schema_json = json.dumps(
            connection.meta_schema) if connection.meta_schema else None

        schema_size = len(db_schema_json) if db_schema_json else 0
        num_tables = (
            len(connection.meta_schema.get("tables", [])) if
            connection.meta_schema else 0
        )
        table_names = (
            [
                t.get("name") for t in connection.meta_schema.get("tables", [])
            ] if connection.meta_schema else []
        )
        print(
            "[DEBUG-OPTIMIZE-SERVICE] meta_schema size: " + str(schema_size) +
            " bytes, " + str(num_tables) + " tables"
        )
        print(
            f"[DEBUG-OPTIMIZE-SERVICE] Table names in schema: {table_names}"
        )
        logger.info(
            f"[OPTIMIZE] meta_schema size: {schema_size:,} bytes, "
            f"{num_tables} tables"
        )

        cache_key = OptimizationService._get_cache_key(
            sql_query, connection_id
        )
        cached_result = OptimizationService._get_cached_optimization(cache_key)

        if cached_result:
            print(
                f"[CACHE-HIT] Using cached optimization for key: "
                f"{cache_key[:8]}..."
            )
            logger.info(
                f"[CACHE-HIT] Returning cached result for {cache_key[:8]}..."
            )
            llm_result = cached_result
            optimized_sql = llm_result.get("optimized_sql", sql_query)
            index_recommendation = llm_result.get(
                "index_suggestion", ""
            )
            explanation = llm_result.get(
                "explanation", "No explanation provided"
            )
        else:
            print("[CACHE-MISS] No cache found, calling LLM...")
            start_step = time.time()
            logger.info("[OPTIMIZE] Calling LLM...")
            try:
                llm_result = await llm_service.optimize_sql(
                    sql_query=sql_query,
                    db_schema=db_schema_json
                )

                OptimizationService._cache_optimization(cache_key, llm_result)

                logger.info(
                    f"[OPTIMIZE] Step 4 - LLM call: "
                    f"{time.time() - start_step:.2f}s")
                optimized_sql = llm_result.get("optimized_sql", sql_query)
                index_recommendation = llm_result.get("index_suggestion", "")
                explanation = llm_result.get(
                    "explanation", "No explanation provided")
            except Exception as e:
                logger.error(f"[OPTIMIZE] LLM optimization failed: {str(e)}")
                optimized_sql = sql_query
                index_recommendation = None
                explanation = f"Generation failed. Error: {str(e)}"

        if not isinstance(optimized_sql, str):
            logger.warning(
                f"[OPTIMIZE] optimized_sql is not a string: "
                f"{type(optimized_sql)}")
            optimized_sql = str(optimized_sql)
        if (not isinstance(index_recommendation, str) and
                index_recommendation is not None):
            logger.warning(
                f"[OPTIMIZE] index_recommendation is not a string: "
                f"{type(index_recommendation)}")
            if isinstance(index_recommendation, list):
                index_recommendation = "\n".join(
                    str(item) for item in index_recommendation)
            else:
                index_recommendation = (str(index_recommendation)
                                        if index_recommendation else "")
        if not isinstance(explanation, str):
            logger.warning(
                f"[OPTIMIZE] explanation is not a string: "
                f"{type(explanation)}")
            explanation = str(explanation)

        response = {
            "original_cost": original_cost,
            "bottlenecks": bottlenecks,
            "optimized_sql": (optimized_sql.strip()
                              if isinstance(optimized_sql, str)
                              else str(optimized_sql).strip()),
            "index_recommendation": (index_recommendation.strip()
                                     if isinstance(index_recommendation, str)
                                     and index_recommendation else None),
            "explanation": (explanation.strip()
                            if isinstance(explanation, str)
                            else str(explanation).strip())}
        logger.info(
            f"[OPTIMIZE] Total time: {time.time() - start_total:.2f}s")
        if query_log:
            try:
                performance_analysis = PerformanceAnalysis(
                    query_log_id=query_log.id,
                    execution_time_ms=None,
                    total_cost=original_cost,
                    explain_plan=explain_plan,
                    index_recommendation=response["index_recommendation"],
                )
                db.add(performance_analysis)
                await db.commit()
                await db.refresh(performance_analysis)
                logger.info(
                    f"[OPTIMIZE] Saved analysis {performance_analysis.id}")
                query_log.sql_generated = response["optimized_sql"]
                await db.commit()
                response["query_log_id"] = str(query_log.id)
            except Exception as e:
                logger.error(
                    f"[OPTIMIZE] Failed to save analysis to DB: {str(e)}")
        else:
            logger.info("[OPTIMIZE] Skipping DB save (no query_log)")
        logger.info("[OPTIMIZE] Analysis complete")
        return response


optimization_service = OptimizationService()
