import redis.asyncio as redis
from app.core.config import settings

redis_client = redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=settings.REDIS_MAX_CONNECTIONS,
    health_check_interval=settings.REDIS_HEALTHCHECK_SEC,
    socket_timeout=settings.REDIS_SOCKET_TIMEOUT_SEC,
)

async def get_redis():
    return redis_client
