from datetime import datetime
from typing import List, Optional
from uuid import UUID

from app.api.v1.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.models import User
from app.services.history_service import history_service
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class WorkspaceInfo(BaseModel):
    id: str
    name: str
    db_type: str

    class Config:
        from_attributes = True


class HistoryLogResponse(BaseModel):
    id: str
    timestamp: datetime
    workspace: WorkspaceInfo
    activity_type: str
    action_type: Optional[str] = None
    user_prompt: Optional[str] = None
    sql_query: Optional[str] = None
    result_status: Optional[str] = None
    cost_reduction: Optional[float] = None
    execution_time_ms: Optional[float] = None

    class Config:
        from_attributes = True


class HistoryDetailResponse(BaseModel):
    id: str
    timestamp: datetime
    workspace: WorkspaceInfo
    activity_type: str
    user_prompt: Optional[str] = None
    sql_query: Optional[str] = None
    ai_response: Optional[str] = None
    result_status: Optional[str] = None
    execution_time_ms: Optional[float] = None
    total_cost: Optional[float] = None
    original_time_ms: Optional[float] = None    # MỚI
    optimized_time_ms: Optional[float] = None   # MỚI
    explain_plan: Optional[dict] = None
    index_recommendation: Optional[str] = None
    conversation_id: str

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[HistoryLogResponse]


@router.get("", response_model=HistoryListResponse)
async def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    workspace_id: Optional[UUID] = None,
    activity_type: Optional[str] = Query(
        None, regex="^(optimization|execution|chat)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    logs, total = await history_service.get_user_history(
        db=db,
        user_id=current_user.id,
        page=page,
        limit=limit,
        search=search,
        workspace_id=workspace_id,
        activity_type=activity_type
    )

    items = []
    for log in logs:
        workspace_info = WorkspaceInfo(
            id=str(log.conversation.connection.id),
            name=log.conversation.connection.name,
            db_type=log.conversation.connection.db_type.value
        )

        activity_type_determined = history_service.determine_activity_type(log)
        result_status = history_service.determine_result_status(log)

        user_prompt = log.content if log.role.value == "user" else None

        cost_reduction = None
        if log.performance_analysis and log.performance_analysis.total_cost:
            cost_reduction = log.performance_analysis.total_cost

        items.append(HistoryLogResponse(
            id=str(log.id),
            timestamp=log.created_at,
            workspace=workspace_info,
            activity_type=activity_type_determined,
            action_type=log.action_type,
            user_prompt=user_prompt,
            sql_query=log.sql_generated,
            result_status=result_status,
            cost_reduction=cost_reduction,
            execution_time_ms=(
                log.performance_analysis.execution_time_ms
                if log.performance_analysis else None
            )
        ))

    return HistoryListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items
    )


@router.get("/{log_id}", response_model=HistoryDetailResponse)
async def get_history_detail(
    log_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    log = await history_service.get_user_history_detail(
        db=db,
        user_id=current_user.id,
        log_id=log_id
    )

    if not log:
        raise HTTPException(
            status_code=404,
            detail="History log not found or access denied"
        )

    workspace_info = WorkspaceInfo(
        id=str(log.conversation.connection.id),
        name=log.conversation.connection.name,
        db_type=log.conversation.connection.db_type.value
    )

    activity_type_determined = history_service.determine_activity_type(log)
    result_status = history_service.determine_result_status(log)

    ai_response = await history_service.get_ai_response_for_log(db=db, log=log)

    return HistoryDetailResponse(
        id=str(log.id),
        timestamp=log.created_at,
        workspace=workspace_info,
        activity_type=activity_type_determined,
        user_prompt=log.content if log.role.value == "user" else None,
        sql_query=log.sql_generated,
        ai_response=ai_response,
        result_status=result_status,
        execution_time_ms=(
            log.performance_analysis.execution_time_ms
            if log.performance_analysis else None
        ),
        total_cost=(
            log.performance_analysis.total_cost
            if log.performance_analysis else None
        ),
        original_time_ms=(
            log.performance_analysis.original_time_ms
            if log.performance_analysis else None
        ),
        optimized_time_ms=(
            log.performance_analysis.optimized_time_ms
            if log.performance_analysis else None
        ),
        explain_plan=(
            log.performance_analysis.explain_plan
            if log.performance_analysis else None
        ),
        index_recommendation=(
            log.performance_analysis.index_recommendation
            if log.performance_analysis else None
        ),
        conversation_id=str(log.conversation_id)
    )
