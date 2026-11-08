from uuid import UUID

from common.exceptions import TripNotFound

from .models import TripCreateRequest, TripResponse
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
