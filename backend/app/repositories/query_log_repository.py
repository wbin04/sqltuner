"""
QueryLog Repository
Handles database operations for QueryLog model
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.repositories.base import BaseRepository
from backend.app.models.models import QueryLog, ChatRole
from pydantic import BaseModel


# Temporary schemas (you may want to create proper schemas in schemas/ folder)
class QueryLogCreate(BaseModel):
    conversation_id: UUID
    role: ChatRole
    action_type: str = 'chat'
    content: str
    sql_generated: Optional[str] = None


class QueryLogUpdate(BaseModel):
    content: Optional[str] = None
    sql_generated: Optional[str] = None


class QueryLogRepository(BaseRepository[QueryLog, QueryLogCreate, QueryLogUpdate]):
    """
    Repository for query log CRUD operations
    """
    
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
        """
        Get all query logs for a specific conversation
        
        Args:
            db: Async database session
            conversation_id: Conversation ID (UUID)
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of query logs ordered by creation time
        """
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
        """
        Get query logs filtered by action type
        
        Args:
            db: Async database session
            conversation_id: Conversation ID (UUID)
            action_type: Type of action (chat, explain, optimize)
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of query logs
        """
        result = await db.execute(
            select(self.model)
            .where(self.model.conversation_id == conversation_id)
            .where(self.model.action_type == action_type)
            .order_by(self.model.created_at)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())


# Singleton instance
query_log_repository = QueryLogRepository()
