from datetime import UTC, datetime
from uuid import UUID

from common.exceptions import InvalidDeparture, TripNotFound
from integrations.exceptions import ProviderError

from .models import TripCreateRequest, TripResponse
from .trip_repo import TripRepo


class TripService(TripRepo):
    def __init__(self, store, routing, clock=lambda: datetime.now(UTC)):
        self.store, self.routing, self.clock = store, routing, clock

    def create(self, owner_id: UUID, inputs: TripCreateRequest) -> TripResponse:
        """Route a new trip synchronously in Phase 1; background planning arrives in Phase 5."""
        if inputs.departure_at < self.clock():
            raise InvalidDeparture()
        trip = self.store.create(owner_id, inputs)
        try:
            options = self.routing.options(inputs)
        except ProviderError as exc:
            self.store.fail(trip.id, exc.code)
            exc.trip_id = str(trip.id)
            raise
        self.store.publish_routes(trip.id, options)
        return self.get(owner_id, trip.id)

    def get(self, owner_id: UUID, trip_id: UUID) -> TripResponse:
        """Retrieve stored data without issuing any provider requests."""
        trip = self.store.get(owner_id, trip_id)
        if trip is None:
            raise TripNotFound()
        return trip
