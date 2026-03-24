from typing import Any, Dict, List, Optional
from uuid import UUID

from app.models.models import ChatRole, QueryLog
from app.repositories.base import BaseRepository
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class QueryLogCreate(BaseModel):
    conversation_id: UUID
    role: ChatRole
    action_type: str = 'chat'
    content: str
    sql_generated: Optional[str] = None
    schema_generated: Optional[Dict[str, Any]] = None


class QueryLogUpdate(BaseModel):
    content: Optional[str] = None
    sql_generated: Optional[str] = None
    schema_generated: Optional[Dict[str, Any]] = None


class QueryLogRepository(
        BaseRepository[QueryLog, QueryLogCreate, QueryLogUpdate]):
    def __init__(self):
        super().__init__(QueryLog)

    async def get_by_conversation(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[QueryLog]:
        result = await db.execute(
            select(self.model)
            .where(self.model.conversation_id == conversation_id)
            .order_by(self.model.created_at)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_action_type(
        self,
        db: AsyncSession,
        conversation_id: UUID,
        action_type: str,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[QueryLog]:
        result = await db.execute(
            select(self.model)
            .where(self.model.conversation_id == conversation_id)
            .where(self.model.action_type == action_type)
            .order_by(self.model.created_at)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())


query_log_repository = QueryLogRepository()
