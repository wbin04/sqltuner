from typing import List, Optional, Tuple
from uuid import UUID

from app.models.models import (Conversation, DBConnection, PerformanceAnalysis,
                               QueryLog)
from app.repositories.base import BaseRepository
from app.repositories.query_log_repository import (QueryLogCreate,
                                                   QueryLogUpdate)
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


class HistoryRepository(
        BaseRepository[QueryLog, QueryLogCreate, QueryLogUpdate]):
    def __init__(self):
        super().__init__(QueryLog)

    async def get_user_history_with_filters(
        self,
        db: AsyncSession,
        user_id: UUID,
        *,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        workspace_id: Optional[UUID] = None,
        activity_type: Optional[str] = None
    ) -> Tuple[List[QueryLog], int]:
        query = (
            select(QueryLog)
            .join(Conversation, QueryLog.conversation_id == Conversation.id)
            .join(DBConnection, Conversation.connection_id == DBConnection.id)
            .outerjoin(
                PerformanceAnalysis,
                QueryLog.id == PerformanceAnalysis.query_log_id
            )
            .options(
                selectinload(QueryLog.conversation).selectinload(
                    Conversation.connection),
                selectinload(QueryLog.performance_analysis)
            )
            .where(DBConnection.user_id == user_id)
        )

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
        logs = list(result.scalars().all())

        return logs, total

    async def get_user_history_detail(
        self,
        db: AsyncSession,
        user_id: UUID,
        log_id: UUID
    ) -> Optional[QueryLog]:
        query = (
            select(QueryLog)
            .join(Conversation, QueryLog.conversation_id == Conversation.id)
            .join(DBConnection, Conversation.connection_id == DBConnection.id)
            .outerjoin(
                PerformanceAnalysis,
                QueryLog.id == PerformanceAnalysis.query_log_id
            )
            .options(
                selectinload(QueryLog.conversation).selectinload(
                    Conversation.connection),
                selectinload(QueryLog.performance_analysis)
            )
            .where(
                and_(
                    QueryLog.id == log_id,
                    DBConnection.user_id == user_id
                )
            )
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def get_next_assistant_message(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        after_timestamp
    ) -> Optional[QueryLog]:
        from app.models.models import ChatRole

        query = (
            select(QueryLog)
            .where(
                and_(
                    QueryLog.conversation_id == conversation_id,
                    QueryLog.created_at > after_timestamp,
                    QueryLog.role == ChatRole.ASSISTANT
                )
            )
            .order_by(QueryLog.created_at)
            .limit(1)
        )

        result = await db.execute(query)
        return result.scalar_one_or_none()


history_repository = HistoryRepository()
