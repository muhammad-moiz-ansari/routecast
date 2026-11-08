from datetime import UTC, datetime
from types import SimpleNamespace

from django.db import transaction

from common.exceptions import InvalidDeparture
from config.refresh import REFRESH_SECONDS
from integrations.exceptions import ProviderError
from persistence.stores.analysis_store import LeaseLost
from services.checkpoint.models import CheckpointRequest
from services.routing.models import RouteOptions
from services.trip.models import TripCreateRequest, TripResponse
from services.weather.models import ForecastRequest

from .models import AnalysisProjection
from .planning_repo import PlanningRepo


class PlanningService(PlanningRepo):
    def __init__(
        self,
        store,
        trip_store,
        routing,
        checkpoint,
        weather,
        recommendation,
        locks,
        dispatch,
        clock=lambda: datetime.now(UTC),
        corridor_submit=lambda _: None,
    ):
        self.store, self.trip_store, self.routing, self.checkpoint = (
            store,
            trip_store,
            routing,
            checkpoint,
        )
        self.weather, self.recommendation, self.locks, self.dispatch = (
            weather,
            recommendation,
            locks,
            dispatch,
        )
        self.clock = clock
        self.corridor_submit = corridor_submit

    def deliver(self, run_id):
        """Dispatch a durable queued record; periodic recovery handles broker failures."""
        if self.store.reserve_delivery(run_id, self.clock()):
            try:
                self.dispatch(str(run_id))
            except Exception:
                # Do not serialize/log credential-bearing broker exception strings.
                pass

    def create(self, owner_id, inputs: TripCreateRequest) -> TripResponse:
        """Commit validated inputs and an analysis outbox record before dispatching Celery."""
        now = self.clock()
        if inputs.departure_at < now:
            raise InvalidDeparture()
        with transaction.atomic():
            trip = self.trip_store.create(owner_id, inputs, now=now)
            run, _, _ = self.store.request(owner_id, trip.id, now)
            transaction.on_commit(lambda: self.deliver(run.id))
        return self.trip_store.get(owner_id, trip.id)

    def execute(self, run_id):
        """Run staged service operations under renewable Redis and database fencing leases."""
        candidate = self.store.get_run(run_id)
        key = f"analysis:trip:{candidate.trip_id}"
        lock_token = self.locks.acquire(key)
        if not lock_token:
            return
        run = None
        try:
            run = self.store.claim(run_id, self.clock())
            if run is None:
                return

            def guard(stage="weather"):
                if not self.locks.renew(key, lock_token):
                    raise LeaseLost()
                self.store.guard(run.id, run.token, self.clock(), stage)

            guard("routing")
            inputs = TripCreateRequest.model_validate(run.inputs)
            previous = self.store.get_run(run_id).trip.current_analysis
            previous_data = (
                previous.payload if previous and previous.revision == run.revision else None
            )
            if run.working_routes:
                routes = RouteOptions.model_validate(run.working_routes)
            elif (
                previous_data
                and (
                    self.clock() - RouteOptions.model_validate(previous_data["routes"]).fetched_at
                ).total_seconds()
                < REFRESH_SECONDS
            ):
                routes = RouteOptions.model_validate(previous_data["routes"])
            else:
                routes = self.routing.options(inputs)
            routes.analysis_version = run.version
            guard("checkpoints")
            self.store.save_working_routes(run.id, run.token, routes.model_dump(mode="json"))
            checkpoints = [
                self.checkpoint.generate(
                    CheckpointRequest(
                        route=r,
                        departure_at=inputs.departure_at,
                        spacing_miles=inputs.checkpoint_spacing_miles,
                        analysis_version=run.version,
                    )
                )
                for r in routes.routes
            ]
            guard("weather")
            # Each batch renews leases and checks revision/activity before more provider I/O.
            self.weather.guard = guard
            weather = self.weather.assess(ForecastRequest(routes=checkpoints), fetch=True)
            guard("assessing")
            trip = TripResponse(
                **inputs.model_dump(),
                id=run.trip_id,
                created_at=run.created_at,
                status="assessing",
                route_options=routes,
                analysis_version=run.version,
            )
            # Rank exactly the fetched matches, not a second cache read that could race refresh.
            captured = SimpleNamespace(assess=lambda *args, **kwargs: weather)
            recommendation = self.recommendation(captured).recommend(trip)
            weather_times = [w.fetched_at for w in weather.checkpoints if w.fetched_at]
            payload = {
                "inputs": run.inputs,
                "routes": routes.model_dump(mode="json"),
                "checkpoints": {c.route_id: c.model_dump(mode="json") for c in checkpoints},
                "weather": weather.model_dump(mode="json"),
                "recommendation": recommendation.model_dump(mode="json"),
                "routing_fetched_at": routes.fetched_at.isoformat(),
                "weather_fetched_at": min(weather_times).isoformat() if weather_times else None,
            }
            guard("assessing")
            self.store.publish(run.id, run.token, self.clock(), payload)
            try:
                transaction.on_commit(lambda: self.corridor_submit(run.id))
            except Exception:
                # Ancillary dispatch must never roll back or fail the completed core result.
                pass
        except LeaseLost:
            pass
        except ProviderError as exc:
            if run:
                self.store.fail(
                    run.id,
                    run.token,
                    self.clock(),
                    exc.code,
                    exc.code
                    in (
                        "provider_timeout",
                        "provider_unavailable",
                        "provider_busy",
                        "provider_rate_limit",
                    ),
                    exc.retry_after_seconds or 60,
                )
        except Exception:
            if run:
                self.store.fail(run.id, run.token, self.clock(), "analysis_failed")
            raise
        finally:
            self.locks.release(key, lock_token)

    def read(self, owner_id, trip_id) -> AnalysisProjection:
        """Read a frozen complete snapshot with separate current freshness and job status."""
        trip = self.store.owned(owner_id, trip_id)
        latest = trip.analyses.order_by("-version").first()
        current = trip.current_analysis
        data = current.payload if current else None

        def stale(field):
            if current and current.revision != trip.input_revision:
                return True
            value = data.get(field) if data else None
            return (
                value is None
                or (self.clock() - datetime.fromisoformat(value)).total_seconds() >= REFRESH_SECONDS
            )

        return AnalysisProjection(
            trip_id=str(trip.id),
            input_revision=trip.input_revision,
            analysis_id=str(latest.id) if latest else None,
            analysis_version=current.version if current else None,
            analysis_revision=current.revision if current else None,
            status="stopped" if not trip.active else (latest.status if latest else trip.status),
            stage=latest.stage if latest else trip.status,
            stopped=not trip.active,
            error_code=latest.error_code if latest else trip.error_code,
            completed_at=current.completed_at if current else None,
            data=data,
            routing_stale=stale("routing_fetched_at"),
            weather_stale=stale("weather_fetched_at"),
            retained_previous=bool(current and latest and current.id != latest.id),
        )
