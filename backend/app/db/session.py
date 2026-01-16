from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

# Create async engine only if database is enabled
if settings.ENABLE_DATABASE and settings.DATABASE_URL:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True,  # Set to False in production
        future=True,
        pool_pre_ping=True,
    )

    # Create async session maker
    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
else:
    # Dummy engine and session maker when database is disabled
    engine = None
    AsyncSessionLocal = None


async def get_db() -> AsyncSession:
    """
    Dependency for getting async database sessions
    Usage: db: AsyncSession = Depends(get_db)
    """
    if not settings.ENABLE_DATABASE or not AsyncSessionLocal:
        raise Exception("Database is disabled or not configured")
        
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
