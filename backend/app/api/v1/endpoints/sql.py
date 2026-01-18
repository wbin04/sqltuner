"""
SQL API Endpoints
Handles SQL execution, explanation, and optimization
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, create_engine
from uuid import UUID
import time
import json
import logging
import traceback

logger = logging.getLogger(__name__)

from backend.app.db.session import get_db
from backend.app.core.config import settings
from backend.app.models.models import DBConnection, DBType, User
from backend.app.schemas.sql import (
    SQLExecuteRequest,
    SQLExecuteResponse,
    SQLExplainPlanRequest,
    SQLExplainPlanResponse,
    SQLOptimizeRequest,
    SQLOptimizeResponse,
    SQLExplainRequest,
    SQLExplainResponse,
)
from backend.app.services.llm_service import llm_service
from backend.app.services.execution_service import simulation_executor
from backend.app.core.security import decrypt_password
from backend.app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


def resolve_docker_host(host: str) -> str:
    """
    Resolve localhost to host.docker.internal when running in Docker
    
    Args:
        host: Original host from connection config
        
    Returns:
        Resolved host that works from Docker container
    """
    # If host is localhost or 127.0.0.1, replace with host.docker.internal
    # This allows Docker containers to connect to services on host machine
    if host in ['localhost', '127.0.0.1']:
        return 'host.docker.internal'
    return host


def build_sync_connection_string(connection: DBConnection) -> str:
    """
    Build synchronous SQLAlchemy connection string
    
    Args:
        connection: DBConnection instance
        
    Returns:
        Connection string for sync engine
    """
    password = decrypt_password(connection.db_password) if connection.db_password else ""
    
    # Resolve localhost for Docker environment
    resolved_host = resolve_docker_host(connection.host)
    
    if connection.db_type == DBType.POSTGRES:
        return f"postgresql://{connection.username}:{password}@{resolved_host}:{connection.port}/{connection.db_name}"
    elif connection.db_type == DBType.MYSQL:
        return f"mysql+pymysql://{connection.username}:{password}@{resolved_host}:{connection.port}/{connection.db_name}"
    else:
        raise ValueError(f"Unsupported database type: {connection.db_type}")


def format_schema_for_llm(meta_schema: dict) -> str:
    """Format meta_schema for LLM context"""
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
    """
    Execute SQL query on real database
    
    - Validates connection ownership
    - Executes query on target database
    - Returns columns, rows, and execution time
    - Does NOT support simulation mode (use chat for that)
    """
    # Fetch and validate connection
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
    
    # ROUTING LOGIC: Path A (LIVE) vs Path B (SANDBOX)
    # Path B: SANDBOX - Only for SIMULATION type connections
    if connection.db_type == DBType.SIMULATION:
        logger.info(f"[SANDBOX] Using SQLite sandbox for SIMULATION connection {connection.id}")
        logger.info(f"[SANDBOX] SQL: {request.sql}")
        
        if not connection.meta_schema:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SIMULATION connection requires meta_schema. Please sync schema first."
            )
        
        tables_count = len(connection.meta_schema.get('tables', []))
        logger.info(f"[SANDBOX] Tables in meta_schema: {tables_count}")
        
        try:
            start_time = time.time()
            
            # Execute on in-memory SQLite using meta_schema
            result = simulation_executor.execute(
                meta_schema=connection.meta_schema,
                sql_query=request.sql,
                sample_data=connection.meta_schema.get('sample_data')
            )
            
            execution_time_ms = (time.time() - start_time) * 1000
            
            logger.info(f"[SANDBOX] Success! Rows: {result['row_count']}, Time: {execution_time_ms}ms")
            
            return SQLExecuteResponse(
                columns=result['columns'],
                rows=result['rows'],
                execution_time_ms=execution_time_ms,
                row_count=result['row_count']
            )
        except Exception as e:
            error_detail = f"Sandbox execution error: {str(e)}\n{traceback.format_exc()}"
            logger.error(f"[SANDBOX ERROR] {error_detail}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail
            )
    
    # Path A: LIVE EXECUTION - For real PostgreSQL/MySQL connections
    logger.info(f"[LIVE] Executing query on real database: {connection.db_type.value}")
    logger.info(f"[LIVE] SQL: {request.sql[:200]}...")
    
    # Build connection string and create sync engine for real databases
    try:
        conn_string = build_sync_connection_string(connection)
        logger.info(f"[LIVE] Creating engine for {connection.db_type.value} database: {connection.host}:{connection.port}/{connection.db_name}")
        engine = create_engine(conn_string, pool_pre_ping=True, pool_recycle=3600)
    except Exception as e:
        logger.error(f"[LIVE ERROR] Failed to create database connection: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect to {connection.db_type.value} database: {str(e)}. Please check connection credentials and network access."
        )
    
    # Execute query
    try:
        start_time = time.time()
        logger.info(f"[LIVE] Running query on real database...")
        
        with engine.connect() as conn:
            result_proxy = conn.execute(text(request.sql))
            
            # Check if query returns results
            if result_proxy.returns_rows:
                columns = list(result_proxy.keys())
                rows = [dict(row._mapping) for row in result_proxy.fetchall()]
            else:
                # For INSERT, UPDATE, DELETE, etc.
                columns = []
                rows = []
            
            row_count = len(rows) if rows else result_proxy.rowcount
        
        execution_time_ms = (time.time() - start_time) * 1000
        
        engine.dispose()
        
        logger.info(f"[LIVE] Success! Retrieved {row_count} rows from real database in {execution_time_ms:.2f}ms")
        
        return SQLExecuteResponse(
            columns=columns,
            rows=rows,
            execution_time_ms=execution_time_ms,
            row_count=row_count
        )
        
    except Exception as e:
        if engine:
            engine.dispose()
        error_detail = f"SQL execution error on {connection.db_type.value} database: {str(e)}"
        logger.error(f"[LIVE ERROR] {error_detail}\n{traceback.format_exc()}")
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
    """
    Run EXPLAIN (ANALYZE, FORMAT JSON) on SQL query
    
    - Only works with real databases (PostgreSQL/MySQL)
    - Returns execution plan with cost estimates
    """
    # Fetch and validate connection
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
    
    # EXPLAIN only supported for real databases, not SIMULATION
    if connection.db_type == DBType.SIMULATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="EXPLAIN analysis is not supported for SIMULATION connections. Use this feature with real PostgreSQL/MySQL databases."
        )
    
    # Build connection and execute EXPLAIN
    try:
        conn_string = build_sync_connection_string(connection)
        engine = create_engine(conn_string, pool_pre_ping=True, pool_recycle=3600)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create database connection: {str(e)}"
        )
    
    try:
        start_time = time.time()
        
        with engine.connect() as conn:
            # PostgreSQL EXPLAIN format
            if connection.db_type == DBType.POSTGRES:
                explain_query = f"EXPLAIN (ANALYZE, FORMAT JSON) {request.sql}"
                result_proxy = conn.execute(text(explain_query))
                explain_output = result_proxy.fetchone()[0]
                
                # Parse JSON output
                if isinstance(explain_output, str):
                    plan_data = json.loads(explain_output)
                else:
                    plan_data = explain_output
                
                # Extract total cost from first plan
                total_cost = plan_data[0]["Plan"]["Total Cost"] if plan_data else 0.0
                
            else:  # MySQL
                explain_query = f"EXPLAIN FORMAT=JSON {request.sql}"
                result_proxy = conn.execute(text(explain_query))
                explain_output = result_proxy.fetchone()[0]
                
                plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                total_cost = plan_data.get("query_block", {}).get("cost_info", {}).get("query_cost", 0.0)
        
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
    """
    Optimize SQL query using LLM with optional EXPLAIN analysis
    
    - Fetches meta_schema from connection
    - Runs EXPLAIN on original query (if include_explain=True)
    - Uses LLM to optimize with schema context
    - Runs EXPLAIN on optimized query
    - Returns comparison stats
    """
    # Fetch and validate connection
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
    
    # Get meta_schema for context
    schema_text = format_schema_for_llm(connection.meta_schema or {})
    
    # Run EXPLAIN on original query (only for real databases, not SIMULATION)
    original_cost = None
    optimized_cost = None
    
    if request.include_explain and connection.db_type != DBType.SIMULATION:
        logger.info(f"[OPTIMIZE] Running EXPLAIN on original query for {connection.db_type.value} database")
        try:
            conn_string = build_sync_connection_string(connection)
            engine = create_engine(conn_string, pool_pre_ping=True, pool_recycle=3600)
            
            with engine.connect() as conn:
                if connection.db_type == DBType.POSTGRES:
                    explain_query = f"EXPLAIN (FORMAT JSON) {request.sql_query}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                    original_cost = plan_data[0]["Plan"]["Total Cost"]
                else:  # MySQL
                    explain_query = f"EXPLAIN FORMAT=JSON {request.sql_query}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                    original_cost = plan_data.get("query_block", {}).get("cost_info", {}).get("query_cost", 0.0)
            
            engine.dispose()
        except Exception as e:
            # Continue without EXPLAIN if it fails
            pass
    
    # Call LLM to optimize
    try:
        result = await llm_service.optimize_sql(
            sql_query=request.sql_query,
            db_schema=schema_text
        )
        
        optimized_sql = result["optimized_sql"]
        explanation = result["explanation"]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimization failed: {str(e)}"
        )
    
    # Generate index recommendations based on schema
    index_recommendation = None
    if schema_text:
        # Ask LLM for index suggestions
        index_prompt = f"""Based on this SQL query and schema, suggest index optimizations:

Query: {request.sql_query}

{schema_text}

Provide ONLY the CREATE INDEX statements, one per line. No explanations."""
        
        try:
            index_recommendation = await llm_service._call_ollama(
                model=llm_service.coder_model,
                prompt=index_prompt,
                temperature=0.1
            )
        except:
            pass
    
    # Run EXPLAIN on optimized query (only for real databases)
    if request.include_explain and connection.db_type != DBType.SIMULATION:
        logger.info(f"[OPTIMIZE] Running EXPLAIN on optimized query for {connection.db_type.value} database")
        try:
            conn_string = build_sync_connection_string(connection)
            engine = create_engine(conn_string, pool_pre_ping=True, pool_recycle=3600)
            
            with engine.connect() as conn:
                if connection.db_type == DBType.POSTGRES:
                    explain_query = f"EXPLAIN (FORMAT JSON) {optimized_sql}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                    optimized_cost = plan_data[0]["Plan"]["Total Cost"]
                else:  # MySQL
                    explain_query = f"EXPLAIN FORMAT=JSON {optimized_sql}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                    optimized_cost = plan_data.get("query_block", {}).get("cost_info", {}).get("query_cost", 0.0)
            
            engine.dispose()
        except Exception as e:
            # Continue without EXPLAIN if it fails
            pass
    
    # Build stats comparison
    stats_comparison = None
    if original_cost is not None and optimized_cost is not None:
        stats_comparison = {
            "old_cost": float(original_cost),
            "new_cost": float(optimized_cost),
            "improvement_percent": round(((original_cost - optimized_cost) / original_cost) * 100, 2) if original_cost > 0 else 0
        }
    
    return SQLOptimizeResponse(
        original_sql=request.sql_query,
        optimized_sql=optimized_sql,
        explanation=explanation,
        index_recommendation=index_recommendation,
        stats_comparison=stats_comparison
    )


@router.post("/explain-text", response_model=SQLExplainResponse)
async def explain_sql_text(request: SQLExplainRequest):
    """
    Get natural language explanation of SQL query using LLM
    (Legacy endpoint for backward compatibility)
    
    - **sql_query**: The SQL query to explain
    """
    try:
        explanation = await llm_service.explain_query(request.sql_query)
        
        return SQLExplainResponse(
            sql_query=request.sql_query,
            explanation=explanation
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")
