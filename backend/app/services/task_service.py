import json
import logging
from typing import Any, Callable, Dict
from uuid import UUID

from app.core.config import settings
from app.models.models import TaskType
from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)

if settings.ENVIRONMENT == "production":
    try:
        from google.cloud import tasks_v2
    except ImportError:
        logger.warning(
            "google-cloud-tasks chưa được cài đặt. "
            "Chỉ hỗ trợ local mode."
        )


class TaskService:
    def __init__(self):
        self.environment = settings.ENVIRONMENT
        if self.environment == "production":
            self.client = tasks_v2.CloudTasksClient()
            self.project = settings.GCP_PROJECT_ID
            self.location = settings.GCP_LOCATION
            self.queue_name = settings.CLOUD_TASKS_QUEUE
            self.service_account_email = settings.SERVICE_ACCOUNT_EMAIL

            self.parent = self.client.queue_path(
                self.project,
                self.location,
                self.queue_name
            )
        else:
            self.client = None

    async def enqueue_task(
        self,
        task_id: UUID,
        task_type: TaskType,
        payload: Dict[str, Any],
        background_tasks: BackgroundTasks = None,
        worker_function: Callable = None
    ):
        if self.environment == "local":
            logger.info(f"Local mode: Executing task {task_id} immediately")

            if background_tasks is None or worker_function is None:
                raise ValueError(
                    "Local mode requires both background_tasks "
                    "and worker_function"
                )

            background_tasks.add_task(
                worker_function,
                task_id=str(task_id),
                task_type=task_type.value,
                payload=payload
            )

        elif self.environment == "production":
            logger.info(
                f"Production mode: Enqueueing task {task_id} "
                "to Cloud Tasks"
            )

            await self._create_cloud_task(
                task_id=task_id,
                task_type=task_type,
                payload=payload
            )
        else:
            raise ValueError(f"Invalid ENVIRONMENT: {self.environment}")

    async def _create_cloud_task(
        self,
        task_id: UUID,
        task_type: TaskType,
        payload: Dict[str, Any]
    ):
        url = f"{settings.BACKEND_URL}/api/v1/internal/worker"

        task_payload = {
            "task_id": str(task_id),
            "task_type": task_type.value,
            "payload": payload
        }

        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": url,
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": json.dumps(task_payload).encode(),
                "oidc_token": {
                    "service_account_email": self.service_account_email
                }
            }
        }

        try:
            response = self.client.create_task(
                request={
                    "parent": self.parent,
                    "task": task
                }
            )
            logger.info(f"Cloud Task created: {response.name}")
            return response
        except Exception as e:
            logger.error(f"Failed to create Cloud Task: {str(e)}")
            raise


task_service = TaskService()
