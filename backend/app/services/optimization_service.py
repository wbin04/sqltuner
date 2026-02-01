"""
SQL Optimization Service
Analyzes SQL queries using EXPLAIN plans and LLM recommendations
"""
from typing import Dict, Any, Optional
from uuid import UUID
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import json
import logging
import time

from backend.app.models.models import DBConnection, DBType, PerformanceAnalysis, QueryLog, Conversation
from backend.app.services.llm_service import llm_service
from backend.app.core.security import decrypt_password

logger = logging.getLogger(__name__)


class OptimizationService:
    """
    Service for analyzing and optimizing SQL queries
    
    Workflow:
    1. Fetch database connection and schema
    2. Run EXPLAIN to get execution plan (for real databases)
    3. Use LLM to analyze bottlenecks and suggest optimizations
    4. Generate index recommendations
    5. Return comprehensive optimization report
    """
    
    @staticmethod
    def _resolve_docker_host(host: str) -> str:
        """Resolve localhost to host.docker.internal when running in Docker"""
        if host in ['localhost', '127.0.0.1']:
            return 'host.docker.internal'
        return host
    
    @staticmethod
    def _build_connection_string(connection: DBConnection) -> str:
        """Build synchronous SQLAlchemy connection string"""
        password = decrypt_password(connection.db_password) if connection.db_password else ""
        resolved_host = OptimizationService._resolve_docker_host(connection.host)
        
        if connection.db_type == DBType.POSTGRES:
            return f"postgresql://{connection.username}:{password}@{resolved_host}:{connection.port}/{connection.db_name}"
        elif connection.db_type == DBType.MYSQL:
            return f"mysql+pymysql://{connection.username}:{password}@{resolved_host}:{connection.port}/{connection.db_name}"
        else:
            raise ValueError(f"Unsupported database type: {connection.db_type}")
    
    @staticmethod
    def _format_schema_for_llm(meta_schema: dict) -> str:
        """Format meta_schema JSON into human-readable text for LLM"""
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
            
            # Columns
            lines.append("Columns:")
            for col in columns:
                col_info = f"  - {col.get('name')}: {col.get('data_type')}"
                if col.get("primary_key"):
                    col_info += " [PRIMARY KEY]"
                if col.get("nullable") is False:
                    col_info += " [NOT NULL]"
                lines.append(col_info)
            
            # Indexes
            if indexes:
                lines.append("Indexes:")
                for idx in indexes:
                    idx_cols = ", ".join(idx.get("columns", []))
                    idx_type = " [UNIQUE]" if idx.get("unique") else ""
                    lines.append(f"  - {idx.get('name')}: ({idx_cols}){idx_type}")
            else:
                lines.append("Indexes: None (consider adding indexes)")
        
        return "\n".join(lines)
    
    @staticmethod
    async def _get_explain_plan(
        connection: DBConnection,
        sql_query: str
    ) -> Optional[Dict[str, Any]]:
        """
        Execute EXPLAIN query and return the plan
        
        Returns:
            Dictionary with 'plan' and 'total_cost' keys, or None if EXPLAIN fails
        """
        if connection.db_type == DBType.SIMULATION:
            logger.info("[OPTIMIZE] Skipping EXPLAIN for SIMULATION connection")
            return None
        
        try:
            conn_string = OptimizationService._build_connection_string(connection)
            engine = create_engine(conn_string, pool_pre_ping=True, pool_recycle=3600)
            
            with engine.connect() as conn:
                if connection.db_type == DBType.POSTGRES:
                    # PostgreSQL: Use EXPLAIN (ANALYZE, FORMAT JSON)
                    explain_query = f"EXPLAIN (ANALYZE, FORMAT JSON) {sql_query}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    
                    plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                    total_cost = plan_data[0]["Plan"]["Total Cost"] if plan_data else 0.0
                    
                elif connection.db_type == DBType.MYSQL:
                    # MySQL: Use EXPLAIN FORMAT=JSON
                    explain_query = f"EXPLAIN FORMAT=JSON {sql_query}"
                    result_proxy = conn.execute(text(explain_query))
                    explain_output = result_proxy.fetchone()[0]
                    
                    plan_data = json.loads(explain_output) if isinstance(explain_output, str) else explain_output
                    total_cost = plan_data.get("query_block", {}).get("cost_info", {}).get("query_cost", 0.0)
                
                else:
                    logger.warning(f"[OPTIMIZE] Unsupported db_type: {connection.db_type}")
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
    def _extract_bottlenecks(explain_plan: Dict[str, Any], db_type: DBType) -> list:
        """
        Parse EXPLAIN plan to identify performance bottlenecks
        
        Returns:
            List of bottleneck descriptions (e.g., "Sequential Scan on users")
        """
        bottlenecks = []
        
        try:
            if db_type == DBType.POSTGRES:
                # PostgreSQL plan structure
                plan = explain_plan.get("plan", [{}])[0].get("Plan", {})
                
                def traverse_plan(node):
                    node_type = node.get("Node Type", "")
                    relation_name = node.get("Relation Name", "")
                    
                    # Identify inefficient operations
                    if "Seq Scan" in node_type:
                        bottlenecks.append(f"Sequential Scan on '{relation_name}' (no index used)")
                    
                    if "Hash Join" in node_type and node.get("Total Cost", 0) > 1000:
                        bottlenecks.append(f"High-cost Hash Join (cost: {node.get('Total Cost')})")
                    
                    if "Nested Loop" in node_type and node.get("Actual Loops", 1) > 1000:
                        bottlenecks.append(f"Expensive Nested Loop (loops: {node.get('Actual Loops')})")
                    
                    # Traverse child plans
                    for child in node.get("Plans", []):
                        traverse_plan(child)
                
                traverse_plan(plan)
            
            elif db_type == DBType.MYSQL:
                # MySQL plan structure (simplified)
                query_block = explain_plan.get("plan", {}).get("query_block", {})
                table = query_block.get("table", {})
                
                access_type = table.get("access_type", "")
                if access_type in ["ALL", "index"]:
                    table_name = table.get("table_name", "unknown")
                    bottlenecks.append(f"Full table scan on '{table_name}' (access_type: {access_type})")
        
        except Exception as e:
            logger.warning(f"[OPTIMIZE] Failed to extract bottlenecks: {str(e)}")
        
        return bottlenecks
    
    @staticmethod
    async def analyze_query(
        connection_id: UUID,
        sql_query: str,
        db: AsyncSession,
        conversation_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Main method: Analyze SQL query and provide optimization recommendations
        
        Args:
            connection_id: Database connection UUID
            sql_query: SQL query to analyze
            db: AsyncSession for database operations
            
        Returns:
            Dictionary with optimization analysis:
            {
                "original_cost": float,
                "bottlenecks": List[str],
                "optimized_sql": str,
                "index_recommendation": str,
                "explanation": str
            }
        """
        import time
        start_total = time.time()
        logger.info(f"[OPTIMIZE] Starting analysis for connection {connection_id}")
        
        # --- STEP 1: Fetch Database Connection ---
        start_step = time.time()
        result = await db.execute(
            select(DBConnection).where(DBConnection.id == connection_id)
        )
        connection = result.scalar_one_or_none()
        
        if not connection:
            raise ValueError(f"Connection {connection_id} not found")
        logger.info(f"[OPTIMIZE] Step 1 - Fetch connection: {time.time() - start_step:.2f}s")
        
        # --- STEP 1.5: Create Query Log for Persistence (OPTIONAL) ---
        # Only create conversation/query_log if conversation_id is provided
        # This saves 2-3 DB operations for standalone optimization requests
        query_log = None
        if conversation_id:
            # Use existing conversation
            result = await db.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if not conversation:
                raise ValueError(f"Conversation {conversation_id} not found")
            
            # Create query log entry
            query_log = QueryLog(
                conversation_id=conversation.id,
                role="assistant",  # System-generated
                action_type="optimize",
                content=sql_query,
                sql_generated=None  # Will be set later if needed
            )
            db.add(query_log)
            await db.flush()  # Get the ID
            
            logger.info(f"[OPTIMIZE] Created query log {query_log.id} for optimization")
        else:
            logger.info("[OPTIMIZE] No conversation_id provided, skipping query log creation")
        
        # --- STEP 2: Get Execution Plan (Real DB Only) ---
        start_step = time.time()
        explain_result = await OptimizationService._get_explain_plan(connection, sql_query)
        
        if explain_result:
            explain_plan = explain_result["plan"]
            original_cost = explain_result["total_cost"]
            bottlenecks = OptimizationService._extract_bottlenecks(
                {"plan": explain_plan},
                connection.db_type
            )
            logger.info(f"[OPTIMIZE] Step 2 - EXPLAIN: {time.time() - start_step:.2f}s, cost={original_cost}")
        else:
            # Simulation mode or EXPLAIN failed
            explain_plan = None
            original_cost = None
            bottlenecks = []
            logger.info(f"[OPTIMIZE] Step 2 - EXPLAIN: {time.time() - start_step:.2f}s (skipped)")
        
        # --- STEP 3: Prepare Schema for LLM (As JSON String) ---
        # Convert meta_schema to JSON string for llm_service.optimize_sql()
        db_schema_json = json.dumps(connection.meta_schema) if connection.meta_schema else None
        
        # --- STEP 4: LLM Analysis (Using Context Pruning + Guardrails) ---
        start_step = time.time()
        logger.info("[OPTIMIZE] Calling LLM with context pruning and hallucination prevention...")
        
        try:
            # Use the refactored optimize_sql method which implements:
            # - Context pruning (only relevant tables)
            # - Post-processing validation (reject hallucinated indexes)
            # - Zero-Trust architecture
            llm_result = await llm_service.optimize_sql(
                sql_query=sql_query,
                db_schema=db_schema_json
            )
            logger.info(f"[OPTIMIZE] Step 4 - LLM call: {time.time() - start_step:.2f}s")
            
            # Extract fields from llm_result
            optimized_sql = llm_result.get("optimized_sql", sql_query)
            index_recommendation = llm_result.get("index_suggestion", "")  # Note: 'index_suggestion' not 'index_recommendation'
            explanation = llm_result.get("explanation", "No explanation provided")
            
            # Ensure strings are actually strings
            if not isinstance(optimized_sql, str):
                logger.warning(f"[OPTIMIZE] optimized_sql is not a string: {type(optimized_sql)}")
                optimized_sql = str(optimized_sql)
            
            if not isinstance(index_recommendation, str):
                logger.warning(f"[OPTIMIZE] index_recommendation is not a string: {type(index_recommendation)}")
                if isinstance(index_recommendation, list):
                    # Join list items with newlines
                    index_recommendation = "\n".join(str(item) for item in index_recommendation)
                else:
                    index_recommendation = str(index_recommendation) if index_recommendation else ""
            
            if not isinstance(explanation, str):
                logger.warning(f"[OPTIMIZE] explanation is not a string: {type(explanation)}")
                explanation = str(explanation)
            
        except Exception as e:
            logger.error(f"[OPTIMIZE] LLM optimization failed: {str(e)}")
            # Fallback: Keep original query without LLM suggestions
            optimized_sql = sql_query
            index_recommendation = None
            explanation = f"Unable to generate optimization suggestions. Error: {str(e)}"
        
        # --- STEP 5: Build Response ---
        response = {
            "original_cost": original_cost,
            "bottlenecks": bottlenecks,
            "optimized_sql": optimized_sql.strip() if isinstance(optimized_sql, str) else str(optimized_sql).strip(),
            "index_recommendation": index_recommendation.strip() if isinstance(index_recommendation, str) and index_recommendation else None,
            "explanation": explanation.strip() if isinstance(explanation, str) else str(explanation).strip()
        }
        
        logger.info(f"[OPTIMIZE] Total analysis time: {time.time() - start_total:.2f}s")
        
        # --- STEP 6: Save Performance Analysis to DB (Only if query_log exists) ---
        if query_log:
            try:
                performance_analysis = PerformanceAnalysis(
                    query_log_id=query_log.id,
                    execution_time_ms=None,  # Could be calculated if needed
                    total_cost=original_cost,
                    explain_plan=explain_plan,
                    index_recommendation=response["index_recommendation"],
                    # Note: optimized_sql is saved in query_log.sql_generated if needed
                )
                db.add(performance_analysis)
                await db.commit()
                await db.refresh(performance_analysis)
                
                logger.info(f"[OPTIMIZE] Saved performance analysis {performance_analysis.id}")
                
                # Update query_log with optimized SQL
                query_log.sql_generated = response["optimized_sql"]
                await db.commit()
                
                # Add query_log_id to response
                response["query_log_id"] = str(query_log.id)
                
            except Exception as e:
                logger.error(f"[OPTIMIZE] Failed to save analysis to DB: {str(e)}")
                # Continue without saving - don't fail the request
        else:
            logger.info("[OPTIMIZE] Skipping DB save (no query_log)")
        
        logger.info("[OPTIMIZE] Analysis complete")
        return response


# Singleton instance
optimization_service = OptimizationService()
