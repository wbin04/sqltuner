from fastapi import APIRouter, Depends, HTTPException

from app.core.config import settings
from app.db.session import get_db
from app.schemas.sql import DatabaseSchemaResponse
from app.services.inspector_service import inspector_service

router = APIRouter()


@router.get("/schema", response_model=DatabaseSchemaResponse)
async def get_database_schema(db=Depends(
        get_db) if settings.ENABLE_DATABASE else None):
    if not settings.ENABLE_DATABASE:
        raise HTTPException(status_code=503, detail="Database is disabled")

    try:
        schema = await inspector_service.get_database_schema(db)
        formatted_schema = inspector_service.format_schema_for_llm(schema)

        return DatabaseSchemaResponse(
            schema=schema,
            formatted_schema=formatted_schema
        )

    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Failed to get schema: {str(e)}")


@router.get("/tables/{table_name}")
async def get_table_info(
    table_name: str,
    db=Depends(get_db) if settings.ENABLE_DATABASE else None
):
    if not settings.ENABLE_DATABASE:
        raise HTTPException(status_code=503, detail="Database is disabled")

    try:
        table_info = await inspector_service.get_table_info(db, table_name)
        return table_info

    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Failed to get table info: {str(e)}")


@router.get("/tables/{table_name}/sample")
async def get_table_sample(
    table_name: str,
    limit: int = 5,
    db=Depends(get_db) if settings.ENABLE_DATABASE else None
):
    if not settings.ENABLE_DATABASE:
        raise HTTPException(status_code=503, detail="Database is disabled")

    try:
        sample = await (
            inspector_service.get_table_sample(db, table_name, limit)
        )
        return {"table": table_name, "rows": sample}

    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Failed to get sample: {str(e)}")
