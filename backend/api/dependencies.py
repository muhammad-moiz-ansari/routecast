"""The explicit composition root: constructing dependencies performs no I/O."""

from cache.redis_client import cache_available
from persistence.stores.health_store import database_available
from services.health.health_repo import HealthRepo
from services.health.health_service import HealthService


def get_health_service() -> HealthRepo:
    """Wire infrastructure probes into the health service."""
    return HealthService(database_available, cache_available)
