import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional
from uuid import UUID

from app.core.constants import LOCALHOSTS, SQL_CONNECTION_TIMEOUT
from app.core.exceptions import NotFoundError, ValidationError
from app.core.security import decrypt_password
from app.models.models import (Conversation, DBConnection, DBType,
                               PerformanceAnalysis, QueryLog)
from app.services.llm_service import llm_service
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

logger = logging.getLogger(__name__)


@dataclass
class ExplainResult:
    plan: Dict[str, Any]
    total_cost: float


@dataclass
class OptimizationResult:
    optimized_sql: str
    index_recommendation: Optional[str]
    explanation: str
    original_cost: Optional[float]
    bottlenecks: list[str]
    query_log_id: Optional[str] = None


class OptimizationCache:
    def __init__(self, max_size: int = 100):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._max_size = max_size

    def _generate_key(self, sql_query: str, connection_id: UUID) -> str:
        normalized_sql = " ".join(sql_query.strip().lower().split())
        cache_str = f"{connection_id}:{normalized_sql}"
        return hashlib.md5(cache_str.encode()).hexdigest()

    def get(
        self, sql_query: str, connection_id: UUID
    ) -> Optional[Dict[str, Any]]:
        key = self._generate_key(sql_query, connection_id)
        return self._cache.get(key)

    def put(
        self, sql_query: str, connection_id: UUID, result: Dict[str, Any]
    ) -> None:
        if len(self._cache) >= self._max_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            logger.info(f"[CACHE] Evicted oldest entry: {oldest_key[:8]}...")

        key = self._generate_key(sql_query, connection_id)
        self._cache[key] = result
        logger.info(f"[CACHE] Stored result for key: {key[:8]}...")


class ConnectionStringBuilder:
    @staticmethod
    def resolve_docker_host(host: str) -> str:
        if host in LOCALHOSTS:
            return "host.docker.internal"
        return host

    @staticmethod
    def build(connection: DBConnection) -> str:
        password = (
            decrypt_password(connection.db_password)
            if connection.db_password
            else ""
        )
        resolved_host = ConnectionStringBuilder.resolve_docker_host(
            connection.host
        )

        if connection.db_type == DBType.POSTGRES:
            return (
                f"postgresql://{connection.username}:{password}@"
                f"{resolved_host}:{connection.port}/{connection.db_name}"
            )
        elif connection.db_type == DBType.MYSQL:
            return (
                f"mysql+pymysql://{connection.username}:{password}@"
                f"{resolved_host}:{connection.port}/{connection.db_name}"
            )
        else:
            raise ValidationError(
                f"Unsupported database type: {connection.db_type}"
            )


class SchemaFormatter:
    @staticmethod
    def format_for_llm(
        meta_schema: Dict[str, Any]
    ) -> str:
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
                        f"  - {idx.get('name')}: ({idx_cols}){idx_type}"
                    )
            else:
                lines.append("Indexes: None (consider adding indexes)")

        return "\n".join(lines)


class ExplainPlanAnalyzer:
    @staticmethod
    async def get_explain_plan(
        connection: DBConnection, sql_query: str
    ) -> Optional[ExplainResult]:
        if connection.db_type == DBType.SIMULATION:
            logger.info(
                "[OPTIMIZE] Skipping EXPLAIN for SIMULATION connection"
            )
            return None

        try:
            conn_string = ConnectionStringBuilder.build(
                connection
            )

            connect_args = {}
            if connection.db_type.value == "postgresql":
                connect_args = {"connect_timeout": SQL_CONNECTION_TIMEOUT}
            elif connection.db_type.value == "mysql":
                connect_args = {"connect_timeout": SQL_CONNECTION_TIMEOUT}

            engine = create_engine(
                conn_string,
                pool_pre_ping=True,
                pool_recycle=3600,
                connect_args=connect_args,
                pool_timeout=SQL_CONNECTION_TIMEOUT
            )
            
            # Test connection immediately
            logger.info("[OPTIMIZE] Testing database connection...")
            with engine.connect() as test_conn:
                test_conn.execute(text("SELECT 1"))
            logger.info("[OPTIMIZE] Connection test successful")

            with engine.connect() as conn:
                if connection.db_type == DBType.POSTGRES:
                    plan_data, total_cost = (
                        ExplainPlanAnalyzer._execute_postgres_explain(
                            conn, sql_query
                        )
                    )
                elif connection.db_type == DBType.MYSQL:
                    plan_data, total_cost = (
                        ExplainPlanAnalyzer._execute_mysql_explain(
                            conn, sql_query
                        )
                    )
                else:
                    logger.warning(
                        f"[OPTIMIZE] Unsupported DB: {connection.db_type}"
                    )
                    return None

            engine.dispose()
            return ExplainResult(plan=plan_data, total_cost=float(total_cost))

        except Exception as e:
            logger.error(f"[OPTIMIZE] EXPLAIN failed: {str(e)}")
            return None

    @staticmethod
    def _execute_postgres_explain(conn, sql_query: str) -> tuple[Dict, float]:
        explain_query = f"EXPLAIN (ANALYZE, FORMAT JSON) {sql_query}"
        result_proxy = conn.execute(text(explain_query))
        explain_output = result_proxy.fetchone()[0]

        plan_data = (
            json.loads(explain_output)
            if isinstance(explain_output, str)
            else explain_output
        )
        total_cost = plan_data[0]["Plan"]["Total Cost"] if plan_data else 0.0

        return plan_data, total_cost

    @staticmethod
    def _execute_mysql_explain(conn, sql_query: str) -> tuple[Dict, float]:
        explain_query = f"EXPLAIN FORMAT=JSON {sql_query}"
        result_proxy = conn.execute(text(explain_query))
        explain_output = result_proxy.fetchone()[0]

        plan_data = (
            json.loads(explain_output)
            if isinstance(explain_output, str)
            else explain_output
        )
        total_cost = (
            plan_data.get("query_block", {})
            .get("cost_info", {})
            .get("query_cost", 0.0)
        )

        return plan_data, total_cost

    @staticmethod
    def extract_bottlenecks(
        explain_plan: Dict[str, Any], db_type: DBType
    ) -> list[str]:
        bottlenecks = []

        try:
            if db_type == DBType.POSTGRES:
                bottlenecks = (
                    ExplainPlanAnalyzer._extract_postgres_bottlenecks(
                        explain_plan
                    )
                )
            elif db_type == DBType.MYSQL:
                bottlenecks = ExplainPlanAnalyzer._extract_mysql_bottlenecks(
                    explain_plan
                )
        except Exception as e:
            logger.warning(
                f"[OPTIMIZE] Failed to extract bottlenecks: {str(e)}"
            )

        return bottlenecks

    @staticmethod
    def _extract_postgres_bottlenecks(
        explain_plan: Dict[str, Any]
    ) -> list[str]:
        bottlenecks = []
        plan = explain_plan.get("plan", [{}])[0].get(
            "Plan", {}
        )

        def traverse_plan(node: Dict[str, Any]) -> None:
            node_type = node.get("Node Type", "")
            relation_name = node.get("Relation Name", "")

            if "Seq Scan" in node_type:
                bottlenecks.append(
                    f"Sequential Scan on '{relation_name}' (no index used)"
                )

            if "Hash Join" in node_type and node.get("Total Cost", 0) > 1000:
                bottlenecks.append(
                    f"High-cost Hash Join (cost: {node.get('Total Cost')})"
                )

            if "Nested Loop" in node_type and node.get(
                "Actual Loops", 1
            ) > 1000:
                bottlenecks.append(
                    f"Expensive Nested Loop (loops: "
                    f"{node.get('Actual Loops')})"
                )

            for child in node.get("Plans", []):
                traverse_plan(child)

        traverse_plan(plan)
        return bottlenecks

    @staticmethod
    def _extract_mysql_bottlenecks(explain_plan: Dict[str, Any]) -> list[str]:
        bottlenecks = []
        query_block = explain_plan.get("plan", {}).get("query_block", {})
        table = query_block.get("table", {})
        access_type = table.get("access_type", "")

        if access_type in ["ALL", "index"]:
            table_name = table.get("table_name", "unknown")
            bottlenecks.append(
                f"Full table scan on '{table_name}' "
                f"(access_type: {access_type})"
            )

        return bottlenecks


class QueryLogManager:
    @staticmethod
    async def create_query_log(
        db: AsyncSession, conversation_id: UUID, sql_query: str
    ) -> Optional[QueryLog]:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conversation = result.scalar_one_or_none()

        if not conversation:
            raise NotFoundError(f"Conversation {conversation_id} not found")

        query_log = QueryLog(
            conversation_id=conversation.id,
            role="assistant",
            action_type="optimize",
            content=sql_query,
            sql_generated=None,
        )
        db.add(query_log)
        await db.flush()
        logger.info(f"[OPTIMIZE] Log {query_log.id} created")

        return query_log

    @staticmethod
    async def save_performance_analysis(
        db: AsyncSession,
        query_log: QueryLog,
        explain_plan: Optional[Dict[str, Any]],
        original_cost: Optional[float],
        index_recommendation: Optional[str],
        optimized_sql: str,
    ) -> Optional[str]:
        try:
            performance_analysis = PerformanceAnalysis(
                query_log_id=query_log.id,
                execution_time_ms=None,
                total_cost=original_cost,
                explain_plan=explain_plan,
                index_recommendation=index_recommendation,
            )
            db.add(performance_analysis)
            await db.commit()
            await db.refresh(performance_analysis)
            logger.info(f"[OPTIMIZE] Saved analysis {performance_analysis.id}")

            query_log.sql_generated = optimized_sql
            await db.commit()

            return str(query_log.id)

        except Exception as e:
            logger.error(f"[OPTIMIZE] Failed to save analysis to DB: {str(e)}")
            return None


class OptimizationService:
    def __init__(self):
        self._cache = OptimizationCache()

    async def analyze_query(
        self,
        connection_id: UUID,
        sql_query: str,
        db: AsyncSession,
        conversation_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        start_total = time.time()
        logger.info(
            f"[OPTIMIZE] Starting analysis for connection {connection_id}"
        )

        # Step 1: Fetch connection
        connection = await self._fetch_connection(db, connection_id)

        # Step 2: Create query log if needed
        query_log = None
        if conversation_id:
            query_log = await QueryLogManager.create_query_log(
                db, conversation_id, sql_query
            )

        # Step 3: Get EXPLAIN plan
        explain_result = await ExplainPlanAnalyzer.get_explain_plan(
            connection, sql_query
        )

        if explain_result:
            explain_plan = explain_result.plan
            original_cost = explain_result.total_cost
            bottlenecks = ExplainPlanAnalyzer.extract_bottlenecks(
                {"plan": explain_plan}, connection.db_type
            )
        else:
            explain_plan = None
            original_cost = None
            bottlenecks = []

        # Step 4: Get or compute LLM optimization
        llm_result = await self._get_optimization(
            connection, sql_query, connection_id
        )

        # Step 5: Build response
        response = self._build_response(
            llm_result, original_cost, bottlenecks, sql_query
        )

        # Step 6: Save to database if query log exists
        if query_log:
            response["query_log_id"] = await (
                QueryLogManager.save_performance_analysis(
                    db,
                    query_log,
                    explain_plan,
                    original_cost,
                    response["index_recommendation"],
                    response["optimized_sql"],
                )
            )

        logger.info(f"[OPTIMIZE] Total time: {time.time() - start_total:.2f}s")
        return response

    async def _fetch_connection(
        self, db: AsyncSession, connection_id: UUID
    ) -> DBConnection:
        start_step = time.time()
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()

        if not connection:
            raise NotFoundError(f"Connection {connection_id} not found")

        logger.info(
            f"[OPTIMIZE] Fetch connection: {time.time() - start_step:.2f}s"
        )
        return connection

    async def _get_optimization(
        self, connection: DBConnection, sql_query: str, connection_id: UUID
    ) -> Dict[str, Any]:
        cached_result = self._cache.get(sql_query, connection_id)

        if cached_result:
            logger.info("[CACHE-HIT] Returning cached result")
            return cached_result

        db_schema_json = (
            json.dumps(connection.meta_schema)
            if connection.meta_schema else None
        )

        start_step = time.time()
        logger.info("[OPTIMIZE] Calling LLM...")

        try:
            llm_result = await llm_service.optimize_sql(
                sql_query=sql_query, db_schema=db_schema_json
            )
            self._cache.put(sql_query, connection_id, llm_result)
            logger.info(
                f"[OPTIMIZE] LLM call: {time.time() - start_step:.2f}s"
            )
            return llm_result

        except Exception as e:
            logger.error(f"[OPTIMIZE] LLM optimization failed: {str(e)}")
            return {
                "optimized_sql": sql_query,
                "index_suggestion": None,
                "explanation": f"Generation failed. Error: {str(e)}",
            }

    def _build_response(
        self,
        llm_result: Dict[str, Any],
        original_cost: Optional[float],
        bottlenecks: list[str],
        sql_query: str,
    ) -> Dict[str, Any]:
        optimized_sql = self._ensure_string(
            llm_result.get("optimized_sql", sql_query)
        )
        index_recommendation = llm_result.get("index_suggestion")
        explanation = self._ensure_string(
            llm_result.get("explanation", "No explanation provided")
        )

        if index_recommendation:
            index_recommendation = self._ensure_string(index_recommendation)
        else:
            index_recommendation = None

        return {
            "original_cost": original_cost,
            "bottlenecks": bottlenecks,
            "optimized_sql": optimized_sql.strip(),
            "index_recommendation": (
                index_recommendation.strip() if index_recommendation else None
            ),
            "explanation": explanation.strip(),
        }

    @staticmethod
    def _ensure_string(value: Any) -> str:
        if isinstance(value, str):
            return value
        elif isinstance(value, list):
            return "\n".join(str(item) for item in value)
        elif value is None:
            return ""
        else:
            return str(value)


optimization_service = OptimizationService()
