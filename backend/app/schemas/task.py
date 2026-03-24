from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from app.models.models import TaskStatus, TaskType
from pydantic import BaseModel


class TaskResponse(BaseModel):
    id: UUID
    user_id: UUID
    task_type: TaskType
    status: TaskStatus
    payload: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskCreateRequest(BaseModel):
    task_type: TaskType
    payload: Dict[str, Any]


class TaskListResponse(BaseModel):
    tasks: list[TaskResponse]
    total: int


class WorkerPayload(BaseModel):
    task_id: str
    task_type: str
    payload: Dict[str, Any]
