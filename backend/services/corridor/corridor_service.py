from datetime import UTC, datetime, timedelta

from django.db import transaction

from integrations.exceptions import ProviderError
from persistence.stores.analysis_store import LeaseLost
from services.routing.models import RouteOptions

from .corridor_repo import CorridorRepo
from .geometry import make_grid
from .models import CorridorDataset, CorridorRequest


class CorridorService(CorridorRepo):
    def __init__(
        self,
        store,
        client,
        forecasts,
        cache,
        usage,
        locks,
        dispatch,
        clock=lambda: datetime.now(UTC),
        width_miles=10,
    ):
        self.store, self.client, self.forecasts, self.cache, self.usage = (
            store,
            client,
            forecasts,
            cache,
            usage,
        )
        self.locks, self.dispatch, self.clock = locks, dispatch, clock
        self.width_miles = width_miles

    def grid(self, request: CorridorRequest):
        """Sample the union of spherical route tubes, coarsening to the location budget."""
        return make_grid(request)

    def enqueue(self, analysis_id):
        """Create a fixed-anchor unique job after core commit; bounded delivery is recoverable."""
        job = self.store.ensure(
            analysis_id, self.clock().replace(minute=0, second=0, microsecond=0)
        )
        transaction.on_commit(lambda: self.deliver(job.id))

    def deliver(self, job_id):
        """Dispatch only due pending work; retain durable record on broker failure."""
        if self.store.delivery(job_id, self.clock()):
            try:
                self.dispatch(str(job_id))
            except Exception:
                pass

    def recover(self):
        """Recover pending broker deliveries without touching providers or core results."""
        for job_id in self.store.pending(self.clock()):
            self.deliver(job_id)

    def execute(self, job_id):
        """Generate 49 scalar frames independently; missing cells never become clear weather."""
        key = f"corridor:{job_id}"
        lock = self.locks.acquire(key)
        if not lock:
            return
        job = None
        try:
            job = self.store.claim(job_id, self.clock())
            if job is None:
                return

            def guard():
                if not self.locks.renew(key, lock):
                    raise LeaseLost()
                self.store.guard(job.id, job.token, self.clock())

            guard()
            routes = RouteOptions.model_validate(job.analysis.payload["routes"])
            grid = self.grid(CorridorRequest(routes=routes.routes, width_miles=self.width_miles))
            times = [job.anchor_at + timedelta(hours=i) for i in range(49)]
            series = [self.forecasts.get(s.coordinate) for s in grid.samples]
            missing = [
                i
                for i, s in enumerate(series)
                if s is None or (self.clock() - s.fetched_at).total_seconds() > 900
            ]
            notices = []
            for start in range(0, len(missing), 50):
                indices = missing[start : start + 50]
                guard()
                self.usage(len(indices))
                try:
                    batch = self.client.fetch([grid.samples[i].coordinate for i in indices])
                    guard()
                    for i, s in zip(indices, batch):
                        self.forecasts.set(s)
                        series[i] = s
                except ProviderError as exc:
                    notices.append(exc.code)
                    for i in indices:
                        series[i] = None
            names = ["wind_mph", "rain_inches_per_hour", "snow_inches_per_hour"]
            values = {name: [] for name in names}
            for s in series:
                by_time = {h.at: h for h in s.hours} if s else {}
                for name in names:
                    values[name].append(
                        [getattr(by_time[t], name) if t in by_time else None for t in times]
                    )
            masks = {
                name: [[v is None for v in row] for row in rows] for name, rows in values.items()
            }
            partial = not grid.samples or any(
                v for rows in masks.values() for row in rows for v in row
            )
            fetched = [s.fetched_at for s in series if s]
            data = CorridorDataset(
                dataset_id=str(job.id),
                analysis_version=job.analysis.version,
                anchor_at=job.anchor_at,
                fetched_at=min(fetched) if fetched else None,
                timestamps=times,
                grid=grid,
                values=values,
                missing=masks,
                units={
                    "wind_mph": "mph",
                    "rain_inches_per_hour": "in/hour",
                    "snow_inches_per_hour": "in/hour",
                },
                coverage="partial" if partial else "ready",
                notices=notices,
            ).model_dump(mode="json")
            guard()
            self.store.publish(job.id, job.token, self.clock(), data)
            self.cache.set(str(job.id), data)
        except LeaseLost:
            if job:
                self.store.fail(job.id, job.token, "invalidated")
        except Exception:
            if job:
                self.store.fail(job.id, job.token, "corridor_failed")
            raise
        finally:
            self.locks.release(key, lock)

    def read(self, owner_id, trip_id):
        """Read cached/database dataset for the current completed analysis; no fetch on GET."""
        trip, job = self.store.read(owner_id, trip_id)
        return {
            "status": job.status if job else "pending",
            "analysis_version": job.analysis.version if job else None,
            "error_code": job.error_code if job else None,
            "data": (self.cache.get(str(job.id)) or job.data) if job else None,
            "stopped": not trip.active,
            "stale": bool(
                job
                and job.data
                and (
                    job.analysis.revision != trip.input_revision
                    or not job.data.get("fetched_at")
                    or (
                        self.clock() - datetime.fromisoformat(job.data["fetched_at"])
                    ).total_seconds()
                    > 900
                )
            ),
        }
