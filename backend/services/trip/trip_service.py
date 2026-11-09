from uuid import UUID

from common.exceptions import TripNotFound

from .models import (
    SavedTripPage,
    SavedTripQuery,
    SavedTripSummary,
    SaveTripRequest,
    TripCreateRequest,
    TripResponse,
)
from .trip_repo import TripRepo


class TripService(TripRepo):
    def __init__(self, store, planning):
        self.store, self.planning = store, planning

    def create(self, owner_id: UUID, inputs: TripCreateRequest) -> TripResponse:
        """Queue initial analysis using the explicitly injected planning service."""
        return self.planning.create(owner_id, inputs)

    def get(self, owner_id: UUID, trip_id: UUID) -> TripResponse:
        """Retrieve stored data without issuing any provider requests."""
        trip = self.store.get(owner_id, trip_id)
        if trip is None:
            raise TripNotFound()
        return trip

    def save(self, owner_id: UUID, trip_id: UUID, payload: SaveTripRequest) -> SavedTripSummary:
        """Save existing data without scheduling provider work."""
        saved = self.store.save(owner_id, trip_id, payload)
        if saved is None:
            raise TripNotFound()
        return saved

    def list_saved(self, owner_id: UUID, query: SavedTripQuery) -> SavedTripPage:
        """Return only bookmarks belonging to the authenticated anonymous owner."""
        return self.store.list_saved(owner_id, query)
