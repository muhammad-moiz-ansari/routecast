from datetime import timedelta
from uuid import uuid4

from django.db import transaction

from config.refresh import VIEWER_EXPIRY_SECONDS
from persistence.models import AnalysisRun, CorridorRun, Trip
from persistence.stores.analysis_store import AnalysisStore, LeaseLost


class CorridorStore:
    def ensure(self, analysis_id, anchor):
        """Persist a separate unique job; no change to the completed core snapshot."""
        return CorridorRun.objects.get_or_create(
            analysis_id=analysis_id, defaults={"anchor_at": anchor, "due_at": anchor}
        )[0]

    def claim(self, job_id, now):
        with transaction.atomic():
            job = (
                CorridorRun.objects.select_for_update()
                .select_related("analysis__trip")
                .get(pk=job_id)
            )
            if job.status != "pending":
                return None
            try:
                self.valid(job, now)
            except LeaseLost:
                job.status = "failed"
                job.error_code = "invalidated"
                job.save()
                return None
            job.status = "processing"
            job.token = uuid4()
            job.lease_until = now + timedelta(seconds=900)
            job.save()
            return job

    def valid(self, job, now):
        trip = Trip.objects.get(pk=job.analysis.trip_id)
        if (
            not trip.active
            or trip.current_analysis_id != job.analysis_id
            or trip.input_revision != job.analysis.revision
            or (now - trip.last_viewed_at).total_seconds() >= VIEWER_EXPIRY_SECONDS
        ):
            raise LeaseLost()

    def guard(self, job_id, token, now):
        with transaction.atomic():
            initial = CorridorRun.objects.select_related("analysis").get(pk=job_id)
            Trip.objects.select_for_update().get(pk=initial.analysis.trip_id)
            job = CorridorRun.objects.select_for_update().select_related("analysis").get(pk=job_id)
            if job.status != "processing" or job.token != token or job.lease_until <= now:
                raise LeaseLost()
            self.valid(job, now)
            job.lease_until = now + timedelta(seconds=900)
            job.save()

    def publish(self, job_id, token, now, data):
        with transaction.atomic():
            self.guard(job_id, token, now)
            CorridorRun.objects.filter(pk=job_id, token=token).update(
                status=data["coverage"], data=data
            )

    def fail(self, job_id, token, code):
        CorridorRun.objects.filter(pk=job_id, token=token, status="processing").update(
            status="failed", error_code=code
        )

    def pending(self, now):
        # Recover a missing ancillary outbox entry without touching completed core data.
        for analysis in AnalysisRun.objects.filter(
            status="complete",
            corridor__isnull=True,
            current_for__active=True,
            current_for__last_viewed_at__gt=now - timedelta(seconds=VIEWER_EXPIRY_SECONDS),
        ):
            self.ensure(analysis.id, now.replace(minute=0, second=0, microsecond=0))
        CorridorRun.objects.filter(status="processing", lease_until__lte=now).update(
            status="failed", error_code="lease_expired"
        )
        return list(
            CorridorRun.objects.filter(status="pending", due_at__lte=now).values_list(
                "id", flat=True
            )
        )

    def delivery(self, job_id, now):
        with transaction.atomic():
            job = CorridorRun.objects.select_for_update().get(pk=job_id)
            if job.status != "pending" or job.due_at > now:
                return False
            if job.deliveries >= 5:
                job.status = "failed"
                job.error_code = "delivery_exhausted"
                job.save()
                return False
            job.deliveries += 1
            job.due_at = now + timedelta(seconds=60)
            job.save()
            return True

    def read(self, owner, trip_id):
        trip = AnalysisStore().owned(owner, trip_id)
        job = (
            CorridorRun.objects.select_related("analysis")
            .filter(analysis_id=trip.current_analysis_id)
            .first()
        )
        return trip, job
