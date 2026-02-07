from typing import Optional
from uuid import UUID

from app.models.models import User
from app.repositories.base import BaseRepository
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "user"
    is_active: bool = True


class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    def __init__(self):
        super().__init__(User)

    async def get_by_email(
        self,
        db: AsyncSession,
        email: str
    ) -> Optional[User]:
        result = await db.execute(
            select(self.model).where(self.model.email == email)
        )
        return result.scalar_one_or_none()

    async def get_active_user(
        self,
        db: AsyncSession,
        user_id: UUID
    ) -> Optional[User]:
        result = await db.execute(
            select(self.model)
            .where(self.model.id == user_id)
            .where(self.model.is_active is True)
        )
        return result.scalar_one_or_none()


user_repository = UserRepository()
