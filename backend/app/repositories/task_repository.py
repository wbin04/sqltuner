from typing import List, Optional
from uuid import UUID

from app.models.models import BackgroundTask, TaskStatus, TaskType
from app.repositories.base import BaseRepository
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class TaskCreate(BaseModel):
    user_id: UUID
    task_type: TaskType
    payload: dict


class TaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    result: Optional[dict] = None
    error_message: Optional[str] = None


class BackgroundTaskRepository(
    BaseRepository[BackgroundTask, TaskCreate, TaskUpdate]
):
    def __init__(self):
        super().__init__(BackgroundTask)

    async def get_by_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        limit: int = 50
    ) -> List[BackgroundTask]:
        result = await db.execute(
            select(self.model)
            .where(self.model.user_id == user_id)
            .order_by(self.model.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update_status(
        self,
        db: AsyncSession,
        task_id: UUID,
        status: TaskStatus,
        result: Optional[dict] = None,
        error_message: Optional[str] = None
    ) -> Optional[BackgroundTask]:
        task = await self.get(db, task_id)
        if not task:
            return None

        task.status = status
        if result is not None:
            task.result = result
        if error_message is not None:
            task.error_message = error_message

        await db.commit()
        await db.refresh(task)
        return task


task_repository = BackgroundTaskRepository()
