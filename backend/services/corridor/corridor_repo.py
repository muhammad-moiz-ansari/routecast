from abc import ABC, abstractmethod

from .models import CorridorGrid, CorridorRequest


class CorridorRepo(ABC):
    @abstractmethod
    def grid(self, request: CorridorRequest) -> CorridorGrid:
        """Generate a bounded spherical corridor union grid without provider calls."""

    @abstractmethod
    def enqueue(self, analysis_id) -> None:
        """Queue corridor work independently after a core analysis has committed."""

    @abstractmethod
    def execute(self, job_id) -> None:
        """Build and publish a version-aligned cached dataset without changing core analysis."""

    @abstractmethod
    def recover(self) -> None:
        """Recover bounded pending deliveries/expired corridor workers."""

    @abstractmethod
    def read(self, owner_id, trip_id) -> dict:
        """Read an owned stored dataset only, never requesting providers."""
