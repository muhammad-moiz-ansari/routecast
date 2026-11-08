"""Service contracts contain signatures only, never infrastructure access."""

from abc import ABC, abstractmethod

from .models import HealthStatus, ReadinessStatus


class HealthRepo(ABC):
    @abstractmethod
    def health(self) -> HealthStatus:
        """Return process liveness without checking dependencies."""

    @abstractmethod
    def readiness(self) -> ReadinessStatus:
        """Report database and cache availability without provider requests."""
