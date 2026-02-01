import json
import logging
import time
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.api.v1.endpoints.auth import get_current_user
from backend.app.core.security import decrypt_password
from backend.app.db.session import get_db
from backend.app.models.models import DBConnection, DBType, User
from backend.app.schemas.sql import (SQLExecuteRequest, SQLExecuteResponse,
                                     SQLExplainPlanRequest,
                                     SQLExplainPlanResponse, SQLExplainRequest,
                                     SQLExplainResponse, SQLOptimizeRequest,
                                     SQLOptimizeResponse)
from backend.app.services.execution_service import simulation_executor
from backend.app.services.llm_service import llm_service
from backend.app.services.optimization_service import optimization_service

logger = logging.getLogger(__name__)


router = APIRouter()


def resolve_docker_host(host: str) -> str:
    if host in ['localhost', '127.0.0.1']:
        return 'host.docker.internal'
    return host


def build_sync_connection_string(connection: DBConnection) -> str:
    password = decrypt_password(
        connection.db_password) if connection.db_password else ""

    resolved_host = resolve_docker_host(connection.host)

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
        raise ValueError(f"Unsupported database type: {connection.db_type}")


def format_schema_for_llm(meta_schema: dict) -> str:
    if not meta_schema or "tables" not in meta_schema:
        return ""

    lines = []
    for table in meta_schema.get("tables", []):
        table_name = table.get("name")
        columns = table.get("columns", [])
        lines.append(f"Table: {table_name}")
        for col in columns:
            col_str = f"  {col.get('name')}: {col.get('data_type')}"
            if col.get("primary_key"):
                col_str += " PRIMARY KEY"
            lines.append(col_str)

    return "\n".join(lines)


@router.post("/execute", response_model=SQLExecuteResponse)
async def execute_sql(
    request: SQLExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DBConnection).where(
            DBConnection.id == request.connection_id,
            DBConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )

    if connection.db_type == DBType.SIMULATION:
        logger.info(
            f"[SANDBOX] Using SQLite sandbox for SIMULATION connection "
            f"{connection.id}"
        )
        logger.info(f"[SANDBOX] SQL: {request.sql}")

        if not connection.meta_schema:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SIMULATION connection requires meta_schema."
                "Please sync schema first.")

        tables_count = len(connection.meta_schema.get('tables', []))
        logger.info(f"[SANDBOX] Tables in meta_schema: {tables_count}")

        try:
            start_time = time.time()

            result = simulation_executor.execute(
                meta_schema=connection.meta_schema,
                sql_query=request.sql,
                sample_data=connection.meta_schema.get('sample_data')
            )

            execution_time_ms = (time.time() - start_time) * 1000

            logger.info(
                f"[SANDBOX] Success! Rows: {result['row_count']}, "
                f"Time: {execution_time_ms}ms"
            )

            return SQLExecuteResponse(
                columns=result['columns'],
                rows=result['rows'],
                execution_time_ms=execution_time_ms,
                row_count=result['row_count']
            )
        except Exception as e:
            error_detail = (
                f"Sandbox execution error: {str(e)}\n"
                f"{traceback.format_exc()}"
            )
            logger.error(f"[SANDBOX ERROR] {error_detail}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail
            )

    logger.info(
        f"[LIVE] Executing query on real database: "
        f"{connection.db_type.value}"
    )
    logger.info(f"[LIVE] SQL: {request.sql[:200]}...")

    try:
        conn_string = build_sync_connection_string(connection)
        logger.info(
            f"[LIVE] Creating engine for {connection.db_type.value} database: "
            f"{connection.host}:{connection.port}/{connection.db_name}"
        )
        engine = create_engine(
            conn_string,
            pool_pre_ping=True,
            pool_recycle=3600)
    except Exception as e:
        logger.error(
            f"[LIVE ERROR] Failed to create database connection: {str(e)}\n"
            f"{traceback.format_exc()}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Failed to connect to {connection.db_type.value} database: "
                f"{str(e)}. Please check connection credentials and "
                f"network access."
            ))

    try:
        start_time = time.time()
        logger.info("[LIVE] Running query on real database...")

        with engine.connect() as conn:
            result = simulation_executor.execute_real_db_statements(
                conn, request.sql)
            columns = result["columns"]
            rows = result["rows"]
            row_count = result["row_count"]

            row_count = len(rows) if rows else result["row_count"]

        execution_time_ms = (time.time() - start_time) * 1000

        engine.dispose()

        logger.info(
            f"[LIVE] Success! Retrieved {row_count} rows from real database "
            f"in {execution_time_ms:.2f}ms"
        )

        return SQLExecuteResponse(
            columns=columns,
            rows=rows,
            execution_time_ms=execution_time_ms,
            row_count=row_count
        )

    except Exception as e:
        if engine:
            engine.dispose()
        error_detail = (
            f"SQL execution error on {connection.db_type.value} database: "
            f"{str(e)}"
        )
        logger.error(
            f"[LIVE ERROR] {error_detail}\n{traceback.format_exc()}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail
        )


@router.post("/explain", response_model=SQLExplainPlanResponse)
async def explain_sql_plan(
    request: SQLExplainPlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DBConnection).where(
            DBConnection.id == request.connection_id,
            DBConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )

    if connection.db_type == DBType.SIMULATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "EXPLAIN analysis is not supported for SIMULATION connections."
                "Use this feature with real PostgreSQL/MySQL databases."
            )
        )

    try:
        conn_string = build_sync_connection_string(connection)
        engine = create_engine(
            conn_string,
            pool_pre_ping=True,
            pool_recycle=3600)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create database connection: {str(e)}"
        )

    try:
        start_time = time.time()

        with engine.connect() as conn:
            if connection.db_type == DBType.POSTGRES:
                explain_query = (
                    f"EXPLAIN (ANALYZE, FORMAT JSON) {request.sql}"
                )
                result_proxy = conn.execute(text(explain_query))
                explain_output = result_proxy.fetchone()[0]

                if isinstance(explain_output, str):
                    plan_data = json.loads(explain_output)
                else:
                    plan_data = explain_output

                total_cost = (
                    plan_data[0]["Plan"]["Total Cost"] if plan_data else 0.0
                )

            else:
                explain_query = (
                    f"EXPLAIN FORMAT=JSON {request.sql}"
                )
                result_proxy = conn.execute(text(explain_query))
                explain_output = result_proxy.fetchone()[0]

                plan_data = json.loads(explain_output) if isinstance(
                    explain_output, str) else explain_output
                total_cost = plan_data.get(
                    "query_block",
                    {}).get(
                    "cost_info",
                    {}).get(
                    "query_cost",
                    0.0)

        execution_time_ms = (time.time() - start_time) * 1000

        engine.dispose()

        return SQLExplainPlanResponse(
            plan=plan_data,
            total_cost=float(total_cost),
            execution_time_ms=execution_time_ms
        )

    except Exception as e:
        if engine:
            engine.dispose()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"EXPLAIN error: {str(e)}"
        )


@router.post("/optimize", response_model=SQLOptimizeResponse)
async def optimize_sql(
    request: SQLOptimizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DBConnection).where(
            DBConnection.id == request.connection_id,
            DBConnection.user_id == current_user.id
        )
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found or access denied"
        )

    try:
        analysis = await optimization_service.analyze_query(
            connection_id=request.connection_id,
            sql_query=request.sql_query,
            db=db,
            conversation_id=request.conversation_id
        )

        original_cost = analysis.get("original_cost")
        bottlenecks = analysis.get("bottlenecks", [])
        optimized_sql = analysis.get("optimized_sql")
        index_recommendation = analysis.get("index_recommendation")
        explanation = analysis.get("explanation")
        query_log_id = analysis.get("query_log_id")

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"[OPTIMIZE] Analysis failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimization analysis failed: {str(e)}"
        )

    optimized_cost = None
    if request.include_explain and connection.db_type != DBType.SIMULATION:
        logger.info(
            "[OPTIMIZE] Running EXPLAIN on optimized query to compare costs")
        try:
            conn_string = build_sync_connection_string(connection)
            engine = create_engine(
                conn_string,
                pool_pre_ping=True,
                pool_recycle=3600)

            with engine.connect() as conn:
                if connection.db_type == DBType.POSTGRES:
                    explain_query = f"EXPLAIN (FORMAT JSON) {optimized_sql}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(
                        explain_output, str) else explain_output
                    optimized_cost = plan_data[0]["Plan"]["Total Cost"]

                elif connection.db_type == DBType.MYSQL:
                    explain_query = f"EXPLAIN FORMAT=JSON {optimized_sql}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(
                        explain_output, str) else explain_output
                    optimized_cost = plan_data.get(
                        "query_block",
                        {}).get(
                        "cost_info",
                        {}).get(
                        "query_cost",
                        0.0)

            engine.dispose()
            logger.info(
                f"[OPTIMIZE] Optimized query cost: {optimized_cost}"
            )

        except Exception as e:
            logger.warning(
                f"[OPTIMIZE] Could not get cost for optimized query: {str(e)}"
            )

    stats_comparison = None
    if original_cost is not None and optimized_cost is not None:
        try:
            original_cost_float = float(original_cost)
            optimized_cost_float = float(optimized_cost)

            improvement_percent = 0
            if original_cost_float > 0:
                improvement_percent = round(
                    (
                        (original_cost_float - optimized_cost_float) /
                        original_cost_float
                    ) * 100,
                    2
                )
            stats_comparison = {
                "old_cost": original_cost_float,
                "new_cost": optimized_cost_float,
                "improvement_percent": improvement_percent
            }

            logger.info(
                f"[OPTIMIZE] Cost comparison: {original_cost_float} → "
                f"{optimized_cost_float} ({improvement_percent}% improvement)"
            )
        except (ValueError, TypeError) as e:
            logger.warning(
                f"[OPTIMIZE] Could not calculate cost comparison: {str(e)}")

    if bottlenecks:
        bottleneck_text = "\n\nDetected Performance Bottlenecks:\n" + \
            "\n".join(f"• {b}" for b in bottlenecks)
        explanation = explanation + bottleneck_text

    return SQLOptimizeResponse(
        original_sql=request.sql_query,
        optimized_sql=optimized_sql,
        explanation=explanation,
        index_recommendation=index_recommendation,
        stats_comparison=stats_comparison,
        query_log_id=query_log_id
    )


@router.post("/explain-text", response_model=SQLExplainResponse)
async def explain_sql_text(request: SQLExplainRequest):
    try:
        explanation = await llm_service.explain_query(request.sql_query)

        return SQLExplainResponse(
            sql_query=request.sql_query,
            explanation=explanation
        )

    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Explanation failed: {str(e)}")
