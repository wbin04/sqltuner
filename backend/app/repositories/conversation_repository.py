from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import Conversation
from backend.app.repositories.base import BaseRepository


class ConversationCreate(BaseModel):
    connection_id: Optional[UUID] = None
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None


class ConversationRepository(
        BaseRepository[Conversation, ConversationCreate, ConversationUpdate]):
    def __init__(self):
        super().__init__(Conversation)

    async def get_by_connection(
        self,
        db: AsyncSession,
        connection_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[Conversation]:
        result = await db.execute(
            select(self.model)
            .where(self.model.connection_id == connection_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())


conversation_repository = ConversationRepository()
