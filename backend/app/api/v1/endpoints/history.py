from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.v1.endpoints.auth import get_current_user
from backend.app.db.session import get_db
from backend.app.models.models import (ChatRole, Conversation, DBConnection,
                                       PerformanceAnalysis, QueryLog, User)

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


def determine_activity_type(log: QueryLog) -> str:
    if log.performance_analysis:
        return "optimization"
    elif log.sql_generated:
        return "execution"
    else:
        return "chat"


def determine_result_status(log: QueryLog) -> Optional[str]:
    if log.performance_analysis:
        if log.performance_analysis.total_cost:
            return "optimized"
        return "success"
    elif log.sql_generated:
        return "success"
    return None


@router.get("/", response_model=HistoryListResponse)
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

    query = (
        select(QueryLog) .join(
            Conversation,
            QueryLog.conversation_id == Conversation.id) .join(
            DBConnection,
            Conversation.connection_id == DBConnection.id) .outerjoin(
                PerformanceAnalysis,
                QueryLog.id == PerformanceAnalysis.query_log_id) .options(
                    selectinload(
                        QueryLog.conversation).selectinload(
                            Conversation.connection),
            selectinload(
                        QueryLog.performance_analysis)) .where(
            DBConnection.user_id == current_user.id))

    if search:
        search_filter = or_(
            QueryLog.content.ilike(f"%{search}%"),
            QueryLog.sql_generated.ilike(f"%{search}%")
        )
        query = query.where(search_filter)

    if workspace_id:
        query = query.where(Conversation.connection_id == workspace_id)

    if activity_type:
        if activity_type == "optimization":
            query = query.where(QueryLog.action_type == "optimize")
        elif activity_type == "execution":
            query = query.where(QueryLog.action_type == "explain")
        elif activity_type == "chat":
            query = query.where(QueryLog.action_type == "chat")

    count_query = select(QueryLog.id).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = len(total_result.all())

    query = query.order_by(desc(QueryLog.created_at))
    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    items = []
    for log in logs:
        workspace_info = WorkspaceInfo(
            id=str(log.conversation.connection.id),
            name=log.conversation.connection.name,
            db_type=log.conversation.connection.db_type.value
        )

        activity_type_determined = determine_activity_type(log)
        result_status = determine_result_status(log)

        user_prompt = log.content if log.role == ChatRole.USER else None

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

    query = (
        select(QueryLog) .join(
            Conversation,
            QueryLog.conversation_id == Conversation.id) .join(
            DBConnection,
            Conversation.connection_id == DBConnection.id) .outerjoin(
                PerformanceAnalysis,
                QueryLog.id == PerformanceAnalysis.query_log_id) .options(
                    selectinload(
                        QueryLog.conversation).selectinload(
                            Conversation.connection),
            selectinload(
                        QueryLog.performance_analysis)) .where(
            and_(
                QueryLog.id == log_id,
                DBConnection.user_id == current_user.id)))

    result = await db.execute(query)
    log = result.scalar_one_or_none()

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

    activity_type_determined = determine_activity_type(log)
    result_status = determine_result_status(log)

    ai_response = None
    if log.role == ChatRole.USER:
        next_msg_query = (
            select(QueryLog)
            .where(
                and_(
                    QueryLog.conversation_id == log.conversation_id,
                    QueryLog.created_at > log.created_at,
                    QueryLog.role == ChatRole.ASSISTANT
                )
            )
            .order_by(QueryLog.created_at)
            .limit(1)
        )
        next_result = await db.execute(next_msg_query)
        next_msg = next_result.scalar_one_or_none()
        if next_msg:
            ai_response = next_msg.content

    return HistoryDetailResponse(
        id=str(log.id),
        timestamp=log.created_at,
        workspace=workspace_info,
        activity_type=activity_type_determined,
        user_prompt=log.content if log.role == ChatRole.USER else None,
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
