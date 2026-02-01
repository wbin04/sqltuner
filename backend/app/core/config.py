from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "SQLTuner"
    
    # PostgreSQL Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "sqltuner"
    DATABASE_URL: Optional[str] = None
    
    # Ollama LLM Settings
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    MODEL_NAME: str = "qwen2.5:3b"  # For SQL generation and optimization
    MODEL_CHAT_NAME: str = "qwen2.5:3b"  # For SQL explanation (same model to avoid double calls)
    
    # CORS Settings
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    
    # Encryption key for database passwords
    ENCRYPTION_KEY: Optional[str] = None
    
    # JWT Settings
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database connection flag
    ENABLE_DATABASE: bool = True
    
    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        """Construct PostgreSQL async connection URL"""
        if not self.ENABLE_DATABASE:
            return ""
        # Use explicit DATABASE_URL if provided, otherwise construct from components
        db_url = self.DATABASE_URL
        if db_url and db_url.strip():
            # Convert postgresql:// to postgresql+asyncpg://
            if db_url.startswith('postgresql://'):
                return db_url.replace('postgresql://', 'postgresql+asyncpg://', 1)
            return db_url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
