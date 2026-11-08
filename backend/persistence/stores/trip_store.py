from django.db import transaction

from persistence.models import RouteSnapshot, Trip
from services.trip.models import TripResponse


class TripStore:
    def create(self, owner_id, inputs):
        """Persist validated inputs before the provider operation."""
        return Trip.objects.create(owner_id=owner_id, inputs=inputs.model_dump(mode="json"))

    def publish_routes(self, trip_id, options):
        """Publish the route snapshot and status together; no network inside the transaction."""
        with transaction.atomic():
            trip = Trip.objects.select_for_update().get(pk=trip_id)
            RouteSnapshot.objects.create(trip=trip, data=options.model_dump(mode="json"))
            trip.status = "routes_ready"
            trip.save(update_fields=["status"])

    def fail(self, trip_id, code):
        """Retain sanitized failure state without storing provider payloads or URLs."""
        Trip.objects.filter(pk=trip_id).update(status="routing_failed", error_code=code)

    def get(self, owner_id, trip_id):
        """Always scope by owner; an unguessable UUID is not authorization."""
        trip = Trip.objects.filter(owner_id=owner_id, pk=trip_id).first()
        if trip is None:
            return None
        snapshot = RouteSnapshot.objects.filter(trip=trip).first()
        return TripResponse(
            **trip.inputs,
            id=trip.id,
            created_at=trip.created_at,
            status=trip.status,
            error_code=trip.error_code,
            route_options=snapshot.data if snapshot else None,
        )
