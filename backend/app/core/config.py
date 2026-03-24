import re
from typing import List, Optional, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "SQLTuner"

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "sqltuner"
    DATABASE_URL: Optional[str] = None

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    MODEL_NAME: str = "qwen2.5:3b"
    MODEL_CHAT_NAME: str = "qwen2.5:3b"

    BACKEND_CORS_ORIGINS: Union[str, List[str]] = "http://localhost:5173"

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip()
                    for origin in v.split(",") if origin.strip()]
        return v

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:5173/workspaces"

    ENCRYPTION_KEY: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cookie settings
    COOKIE_SECURE: bool = False  # Set True in production with HTTPS
    COOKIE_SAMESITE: str = "Lax"
    COOKIE_HTTPONLY: bool = True
    COOKIE_PATH: str = "/"
    COOKIE_ACCESS_TOKEN_NAME: str = "access_token"
    COOKIE_REFRESH_TOKEN_NAME: str = "refresh_token"

    ENABLE_DATABASE: bool = True

    SANDBOX_MAX_ROWS: int = 10000
    RESULT_MAX_ROWS: int = 100

    # Cloud Tasks Configuration
    ENVIRONMENT: str = "local"  # "local" hoặc "production"
    GCP_PROJECT_ID: Optional[str] = None
    GCP_LOCATION: str = "asia-southeast1"
    CLOUD_TASKS_QUEUE: str = "sqltuner-queue"
    BACKEND_URL: Optional[str] = None  # URL của Cloud Run service
    # Service account để invoke Cloud Run
    SERVICE_ACCOUNT_EMAIL: Optional[str] = None

    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        if not self.ENABLE_DATABASE:
            return ""
        db_url = self.DATABASE_URL
        if db_url and db_url.strip():
            if db_url.startswith('postgresql://'):
                db_url = db_url.replace(
                    'postgresql://', 'postgresql+asyncpg://', 1
                )
                db_url = re.sub(r'[?&]sslmode=[^&]*', '', db_url)
                db_url = re.sub(r'[?&]$', '', db_url)
                return db_url
            return db_url
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}"
            f":{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}"
            f"/{self.POSTGRES_DB}"
        )

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
