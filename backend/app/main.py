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
        return ["http://localhost:8080", "http://localhost:3000", "http://127.0.0.1:8080", "http://127.0.0.1:3000"]
    value = value.strip()
    if value == "*" or value == "":
        return ["http://localhost:8080", "http://localhost:3000", "http://127.0.0.1:8080", "http://127.0.0.1:3000"]
    return [v.strip() for v in value.split(",") if v.strip()]

allow_origins = parse_csv(settings.CORS_ALLOW_ORIGINS)
allow_methods = parse_csv(settings.CORS_ALLOW_METHODS)
allow_headers = parse_csv(settings.CORS_ALLOW_HEADERS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,  # Always allow credentials for auth
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "AI Agent Auto-QA System API", "version": settings.VERSION}

# Celery app is available for task management
app.celery_app = celery_app
