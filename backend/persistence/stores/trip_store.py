from django.db import transaction
from django.utils import timezone

from persistence.models import RouteSnapshot, Trip
from services.trip.models import SavedTripPage, SavedTripSummary, TripResponse


class TripStore:
    @staticmethod
    def _saved_summary(trip):
        return SavedTripSummary(
            id=trip.id,
            title=trip.saved_title or "Untitled trip",
            saved_at=trip.saved_at,
            departure_at=trip.inputs["departure_at"],
            timezone=trip.inputs["timezone"],
            status=trip.status,
        )

    @transaction.atomic
    def save(self, owner_id, trip_id, payload):
        """Make saving idempotent and keep the original bookmark timestamp."""
        trip = Trip.objects.select_for_update().filter(owner_id=owner_id, pk=trip_id).first()
        if trip is None:
            return None
        trip.saved_at = trip.saved_at or timezone.now()
        trip.saved_title = trip.saved_title or payload.title or "Untitled trip"
        trip.save(update_fields=["saved_at", "saved_title"])
        return self._saved_summary(trip)

    def list_saved(self, owner_id, query):
        """Avoid loading analysis payloads when listing owner-scoped bookmarks."""
        rows = list(
            Trip.objects.filter(owner_id=owner_id, saved_at__isnull=False).order_by(
                "-saved_at", "-id"
            )[query.offset : query.offset + query.limit + 1]
        )
        return SavedTripPage(
            items=[self._saved_summary(trip) for trip in rows[: query.limit]],
            next_offset=query.offset + query.limit if len(rows) > query.limit else None,
        )

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
