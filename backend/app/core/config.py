from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Agent Auto-QA System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Database
    DATABASE_URL: str
    DATABASE_READ_URL: Optional[str] = None

    # Redis
    REDIS_URL: str

    # OpenAI
    OPENAI_API_KEY: str

    # Langfuse
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # CORS
    CORS_ALLOW_ORIGINS: str | None = None  # comma-separated
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: str = "*"  # comma-separated or '*'
    CORS_ALLOW_HEADERS: str = "*"  # comma-separated or '*'

    # Pydantic configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )

    # Database pool tuning
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE_SEC: int = 1800  # 30 minutes
    DB_POOL_TIMEOUT_SEC: int = 30
    PG_STATEMENT_TIMEOUT_MS: int = 30000  # 30s

    # Redis pool tuning
    REDIS_MAX_CONNECTIONS: int = 50
    REDIS_HEALTHCHECK_SEC: int = 30
    REDIS_SOCKET_TIMEOUT_SEC: int = 5

settings = Settings()
