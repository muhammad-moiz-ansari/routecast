from abc import ABC, abstractmethod
from uuid import UUID

from .models import TripCreateRequest, TripResponse


class TripRepo(ABC):
    @abstractmethod
    def create(self, owner_id: UUID, inputs: TripCreateRequest) -> TripResponse:
        """Create an owner-scoped trip and queue its initial assessment."""

    @abstractmethod
    def get(self, owner_id: UUID, trip_id: UUID) -> TripResponse:
        """Read an owned trip or raise a non-disclosing not-found error."""
