from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.db import create_tables
from app.api.v1 import api_router
from app.workers.celery_app import celery_app

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_tables()
    yield
    # Shutdown
    # Add graceful shutdown hooks here if needed

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI Agent Auto-QA System API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Set up CORS using settings
def parse_csv(value: str | None) -> list[str] | str:
    if value is None:
        return "*"
    value = value.strip()
    if value == "*" or value == "":
        return "*"
    return [v.strip() for v in value.split(",") if v.strip()]

allow_origins = parse_csv(settings.CORS_ALLOW_ORIGINS)
allow_methods = parse_csv(settings.CORS_ALLOW_METHODS)
allow_headers = parse_csv(settings.CORS_ALLOW_HEADERS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins if isinstance(allow_origins, list) else ["*"],
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=allow_methods if isinstance(allow_methods, list) else ["*"],
    allow_headers=allow_headers if isinstance(allow_headers, list) else ["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "AI Agent Auto-QA System API", "version": settings.VERSION}

# Celery app is available for task management
app.celery_app = celery_app
