from typing import Optional

from app.models.models import AppConfig
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class ConfigRepository:
    async def get_config(
        self,
        db: AsyncSession,
        key: str
    ) -> Optional[str]:
        result = await db.execute(
            select(AppConfig).where(AppConfig.key == key)
        )
        config = result.scalar_one_or_none()
        return config.value if config else None

    async def set_config(
        self,
        db: AsyncSession,
        key: str,
        value: str
    ) -> AppConfig:
        result = await db.execute(
            select(AppConfig).where(AppConfig.key == key)
        )
        config = result.scalar_one_or_none()

        if config:
            config.value = value
        else:
            config = AppConfig(key=key, value=value)
            db.add(config)

        await db.commit()
        await db.refresh(config)
        return config


config_repository = ConfigRepository()
