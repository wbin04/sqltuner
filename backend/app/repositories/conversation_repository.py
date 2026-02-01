"""
Conversation Repository
Handles database operations for Conversation model
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.repositories.base import BaseRepository
from backend.app.models.models import Conversation
from pydantic import BaseModel


# Temporary schemas (you may want to create proper schemas in schemas/ folder)
class ConversationCreate(BaseModel):
    connection_id: Optional[UUID] = None
    title: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None


class ConversationRepository(BaseRepository[Conversation, ConversationCreate, ConversationUpdate]):
    """
    Repository for conversation CRUD operations
    """
    
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
        """
        Get all conversations for a specific connection
        
        Args:
            db: Async database session
            connection_id: Connection ID (UUID)
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of conversations
        """
        result = await db.execute(
            select(self.model)
            .where(self.model.connection_id == connection_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())


# Singleton instance
conversation_repository = ConversationRepository()
