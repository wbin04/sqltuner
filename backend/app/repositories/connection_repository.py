from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import DBConnection, DBType
from backend.app.repositories.base import BaseRepository
from backend.app.schemas.connection import (DBConnectionCreate,
                                            DBConnectionUpdate)


class ConnectionRepository(
        BaseRepository[DBConnection, DBConnectionCreate, DBConnectionUpdate]):
    def __init__(self):
        super().__init__(DBConnection)

    async def get_by_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[DBConnection]:
        result = await db.execute(
            select(self.model)
            .where(self.model.user_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_user_and_id(
        self,
        db: AsyncSession,
        user_id: UUID,
        connection_id: UUID
    ) -> Optional[DBConnection]:
        result = await db.execute(
            select(self.model)
            .where(self.model.id == connection_id)
            .where(self.model.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_active_connections(
        self,
        db: AsyncSession,
        user_id: UUID,
        db_type: Optional[DBType] = None
    ) -> List[DBConnection]:
        query = select(self.model).where(self.model.user_id == user_id)

        if db_type:
            query = query.where(self.model.db_type == db_type)
        else:
            query = query.where(self.model.db_type != DBType.SIMULATION)

        result = await db.execute(query)
        return list(result.scalars().all())

    async def update_schema(
        self,
        db: AsyncSession,
        connection_id: UUID,
        meta_schema: dict
    ) -> Optional[DBConnection]:
        connection = await self.get(db, id=connection_id)

        if not connection:
            return None

        connection.meta_schema = meta_schema
        await db.commit()
        await db.refresh(connection)

        return connection

    async def delete_by_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        connection_id: UUID
    ) -> bool:
        connection = await self.get_by_user_and_id(db, user_id, connection_id)

        if not connection:
            return False

        await db.delete(connection)
        await db.commit()

        return True


connection_repository = ConnectionRepository()
