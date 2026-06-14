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

    # LLM Service mode: "ollama" (local) | "groq" (cloud) | "sqlcoderproxy" (HF proxy)
    LLM_SERVICE: str = "sqlcoderproxy"

    # Ollama settings (used when LLM_SERVICE=ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    MODEL_NAME: str = "qwen2.5:3b"
    MODEL_CHAT_NAME: str = "qwen2.5:3b"

    # Groq settings (used when LLM_SERVICE=groq)
    GROQ_API_KEY: str = ""
    GROQ_MODEL_NAME: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    GROQ_CHAT_MODEL_NAME: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    # SQLCoderProxy settings (used when LLM_SERVICE=sqlcoderproxy)
    # A LiteLLM proxy deployed on Hugging Face Spaces (OpenAI-compatible)
    SQLCODER_PROXY_URL: str = "https://whehehe04-sqlcoderproxy.hf.space/v1"
    SQLCODER_PROXY_API_KEY: str = "binproxy"
    SQLCODER_PROXY_MODEL_NAME: str = "sqlcoder"
    SQLCODER_PROXY_CHAT_MODEL_NAME: str = "sqlcoder"

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
    # Cache mode: False (default) = always fresh — no SQLAlchemy compiled-query cache,
    # no LRU schema cache. True = keep both caches for better throughput.
    ENABLE_QUERY_CACHE: bool = False

    SANDBOX_MAX_ROWS: int = 10000
    RESULT_MAX_ROWS: int = 100

    # Spider evaluation dataset directory
    SPIDER_DIR: str = "E:/spider/spider_data"
    # Admin evaluation output directory (relative to project root)
    ADMIN_EVAL_DIR: str = ""  # Auto-resolved to <PROJECT_ROOT>/evaluation/admin_eval

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
