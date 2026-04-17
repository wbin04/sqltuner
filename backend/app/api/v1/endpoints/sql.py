import json
import logging
import time
import traceback

from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings
from app.core.constants import SQL_CONNECTION_TIMEOUT, SQL_EXECUTION_TIMEOUT
from app.core.exceptions import ExecutionError, ValidationError
from app.core.security import decrypt_password
from app.db.session import get_db
from app.models.models import DBType, User
from app.repositories.connection_repository import connection_repository
from app.schemas.sql import (SQLExecuteRequest, SQLExecuteResponse,
                             SQLExplainPlanRequest, SQLExplainPlanResponse,
                             SQLExplainRequest, SQLExplainResponse,
                             SQLOptimizeRequest, SQLOptimizeResponse)
from app.services.execution_service import simulation_executor
from app.services.llm_service import llm_service
from app.services.optimization_service import (ConnectionStringBuilder,
                                               optimization_service)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


router = APIRouter()


def build_sync_connection_string(connection):
    password = decrypt_password(
        connection.db_password) if connection.db_password else ""

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


def run_sandbox_execution(
    connection,
    request: SQLExecuteRequest
):
    logger.warning(f"[DEBUG] ENTERED run_sandbox_execution for connection {connection.id}")
    logger.warning(
        f"[SANDBOX] Using SQLite sandbox for SIMULATION connection "
        f"{connection.id}"
    )
    logger.warning(f"[SANDBOX] SQL: {request.sql}")

    # Validate meta_schema exists
    if not connection.meta_schema:
        logger.error(
            f"[SANDBOX ERROR] connection.meta_schema is None or empty for "
            f"connection {connection.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SIMULATION connection requires meta_schema. "
            "Please sync schema first."
        )

    # Validate meta_schema structure
    if not isinstance(connection.meta_schema, dict):
        logger.error(
            f"[SANDBOX ERROR] meta_schema is not a dict: "
            f"{type(connection.meta_schema)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid meta_schema format. Expected dictionary."
        )

    tables = connection.meta_schema.get('tables', [])
    if not isinstance(tables, list):
        logger.error(
            f"[SANDBOX ERROR] meta_schema.tables is not a list: "
            f"{type(tables)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid meta_schema.tables format. Expected list."
        )

    tables_count = len(tables)
    logger.info(f"[SANDBOX] Tables in meta_schema: {tables_count}")

    try:
        start_time = time.time()

        result = simulation_executor.execute(
            meta_schema=connection.meta_schema,
            sql_query=request.sql,
            sample_data=connection.meta_schema.get('sample_data')
        )

        execution_time_ms = (time.time() - start_time) * 1000

        total_rows = result['row_count']
        rows = result['rows'][:settings.SANDBOX_MAX_ROWS]
        truncated = total_rows > settings.SANDBOX_MAX_ROWS

        logger.info(
            f"[SANDBOX] Success! Total rows: {total_rows}, "
            f"Returned: {len(rows)}, Truncated: {truncated}, "
            f"Time: {execution_time_ms}ms"
        )

        return SQLExecuteResponse(
            columns=result['columns'],
            rows=rows,
            execution_time_ms=execution_time_ms,
            row_count=len(rows),
            total_rows=total_rows,
            truncated=truncated,
            max_rows=settings.SANDBOX_MAX_ROWS
        )
    except ValidationError as e:
        error_msg = f"Validation error: {str(e)}"
        logger.error(f"[SANDBOX ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    except ExecutionError as e:
        error_msg = f"Execution error: {str(e)}"
        logger.error(f"[SANDBOX ERROR] {error_msg}")
        logger.error(f"[SANDBOX ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    except Exception as e:
        error_detail = (
            f"Sandbox execution error: {str(e)}\n"
            f"Type: {type(e).__name__}"
        )
        logger.error(f"[SANDBOX ERROR] {error_detail}")
        logger.error(
            f"[SANDBOX ERROR] Full traceback:\n{traceback.format_exc()}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_detail
        )


@router.post("/execute", response_model=SQLExecuteResponse)
async def execute_sql(
    request: SQLExecuteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    logger.info(f"[DEBUG] execute_sql called - connection_id: {request.connection_id}, user: {current_user.email}")

    try:
        connection = await connection_repository.get_by_user_and_id(
            db=db,
            user_id=current_user.id,
            connection_id=request.connection_id
        )
        logger.info(f"[DEBUG] Connection fetched: {connection.id if connection else 'None'}")
    except Exception as e:
        logger.error(f"[DEBUG] Error fetching connection: {str(e)}")
        raise

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )

    try:
        db_type_str = str(connection.db_type) if connection.db_type else "None"
        db_type_value = connection.db_type.value if connection.db_type else "N/A"
        logger.info(f"[DEBUG] Connection {connection.id} has db_type: {db_type_str} (value: {db_type_value})")
    except Exception as e:
        logger.error(f"[DEBUG] Error accessing db_type: {str(e)}, db_type raw: {connection.db_type}")
        raise

    if connection.db_type == DBType.SIMULATION:
        logger.info(f"[DEBUG] Entering sandbox execution for connection {connection.id}")
        return run_sandbox_execution(connection, request)

    logger.info("[DEBUG] Not SIMULATION, proceeding to live execution")

    logger.info(
        f"[LIVE] Executing query on real database: "
        f"{connection.db_type.value}"
    )
    logger.info(f"[LIVE] SQL: {request.sql[:200]}...")

    engine = None
    try:
        conn_string = build_sync_connection_string(connection)
        logger.info(
            f"[LIVE] Creating engine for {connection.db_type.value} database: "
            f"{connection.host}:{connection.port}/{connection.db_name}"
        )

        connect_args = {}
        if connection.db_type.value == "postgresql":
            timeout_ms = SQL_EXECUTION_TIMEOUT * 1000
            connect_args = {
                "connect_timeout": SQL_CONNECTION_TIMEOUT,
                "options": f"-c statement_timeout={timeout_ms}"
            }
        elif connection.db_type.value == "mysql":
            connect_args = {
                "connect_timeout": SQL_CONNECTION_TIMEOUT,
            }

        engine = create_engine(
            conn_string,
            pool_pre_ping=True,
            pool_recycle=3600,
            connect_args=connect_args,
            pool_timeout=SQL_CONNECTION_TIMEOUT
        )

        logger.info("[LIVE] Testing database connection...")
        with engine.connect() as test_conn:
            test_conn.execute(text("SELECT 1"))
        logger.info("[LIVE] Connection test successful")

    except Exception as e:
        logger.warning(
            f"[LIVE] Cannot connect to {connection.db_type.value} database "
            f"at {connection.host}:{connection.port} - "
            f"Error: {str(e)}"
        )
        logger.warning(
            "[LIVE] Falling back to sandbox execution due to "
            "connection failure"
        )
        return run_sandbox_execution(connection, request)

    try:
        start_time = time.time()
        logger.info("[LIVE] Running query on real database...")

        with engine.connect() as conn:
            if connection.db_type.value == "mysql":
                timeout_sec = SQL_EXECUTION_TIMEOUT
                conn.execute(
                    text(
                        "SET SESSION max_execution_time = "
                        f"{timeout_sec * 1000}"
                    )
                )

            query_start = time.time()
            result = simulation_executor.execute_in_real_db(
                conn, request.sql)
            query_duration = (time.time() - query_start) * 1000
            logger.info(
                f"[LIVE] Query executed in {query_duration:.2f}ms"
            )

            result_dict = result.to_dict()
            columns = result_dict["columns"]
            all_rows = result_dict["rows"]
            total_rows = (
                len(all_rows) if all_rows else result_dict["row_count"]
            )

            rows = all_rows[:settings.RESULT_MAX_ROWS] if all_rows else []
            truncated = total_rows > settings.RESULT_MAX_ROWS

        execution_time_ms = (time.time() - start_time) * 1000

        engine.dispose()

        logger.info(
            f"[LIVE] Success! Total rows: {total_rows}, "
            f"Returned: {len(rows)}, Truncated: {truncated}, "
            f"in {execution_time_ms:.2f}ms (total including connection)"
        )

        return SQLExecuteResponse(
            columns=columns,
            rows=rows,
            execution_time_ms=execution_time_ms,
            row_count=len(rows),
            total_rows=total_rows,
            truncated=truncated,
            max_rows=settings.RESULT_MAX_ROWS
        )

    except Exception as e:
        if engine:
            engine.dispose()

        error_str = str(e).lower()
        error_type = type(e).__name__

        if "timeout" in error_str or "time" in error_str:
            error_detail = (
                f"Query execution timeout on {connection.db_type.value} "
                f"database. Limit: {SQL_EXECUTION_TIMEOUT}s. "
                f"Error: {str(e)}"
            )
            logger.error(
                f"[LIVE ERROR - TIMEOUT] {error_detail}\n"
                f"{traceback.format_exc()}"
            )
        else:
            error_detail = (
                f"SQL execution error on {connection.db_type.value} "
                f"database ({error_type}): {str(e)}"
            )
            logger.error(
                f"[LIVE ERROR] {error_detail}\n{traceback.format_exc()}"
            )

        logger.info(
            "[LIVE] Falling back to sandbox execution due to error"
        )
        return run_sandbox_execution(connection, request)



def _rows_to_dicts(columns: list, rows: list) -> list:
    """Convert list-of-tuples rows to list-of-dicts using column names."""
    return [dict(zip(columns, row)) for row in rows]


def _run_explain_simulation(connection, sql: str) -> SQLExplainPlanResponse:
    """Run EXPLAIN QUERY PLAN on in-memory SQLite for SIMULATION connections."""
    import sqlite3 as _sqlite3

    meta_schema = connection.meta_schema or {}
    t_total = time.time()

    raw_db = _sqlite3.connect(":memory:")
    for table in meta_schema.get("tables", []):
        tname = table.get("name")
        cols = table.get("columns", [])
        if not tname or not cols:
            continue
        col_defs, pk_cols = [], []
        for col in cols:
            cname = col.get("name")
            ctype = col.get("type", "TEXT")
            nullable = col.get("is_nullable", True)
            if col.get("is_pk"):
                pk_cols.append(cname)
            col_defs.append(f'"{cname}" {ctype}{"" if nullable else " NOT NULL"}')
        if pk_cols:
            col_defs.append(f'PRIMARY KEY ({", ".join(pk_cols)})')
        raw_db.execute(f'CREATE TABLE IF NOT EXISTS "{tname}" ({", ".join(col_defs)})')
        for row in table.get("sample_data", []):
            rc, rv = list(row.keys()), list(row.values())
            ph = ", ".join("?" for _ in rc)
            cs = ", ".join(f'"{c}"' for c in rc)
            try:
                raw_db.execute(f'INSERT OR IGNORE INTO "{tname}" ({cs}) VALUES ({ph})', rv)
            except Exception:
                pass
    raw_db.commit()
    cur = raw_db.cursor()

    cur.execute(f"EXPLAIN QUERY PLAN {sql}")
    plan_cols = [d[0] for d in cur.description] if cur.description else ["id", "parent", "notused", "detail"]
    plan_rows_raw = cur.fetchall()

    t_exec_start = time.time()
    actual_row_count = 0
    exec_error = None
    try:
        cur.execute(sql)
        actual_row_count = len(cur.fetchall())
    except Exception as e:
        exec_error = str(e)
    t_exec_ms = (time.time() - t_exec_start) * 1000
    raw_db.close()

    explain_rows = [dict(zip(plan_cols, row)) for row in plan_rows_raw]
    explain_rows.append({"id": "", "parent": "", "notused": "", "detail": "---"})
    if exec_error:
        explain_rows.append({"id": "", "parent": "", "notused": "",
                             "detail": f"[Execution ERROR] {exec_error}"})
    else:
        explain_rows.append({"id": "", "parent": "", "notused": "",
                             "detail": f"[Execution OK] {actual_row_count} rows — {t_exec_ms:.2f} ms"})

    return SQLExplainPlanResponse(
        db_type="simulation",
        explain_columns=list(plan_cols),
        explain_rows=explain_rows,
        analyze_available=False,
        analyze_unavailable_reason=(
            "EXPLAIN ANALYZE is not supported by SQLite. "
            "Showing EXPLAIN QUERY PLAN with actual execution timing."
        ),
        execution_time_ms=(time.time() - t_total) * 1000,
    )


def _run_explain_mysql(engine, sql: str) -> SQLExplainPlanResponse:
    """Run EXPLAIN and EXPLAIN ANALYZE on MySQL."""
    start_time = time.time()
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()

        cursor.execute(f"EXPLAIN {sql}")
        explain_cols = [desc[0] for desc in cursor.description] if cursor.description else []
        explain_rows = _rows_to_dicts(explain_cols, cursor.fetchall())

        analyze_cols = None
        analyze_rows = None
        analyze_available = False
        analyze_unavailable_reason = None
        try:
            cursor.execute(f"EXPLAIN ANALYZE {sql}")
            analyze_desc = cursor.description or []
            analyze_cols_raw = [desc[0] for desc in analyze_desc]
            analyze_rows_raw = cursor.fetchall()
            if analyze_rows_raw:
                if len(analyze_cols_raw) == 1:
                    full_text = analyze_rows_raw[0][0] if analyze_rows_raw else ""
                    lines = [line for line in full_text.split("\n") if line.strip()]
                    analyze_cols = ["Plan"]
                    analyze_rows = [{"Plan": line} for line in lines]
                else:
                    analyze_cols = analyze_cols_raw
                    analyze_rows = _rows_to_dicts(analyze_cols_raw, analyze_rows_raw)
                analyze_available = True
        except Exception as e:
            analyze_unavailable_reason = f"EXPLAIN ANALYZE requires MySQL 8.0+. Error: {str(e)}"

        return SQLExplainPlanResponse(
            db_type="mysql",
            explain_columns=explain_cols,
            explain_rows=explain_rows,
            analyze_columns=analyze_cols,
            analyze_rows=analyze_rows,
            analyze_available=analyze_available,
            analyze_unavailable_reason=analyze_unavailable_reason,
            execution_time_ms=(time.time() - start_time) * 1000,
        )
    finally:
        cursor.close()
        raw_conn.close()


def _run_explain_postgres(engine, sql: str) -> SQLExplainPlanResponse:
    """Run EXPLAIN and EXPLAIN ANALYZE on PostgreSQL."""
    start_time = time.time()
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()

        cursor.execute(f"EXPLAIN {sql}")
        explain_rows_raw = cursor.fetchall()
        explain_cols = ["QUERY PLAN"]
        explain_rows = [{"QUERY PLAN": row[0]} for row in explain_rows_raw]

        analyze_cols = None
        analyze_rows = None
        analyze_available = False
        analyze_unavailable_reason = None
        try:
            cursor.execute(f"EXPLAIN ANALYZE {sql}")
            analyze_rows_raw2 = cursor.fetchall()
            analyze_cols = ["QUERY PLAN"]
            analyze_rows = [{"QUERY PLAN": row[0]} for row in analyze_rows_raw2]
            analyze_available = True
        except Exception as e:
            analyze_unavailable_reason = f"EXPLAIN ANALYZE failed: {str(e)}"

        return SQLExplainPlanResponse(
            db_type="postgresql",
            explain_columns=explain_cols,
            explain_rows=explain_rows,
            analyze_columns=analyze_cols,
            analyze_rows=analyze_rows,
            analyze_available=analyze_available,
            analyze_unavailable_reason=analyze_unavailable_reason,
            execution_time_ms=(time.time() - start_time) * 1000,
        )
    finally:
        cursor.close()
        raw_conn.close()


@router.post("/explain", response_model=SQLExplainPlanResponse)
async def explain_sql_plan(
    request: SQLExplainPlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=request.connection_id
    )

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )

    if connection.db_type == DBType.SIMULATION:
        try:
            return _run_explain_simulation(connection, request.sql)
        except Exception as e:
            logger.error(f"[SANDBOX EXPLAIN ERROR]: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sandbox EXPLAIN error: {str(e)}"
            )

    engine = None
    try:
        conn_string = build_sync_connection_string(connection)
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
        with engine.connect() as test_conn:
            test_conn.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Failed to connect to {connection.db_type.value} database "
                f"at {connection.host}:{connection.port}. "
                f"Error: {str(e)}."
            )
        )

    try:
        if connection.db_type == DBType.MYSQL:
            result = _run_explain_mysql(engine, request.sql)
        else:
            result = _run_explain_postgres(engine, request.sql)
        return result
    except Exception as e:
        logger.error(f"[EXPLAIN ERROR]: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"EXPLAIN error: {str(e)}"
        )
    finally:
        if engine:
            engine.dispose()


@router.post("/optimize", response_model=SQLOptimizeResponse)
async def optimize_sql(
    request: SQLOptimizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    connection = await connection_repository.get_by_user_and_id(
        db=db,
        user_id=current_user.id,
        connection_id=request.connection_id
    )

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
        rewrite_type = analysis.get("rewrite_type")
        changes_made = analysis.get("changes_made", [])
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
                pool_timeout=SQL_CONNECTION_TIMEOUT)

            logger.info("[OPTIMIZE] Testing database connection...")
            with engine.connect() as test_conn:
                test_conn.execute(text("SELECT 1"))
            logger.info("[OPTIMIZE] Connection test successful")

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

    return SQLOptimizeResponse(
        original_sql=request.sql_query,
        optimized_sql=optimized_sql,
        explanation=explanation,
        index_recommendation=index_recommendation,
        rewrite_type=rewrite_type,
        changes_made=changes_made,
        bottlenecks=bottlenecks,
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


@router.post("/refresh-llm-url")
async def refresh_llm_url(
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh LLM base URL from database.
    Useful when ngrok URL changes.
    """
    try:
        await llm_service.fetch_and_update_url_from_db(db)
        return {
            "success": True,
            "message": "LLM URL refreshed successfully",
            "current_url": llm_service.base_url
        }
    except Exception as e:
        logger.error(f"Failed to refresh LLM URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh LLM URL: {str(e)}"
        )
