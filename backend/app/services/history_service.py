from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ChatRole, QueryLog
from app.repositories.history_repository import history_repository


class HistoryService:

    @staticmethod
    def determine_activity_type(log: QueryLog) -> str:
        if log.performance_analysis:
            return "optimization"
        elif log.sql_generated:
            return "execution"
        else:
            return "chat"

    @staticmethod
    def determine_result_status(log: QueryLog) -> Optional[str]:
        if log.performance_analysis:
            if log.performance_analysis.total_cost:
                return "optimized"
            return "success"
        elif log.sql_generated:
            return "success"
        return None

    async def get_user_history(
        self,
        db: AsyncSession,
        user_id: UUID,
        *,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        workspace_id: Optional[UUID] = None,
        activity_type: Optional[str] = None
    ) -> tuple[List[QueryLog], int]:
        logs, total = await history_repository.get_user_history_with_filters(
            db=db,
            user_id=user_id,
            page=page,
            limit=limit,
            search=search,
            workspace_id=workspace_id,
            activity_type=activity_type
        )

        return logs, total

    async def get_user_history_detail(
        self,
        db: AsyncSession,
        user_id: UUID,
        log_id: UUID
    ) -> Optional[QueryLog]:
        return await history_repository.get_user_history_detail(
            db=db,
            user_id=user_id,
            log_id=log_id
        )

    async def get_ai_response_for_log(
        self,
        db: AsyncSession,
        log: QueryLog
    ) -> Optional[str]:
        if log.role != ChatRole.USER:
            return None

        next_msg = await history_repository.get_next_assistant_message(
            db=db,
            conversation_id=log.conversation_id,
            after_timestamp=log.created_at
        )

        if next_msg:
            return next_msg.content

        return None


history_service = HistoryService()
