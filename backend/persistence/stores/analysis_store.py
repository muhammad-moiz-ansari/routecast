from datetime import timedelta
from uuid import uuid4

from django.db import transaction

from common.exceptions import TripNotFound
from config.refresh import (
    LEASE_SECONDS,
    MANUAL_COOLDOWN_SECONDS,
    MAX_ATTEMPTS,
    REFRESH_SECONDS,
    VIEWER_EXPIRY_SECONDS,
)
from persistence.models import AnalysisRun, RouteSnapshot, Trip


class LeaseLost(Exception):
    """Job ownership or trip revision no longer permits provider work/publication."""


class AnalysisStore:
    def owned(self, owner, trip_id, lock=False):
        """Apply ownership in the query, including on all write operations."""
        query = Trip.objects.select_for_update() if lock else Trip.objects
        trip = query.filter(pk=trip_id, owner_id=owner).first()
        if trip is None:
            raise TripNotFound()
        return trip

    def enqueue_locked(self, trip, now):
        """Coalesce under the trip row lock; database uniqueness is a second guard."""
        run = trip.analyses.filter(status__in=["queued", "running"]).first()
        if run:
            return run, True
        trip.next_version += 1
        trip.status = "queued"
        trip.error_code = None
        trip.save(update_fields=["next_version", "status", "error_code"])
        return AnalysisRun.objects.create(
            trip=trip,
            revision=trip.input_revision,
            version=trip.next_version,
            inputs=trip.inputs,
            due_at=now,
            created_at=now,
            dispatch_after=now,
        ), False

    def request(self, owner, trip_id, now, manual=False, inputs=None):
        """Serialize refresh/revision requests; keep previous completed data visible."""
        with transaction.atomic():
            trip = self.owned(owner, trip_id, True)
            if not trip.active:
                return None, False, None
            if inputs is not None:
                trip.analyses.filter(status__in=["queued", "running"]).update(status="superseded")
                trip.inputs = inputs.model_dump(mode="json")
                trip.input_revision += 1
                trip.last_viewed_at = now
                trip.save(update_fields=["inputs", "input_revision", "last_viewed_at"])
            active = trip.analyses.filter(status__in=["queued", "running"]).first()
            if active:
                return active, True, None
            if manual and trip.last_manual_refresh:
                remaining = (
                    MANUAL_COOLDOWN_SECONDS - (now - trip.last_manual_refresh).total_seconds()
                )
                if remaining > 0:
                    return None, False, max(1, int(remaining + 0.999))
            if manual:
                trip.last_manual_refresh = now
                trip.last_viewed_at = now
                trip.save(update_fields=["last_manual_refresh", "last_viewed_at"])
            run, coalesced = self.enqueue_locked(trip, now)
            return run, coalesced, None

    def stop(self, owner, trip_id):
        """Cancel queued/running candidates while retaining the current completed pointer."""
        with transaction.atomic():
            trip = self.owned(owner, trip_id, True)
            trip.active = False
            trip.status = "stopped"
            trip.save(update_fields=["active", "status"])
            trip.analyses.filter(status__in=["queued", "running"]).update(status="cancelled")

    def heartbeat(self, owner, trip_id, now):
        """Activity cannot restart a stopped trip."""
        trip = self.owned(owner, trip_id)
        if trip.active:
            Trip.objects.filter(pk=trip.pk, active=True).update(last_viewed_at=now)

    def get_run(self, run_id):
        return AnalysisRun.objects.select_related("trip", "trip__current_analysis").get(pk=run_id)

    def claim(self, run_id, now):
        """Fence duplicate deliveries with a database token in addition to the Redis lock."""
        with transaction.atomic():
            candidate = AnalysisRun.objects.get(pk=run_id)
            trip = Trip.objects.select_for_update().get(pk=candidate.trip_id)
            run = AnalysisRun.objects.select_for_update().get(pk=run_id)
            if run.status != "queued" or run.due_at > now:
                return None
            if (
                not trip.active
                or trip.input_revision != run.revision
                or (now - trip.last_viewed_at).total_seconds() >= VIEWER_EXPIRY_SECONDS
            ):
                run.status = "cancelled"
                run.save(update_fields=["status"])
                return None
            run.token = uuid4()
            run.status = "running"
            run.stage = "routing"
            run.lease_until = now + timedelta(seconds=LEASE_SECONDS)
            run.attempts += 1
            run.save()
            return run

    def guard(self, run_id, token, now, stage):
        """Renew the database fence before every stage and weather batch."""
        with transaction.atomic():
            candidate = AnalysisRun.objects.get(pk=run_id)
            trip = Trip.objects.select_for_update().get(pk=candidate.trip_id)
            run = AnalysisRun.objects.select_for_update().get(pk=run_id)
            if (
                run.status != "running"
                or run.token != token
                or run.lease_until <= now
                or not trip.active
                or trip.input_revision != run.revision
                or (now - trip.last_viewed_at).total_seconds() >= VIEWER_EXPIRY_SECONDS
            ):
                raise LeaseLost()
            run.lease_until = now + timedelta(seconds=LEASE_SECONDS)
            run.stage = stage
            run.save()
            Trip.objects.filter(pk=trip.pk).update(status=stage)

    def publish(self, run_id, token, now, payload):
        """Atomically store the candidate before advancing the trip's current pointer."""
        with transaction.atomic():
            self.guard(run_id, token, now, "assessing")
            run = AnalysisRun.objects.get(pk=run_id)
            run.payload = payload
            run.status = "complete"
            run.stage = "complete"
            run.completed_at = now
            run.error_code = None
            run.save()
            RouteSnapshot.objects.update_or_create(
                trip_id=run.trip_id,
                defaults={"analysis_version": run.version, "data": payload["routes"]},
            )
            Trip.objects.filter(pk=run.trip_id).update(
                current_analysis=run, status="complete", error_code=None
            )

    def fail(self, run_id, token, now, code, retry=False, retry_after=60):
        """Bound transient attempts and preserve the prior completed analysis on failure."""
        with transaction.atomic():
            candidate = AnalysisRun.objects.get(pk=run_id)
            trip = Trip.objects.select_for_update().get(pk=candidate.trip_id)
            run = AnalysisRun.objects.select_for_update().get(pk=run_id)
            if run.status != "running" or run.token != token:
                return
            retry = (
                retry
                and run.attempts < MAX_ATTEMPTS
                and trip.active
                and trip.input_revision == run.revision
            )
            run.status = "queued" if retry else "failed"
            run.error_code = code
            run.due_at = now + timedelta(seconds=max(60, retry_after))
            run.save()
            Trip.objects.filter(pk=trip.pk).update(status=run.status, error_code=code)

    def dispatchable(self, now):
        """Recover expired leases; bound redelivery and respect viewer activity."""
        for run in AnalysisRun.objects.filter(status="running", lease_until__lte=now):
            self.fail(run.id, run.token, now, "lease_expired", True)
        return list(
            AnalysisRun.objects.filter(
                status="queued",
                due_at__lte=now,
                dispatch_after__lte=now,
                trip__active=True,
                trip__last_viewed_at__gt=now - timedelta(seconds=VIEWER_EXPIRY_SECONDS),
            ).values_list("id", flat=True)
        )

    def reserve_delivery(self, run_id, now):
        """Throttle broker redelivery separately from actual provider job attempts."""
        with transaction.atomic():
            candidate = AnalysisRun.objects.get(pk=run_id)
            Trip.objects.select_for_update().get(pk=candidate.trip_id)
            run = AnalysisRun.objects.select_for_update().get(pk=run_id)
            if run.status != "queued" or run.due_at > now or run.dispatch_after > now:
                return False
            if run.dispatch_attempts >= 5:
                run.status = "failed"
                run.error_code = "delivery_exhausted"
                run.save()
                Trip.objects.filter(pk=run.trip_id).update(
                    status="failed", error_code=run.error_code
                )
                return False
            run.dispatch_attempts += 1
            run.dispatch_after = now + timedelta(seconds=60)
            run.save()
            return True

    def schedule(self, now):
        """Schedule reassessment only for active, recently viewed trips at most every 15 minutes."""
        for trip in Trip.objects.filter(
            active=True, last_viewed_at__gt=now - timedelta(seconds=VIEWER_EXPIRY_SECONDS)
        ):
            latest = trip.analyses.order_by("-version").first()
            if latest and latest.status in ("queued", "running"):
                continue
            if latest and latest.error_code in (
                "provider_authentication",
                "provider_invalid_request",
                "provider_not_configured",
                "provider_budget_exhausted",
                "provider_budget_unavailable",
            ):
                # Configuration, input and budget failures need owner action, not periodic retries.
                continue
            when = latest.created_at if latest else trip.created_at
            if (now - when).total_seconds() >= REFRESH_SECONDS:
                self.request(trip.owner_id, trip.id, now)

    def save_working_routes(self, run_id, token, data):
        """Retain candidate routing across bounded transient weather retries."""
        if not AnalysisRun.objects.filter(pk=run_id, token=token, status="running").update(
            working_routes=data
        ):
            raise LeaseLost()
