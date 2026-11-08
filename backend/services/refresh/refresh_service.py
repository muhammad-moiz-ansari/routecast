from datetime import UTC, datetime

from django.db import transaction

from common.exceptions import InvalidDeparture

from .models import RefreshResult
from .refresh_repo import RefreshRepo


class RefreshService(RefreshRepo):
    def __init__(self, store, planning, clock=lambda: datetime.now(UTC), scheduling_enabled=True):
        self.store, self.planning, self.clock = store, planning, clock
        self.scheduling_enabled = scheduling_enabled

    def refresh(self, owner_id, trip_id) -> RefreshResult:
        """Coalesce manual requests and apply a cooldown without provider I/O."""
        with transaction.atomic():
            run, coalesced, retry = self.store.request(owner_id, trip_id, self.clock(), manual=True)
            if run and not coalesced:
                transaction.on_commit(lambda: self.planning.deliver(run.id))
        trip = self.store.owned(owner_id, trip_id)
        return RefreshResult(
            analysis_id=str(run.id) if run else None,
            coalesced=coalesced,
            retry_after_seconds=retry,
            stopped=not trip.active,
        )

    def update(self, owner_id, trip_id, inputs) -> RefreshResult:
        """Fence old revision results before committing replacement inputs and a queued run."""
        if inputs.departure_at < self.clock():
            raise InvalidDeparture()
        with transaction.atomic():
            run, coalesced, _ = self.store.request(owner_id, trip_id, self.clock(), inputs=inputs)
            if run:
                transaction.on_commit(lambda: self.planning.deliver(run.id))
        return RefreshResult(
            analysis_id=str(run.id) if run else None, coalesced=coalesced, stopped=run is None
        )

    def stop(self, owner_id, trip_id) -> RefreshResult:
        """Stop future jobs while retaining the last completed assessment."""
        self.store.stop(owner_id, trip_id)
        return RefreshResult(stopped=True)

    def heartbeat(self, owner_id, trip_id) -> None:
        """Record explicit owner activity; polling analysis alone is not a heartbeat."""
        self.store.heartbeat(owner_id, trip_id, self.clock())

    def tick(self) -> None:
        """Schedule eligible viewers and redeliver durable queued work, without providers."""
        if not self.scheduling_enabled:
            return
        now = self.clock()
        self.store.schedule(now)
        for run_id in self.store.dispatchable(now):
            self.planning.deliver(run_id)
