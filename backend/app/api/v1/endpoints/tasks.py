import logging
from typing import Optional
from uuid import UUID

from app.api.v1.endpoints.auth import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.models import TaskStatus, TaskType, User
from app.repositories.task_repository import task_repository
from app.schemas.task import TaskResponse, WorkerPayload
from fastapi import APIRouter, Depends, Header, HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    task = await task_repository.get(db, task_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this task"
        )

    return task


async def verify_cloud_tasks_token(
    authorization: Optional[str] = Header(None)
) -> bool:
    if settings.ENVIRONMENT == "local":
        logger.info("Local mode: Skipping OIDC token verification")
        return True
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization scheme"
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format"
        )

    try:
        audience = settings.BACKEND_URL

        request = requests.Request()
        id_info = id_token.verify_oauth2_token(
            token, request, audience
        )

        email = id_info.get("email")
        if email != settings.SERVICE_ACCOUNT_EMAIL:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid service account"
            )

        logger.info(f"OIDC token verified for: {email}")
        return True

    except Exception as e:
        logger.error(f"OIDC verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid OIDC token: {str(e)}"
        )


@router.post("/internal/worker")
async def process_background_task(
    payload: WorkerPayload,
    db: AsyncSession = Depends(get_db),
    _verified: bool = Depends(verify_cloud_tasks_token)
):
    task_id = UUID(payload.task_id)
    task_type_str = payload.task_type
    task_data = payload.payload

    logger.info(f"Processing task {task_id} of type {task_type_str}")

    task = await task_repository.get(db, task_id)
    if not task:
        logger.error(f"Task {task_id} not found in database")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    await task_repository.update_status(
        db,
        task_id,
        TaskStatus.PROCESSING
    )

    try:
        if task_type_str == TaskType.LLM_OPTIMIZE.value:
            result = await execute_llm_optimize(task_data)
        elif task_type_str == TaskType.SQLITE_SANDBOX.value:
            result = await execute_sqlite_sandbox(task_data)
        elif task_type_str == TaskType.SCHEMA_SYNC.value:
            result = await execute_schema_sync(task_data)
        else:
            raise ValueError(f"Unknown task type: {task_type_str}")

        await task_repository.update_status(
            db,
            task_id,
            TaskStatus.SUCCESS,
            result=result
        )

        logger.info(f"Task {task_id} completed successfully")

    except Exception as e:
        error_message = f"{type(e).__name__}: {str(e)}"
        logger.error(f"Task {task_id} failed: {error_message}")

        await task_repository.update_status(
            db,
            task_id,
            TaskStatus.FAILED,
            error_message=error_message
        )

    return {"status": "processed", "task_id": str(task_id)}


async def execute_llm_optimize(data: dict) -> dict:
    logger.info(f"Executing LLM optimization with data: {data}")

    query = data.get("query", "")

    return {
        "optimized_query": query,
        "explanation": "Query optimization completed",
        "recommendations": []
    }


async def execute_sqlite_sandbox(data: dict) -> dict:
    logger.info(f"Executing SQLite sandbox with data: {data}")

    return {
        "execution_time_ms": 0,
        "rows_affected": 0,
        "result_set": []
    }


async def execute_schema_sync(data: dict) -> dict:
    logger.info(f"Executing schema sync with data: {data}")

    return {
        "tables_synced": 0,
        "schema": {}
    }
