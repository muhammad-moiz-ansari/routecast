from abc import ABC, abstractmethod
from uuid import UUID

from .models import (
    SavedTripPage,
    SavedTripQuery,
    SavedTripSummary,
    SaveTripRequest,
    TripCreateRequest,
    TripResponse,
)


class TripRepo(ABC):
    @abstractmethod
    def create(self, owner_id: UUID, inputs: TripCreateRequest) -> TripResponse:
        """Create an owner-scoped trip and queue its initial assessment."""

    @abstractmethod
    def get(self, owner_id: UUID, trip_id: UUID) -> TripResponse:
        """Read an owned trip or raise a non-disclosing not-found error."""

    @abstractmethod
    def save(self, owner_id: UUID, trip_id: UUID, payload: SaveTripRequest) -> SavedTripSummary:
        """Bookmark an owned trip without starting another assessment."""

    @abstractmethod
    def list_saved(self, owner_id: UUID, query: SavedTripQuery) -> SavedTripPage:
        """List a bounded page of the owner's bookmarks."""
