from django.utils import timezone

from persistence.models import RouteSnapshot, Trip
from services.trip.models import TripResponse


class TripStore:
    def create(self, owner_id, inputs, now=None):
        """Persist validated inputs before the provider operation."""
        return Trip.objects.create(
            owner_id=owner_id,
            inputs=inputs.model_dump(mode="json"),
            last_viewed_at=now or timezone.now(),
        )

    def get(self, owner_id, trip_id):
        """Always scope by owner; an unguessable UUID is not authorization."""
        trip = Trip.objects.filter(owner_id=owner_id, pk=trip_id).first()
        if trip is None:
            return None
        snapshot = RouteSnapshot.objects.filter(trip=trip).first()
        latest = trip.analyses.order_by("-version").first()
        return TripResponse(
            **trip.inputs,
            id=trip.id,
            created_at=trip.created_at,
            status=trip.status,
            error_code=trip.error_code,
            input_revision=trip.input_revision,
            analysis_revision=trip.current_analysis.revision if trip.current_analysis else None,
            analysis_id=trip.analyses.order_by("-version").values_list("id", flat=True).first(),
            analysis_version=trip.current_analysis.version if trip.current_analysis else 0,
            route_options=snapshot.data
            if snapshot
            else (latest.working_routes if latest else None),
        )
