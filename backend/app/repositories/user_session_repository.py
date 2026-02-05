from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import UserSession
from backend.app.repositories.base import BaseRepository


class UserSessionCreate(BaseModel):
    user_id: UUID
    refresh_token: str
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    expires_at: datetime
    is_revoked: bool = False


class UserSessionUpdate(BaseModel):
    is_revoked: Optional[bool] = None
    expires_at: Optional[datetime] = None


class UserSessionRepository(
    BaseRepository[UserSession, UserSessionCreate, UserSessionUpdate]
):
    def __init__(self):
        super().__init__(UserSession)

    async def get_by_refresh_token(
        self,
        db: AsyncSession,
        refresh_token: str
    ) -> Optional[UserSession]:
        result = await db.execute(
            select(self.model)
            .where(self.model.refresh_token == refresh_token)
        )
        return result.scalar_one_or_none()

    async def get_active_sessions(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> List[UserSession]:
        result = await db.execute(
            select(self.model)
            .where(self.model.user_id == user_id)
            .where(self.model.is_revoked is False)
        )
        return list(result.scalars().all())

    async def revoke_session(
        self,
        db: AsyncSession,
        session_id: UUID
    ) -> Optional[UserSession]:
        session = await self.get(db, session_id)
        if session:
            return await self.update(
                db,
                db_obj=session,
                obj_in={"is_revoked": True}
            )
        return None

    async def revoke_by_refresh_token(
        self,
        db: AsyncSession,
        refresh_token: str
    ) -> Optional[UserSession]:
        session = await self.get_by_refresh_token(db, refresh_token)
        if session:
            return await self.update(
                db,
                db_obj=session,
                obj_in={"is_revoked": True}
            )
        return None

    async def revoke_all_user_sessions(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> int:
        sessions = await self.get_active_sessions(db, user_id)
        count = 0
        for session in sessions:
            await self.update(
                db,
                db_obj=session,
                obj_in={"is_revoked": True}
            )
            count += 1
        return count


user_session_repository = UserSessionRepository()
