from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.core.config import settings
from backend.app.schemas.sql import (
    SQLOptimizeRequest,
    SQLOptimizeResponse,
    SQLExplainRequest,
    SQLExplainResponse,
)
from backend.app.services.llm_service import llm_service
from backend.app.services.inspector_service import inspector_service

router = APIRouter()


@router.post("/optimize", response_model=SQLOptimizeResponse)
async def optimize_sql(
    request: SQLOptimizeRequest,
    db = Depends(get_db) if settings.ENABLE_DATABASE else None
):
    """
    Optimize SQL query using LLM
    
    - **sql_query**: The SQL query to optimize
    - **include_schema**: Whether to include database schema in the optimization context
    """
    try:
        db_schema = None
        
        if request.include_schema and settings.ENABLE_DATABASE and db:
            # Get database schema
            schema = await inspector_service.get_database_schema(db)
            db_schema = inspector_service.format_schema_for_llm(schema)
        
        # Get optimized query and explanation from LLM
        result = await llm_service.optimize_sql(
            sql_query=request.sql_query,
            db_schema=db_schema
        )
        
        return SQLOptimizeResponse(
            original_query=request.sql_query,
            optimized_query=result["optimized_sql"],
            explanation=result["explanation"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.post("/explain", response_model=SQLExplainResponse)
async def explain_sql(request: SQLExplainRequest):
    """
    Get explanation of SQL query using LLM
    
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
