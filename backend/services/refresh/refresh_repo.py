from abc import ABC, abstractmethod
from uuid import UUID

from services.trip.models import TripCreateRequest

from .models import RefreshResult


class RefreshRepo(ABC):
    @abstractmethod
    def refresh(self, owner_id: UUID, trip_id: UUID) -> RefreshResult:
        """Request a coalesced owner-scoped analysis, respecting manual cooldown."""

    @abstractmethod
    def update(self, owner_id: UUID, trip_id: UUID, inputs: TripCreateRequest) -> RefreshResult:
        """Replace validated inputs and invalidate older jobs before queuing a new revision."""

    @abstractmethod
    def stop(self, owner_id: UUID, trip_id: UUID) -> RefreshResult:
        """Stop future work and fence out in-flight results without deleting completed data."""

    @abstractmethod
    def heartbeat(self, owner_id: UUID, trip_id: UUID) -> None:
        """Record explicit viewer activity without acquiring provider data."""

    @abstractmethod
    def tick(self) -> None:
        """Recover due queue deliveries and schedule only recently viewed active trips."""
