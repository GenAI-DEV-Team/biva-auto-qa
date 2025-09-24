from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "autoqa",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"]
)

# Optional configuration, see the application user guide.
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.update(
    task_routes={
        "app.workers.tasks.*": {"queue": "autoqa"},
    },
)
