from collections.abc import Callable

from .health_repo import HealthRepo
from .models import HealthStatus, ReadinessStatus


class HealthService(HealthRepo):
    def __init__(self, database_probe: Callable[[], bool], cache_probe: Callable[[], bool]):
        self._database_probe = database_probe
        self._cache_probe = cache_probe

    def health(self) -> HealthStatus:
        """Confirm that the application can respond without touching infrastructure."""
        return HealthStatus()

    def readiness(self) -> ReadinessStatus:
        """Check both dependencies, including when the first is unavailable."""
        database = self._database_probe()
        cache = self._cache_probe()
        return ReadinessStatus(
            status="ready" if database and cache else "unavailable",
            database=database,
            cache=cache,
        )
