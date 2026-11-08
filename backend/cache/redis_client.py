from django.conf import settings
from redis import Redis
from redis.exceptions import RedisError


def cache_available() -> bool:
    """Ping the configured Redis cache with bounded connection and read timeouts."""
    try:
        with Redis.from_url(
            settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=2
        ) as client:
            return bool(client.ping())
    except (RedisError, ValueError):
        return False
