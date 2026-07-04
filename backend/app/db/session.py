from typing import AsyncGenerator

from app.core.config import settings
from sqlalchemy.ext.asyncio import (AsyncSession, async_sessionmaker,
                                    create_async_engine)

if settings.ENABLE_DATABASE and settings.SQLALCHEMY_DATABASE_URL:
    engine = create_async_engine(
        settings.SQLALCHEMY_DATABASE_URL,
        echo=True,
        future=True,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=10,
        # query_cache_size=0 disables SQLAlchemy compiled-statement cache so every
        # request always compiles a fresh query (no "[cached since Xs ago]" log).
        query_cache_size=500 if settings.ENABLE_QUERY_CACHE else 0,
    )

    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
else:
    engine = None
    AsyncSessionLocal = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if not settings.ENABLE_DATABASE or not AsyncSessionLocal:
        raise Exception("Database is disabled or not configured")

    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            try:
                await session.close()
            except Exception:
                pass
