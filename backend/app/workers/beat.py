from celery.schedules import crontab
from app.workers.celery_app import celery_app
from app.workers.tasks import health_check

# Load task modules
celery_app.autodiscover_tasks()

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Calls health_check() every 30 seconds
    sender.add_periodic_task(30.0, health_check.s(), name='health check every 30s')
