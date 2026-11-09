"""Lifecycle acceptance with a fake clock, fake broker/locks and offline provider fixtures."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import IntegrityError, transaction
from django.test import Client

from integrations.exceptions import ProviderError
from integrations.tomtom.routing_client import TomTomRoutingClient
from persistence.models import AnalysisRun, RouteSnapshot, Trip
from persistence.stores.analysis_store import AnalysisStore, LeaseLost
from persistence.stores.trip_store import TripStore
from services.checkpoint.checkpoint_service import CheckpointService
from services.planning.planning_service import PlanningService
from services.recommendation.recommendation_service import RecommendationService
from services.refresh.refresh_service import RefreshService
from services.risk.risk_service import RiskService
from services.routing.routing_service import RoutingService
from services.trip.models import TripCreateRequest
from services.weather.models import CheckpointWeather, WeatherResult
from tests.test_phase1 import INPUTS, fixture, wire


class Clock:
    def __init__(self):
        self.now = datetime(2099, 11, 8, 10, tzinfo=UTC)

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)


class Locks:
    def __init__(self, clock):
        self.clock = clock
        self.items = {}

    def acquire(self, key):
        item = self.items.get(key)
        if item and item[1] > self.clock():
            return None
        token = str(uuid4())
        self.items[key] = (token, self.clock() + timedelta(seconds=900))
        return token

    def renew(self, key, token):
        item = self.items.get(key)
        if not item or item[0] != token or item[1] <= self.clock():
            return False
        self.items[key] = (token, self.clock() + timedelta(seconds=900))
        return True

    def release(self, key, token):
        if self.items.get(key, (None,))[0] == token:
            self.items.pop(key)


class Weather:
    def guard(self):
        pass

    def __init__(self, clock):
        self.clock = clock
        self.calls = 0
        self.failure = None

    def assess(self, request, fetch=False):
        if fetch:
            self.guard()
            self.calls += 1
            if self.failure:
                raise self.failure
        return WeatherResult(
            analysis_versions={r.route_id: r.analysis_version for r in request.routes},
            checkpoints=[
                CheckpointWeather(
                    route_id=r.route_id,
                    checkpoint_id=c.id,
                    arrival_at=c.arrival_at,
                    fetched_at=self.clock(),
                    wind_mph=0,
                    rain_inches_per_hour=0,
                    snow_inches_per_hour=0,
                    coverage="complete",
                    freshness="fresh",
                )
                for r in request.routes
                for c in r.checkpoints
            ],
            provider_requests=int(fetch),
            unique_locations_requested=0,
            estimated_usage_units=0,
        )


@pytest.fixture
def system():
    clock = Clock()
    store = AnalysisStore()
    calls = []
    sent = []
    locks = Locks(clock)
    routing = RoutingService(TomTomRoutingClient(wire(fixture("routes"), calls)), clock)
    cp = CheckpointService()
    weather = Weather(clock)
    planning = PlanningService(
        store,
        TripStore(),
        routing,
        cp,
        weather,
        lambda w: RecommendationService(cp, w, RiskService()),
        locks,
        sent.append,
        clock,
    )
    refresh = RefreshService(store, planning, clock)
    return planning, refresh, store, clock, calls, sent, weather, locks


def create(system):
    planning, _, _, _, _, _, _, _ = system
    owner = uuid4()
    trip = planning.create(owner, TripCreateRequest.model_validate(INPUTS))
    return owner, trip


@pytest.mark.django_db(transaction=True)
def test_queue_atomic_publication_duplicate_and_frozen_reads(system):
    p, r, s, clock, calls, sent, w, locks = system
    owner, trip = create(system)
    assert trip.status == "queued" and not calls and len(sent) == 1
    run = AnalysisRun.objects.get(pk=trip.analysis_id)
    p.execute(run.id)
    assert len(calls) == 1 and w.calls == 1
    result = p.read(owner, trip.id)
    assert result.status == "complete" and result.data["recommendation"]["state"] == "RECOMMENDED"
    assert result.data["routes"]["analysis_version"] == result.analysis_version
    assert all(
        v["analysis_version"] == result.analysis_version
        for v in result.data["checkpoints"].values()
    )
    p.execute(run.id)
    assert len(calls) == 1 and w.calls == 1
    assert p.read(owner, trip.id).data == result.data
    clock.advance(901)
    stale = p.read(owner, trip.id)
    assert stale.routing_stale and stale.weather_stale and stale.data == result.data


@pytest.mark.django_db(transaction=True)
def test_coalescing_cooldown_and_failed_refresh_retains_current(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    assert r.refresh(owner, trip.id).coalesced
    p.execute(trip.analysis_id)
    original = p.read(owner, trip.id).data
    refresh = r.refresh(owner, trip.id)
    assert not refresh.coalesced
    assert r.refresh(owner, trip.id).coalesced
    w.failure = ProviderError("provider_authentication", "Rejected")
    p.execute(refresh.analysis_id)
    assert len(calls) == 1  # A fresh current route is reused, not fetched again.
    retained = p.read(owner, trip.id)
    assert retained.data == original and retained.retained_previous and retained.status == "failed"
    assert r.refresh(owner, trip.id).retry_after_seconds == 60
    assert AnalysisRun.objects.get(pk=refresh.analysis_id).attempts == 1


@pytest.mark.django_db(transaction=True)
def test_revision_change_fences_old_job(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    real = p.routing.options

    def replace(inputs):
        result = real(inputs)
        r.update(
            owner, trip.id, TripCreateRequest.model_validate({**INPUTS, "cargo_load_lb": 1000})
        )
        return result

    p.routing.options = replace
    p.execute(trip.analysis_id)
    assert Trip.objects.get(pk=trip.id).current_analysis_id is None
    assert AnalysisRun.objects.get(pk=trip.analysis_id).status == "superseded"
    p.routing.options = real
    newer = AnalysisRun.objects.filter(trip_id=trip.id, status="queued").get()
    p.execute(newer.id)
    assert p.read(owner, trip.id).analysis_revision == 2


@pytest.mark.django_db(transaction=True)
def test_stop_fences_inflight_and_future_work(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    real = p.routing.options

    def stop(inputs):
        result = real(inputs)
        r.stop(owner, trip.id)
        return result

    p.routing.options = stop
    p.execute(trip.analysis_id)
    assert not RouteSnapshot.objects.filter(trip_id=trip.id).exists()
    clock.advance(1000)
    r.tick()
    assert r.refresh(owner, trip.id).stopped and w.calls == 0
    assert len(sent) == 1


@pytest.mark.django_db(transaction=True)
def test_inactivity_and_heartbeat_scheduler(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    clock.advance(1801)
    r.tick()
    assert AnalysisRun.objects.filter(trip_id=trip.id).count() == 1
    r.heartbeat(owner, trip.id)
    r.tick()
    assert AnalysisRun.objects.filter(trip_id=trip.id).count() == 2
    p.execute(AnalysisRun.objects.get(trip_id=trip.id, status="queued").id)
    assert len(calls) == 2


@pytest.mark.django_db(transaction=True)
def test_bounded_transient_retry_reuses_candidate_routes(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    w.failure = ProviderError("provider_timeout", "Timeout", 504)
    for _ in range(3):
        p.execute(trip.analysis_id)
        clock.advance(61)
        r.tick()
    run = AnalysisRun.objects.get(pk=trip.analysis_id)
    assert run.status == "failed" and run.attempts == 3 and len(calls) == 1
    assert Trip.objects.get(pk=trip.id).current_analysis_id is None


@pytest.mark.django_db(transaction=True)
def test_lease_expiry_fences_token_and_database_constraint(system):
    p, r, s, clock, calls, sent, w, locks = system
    owner, trip = create(system)
    run = s.claim(trip.analysis_id, clock())
    assert s.claim(run.id, clock()) is None
    with pytest.raises(IntegrityError), transaction.atomic():
        AnalysisRun.objects.create(trip_id=trip.id, version=99, revision=1, inputs=INPUTS)
    clock.advance(901)
    with pytest.raises(LeaseLost):
        s.publish(run.id, run.token, clock(), {})
    s.dispatchable(clock())
    clock.advance(61)
    newer = s.claim(run.id, clock())
    assert newer.token != run.token
    with pytest.raises(LeaseLost):
        s.guard(run.id, run.token, clock(), "weather")


@pytest.mark.django_db(transaction=True)
def test_delivery_failure_recovery_is_bounded(system):
    p, r, s, clock, calls, sent, w, _ = system

    def unavailable(run_id):
        raise RuntimeError("broker credentials")

    p.dispatch = unavailable
    owner, trip = create(system)
    for _ in range(6):
        clock.advance(61)
        r.tick()
    run = AnalysisRun.objects.get(pk=trip.analysis_id)
    assert run.status == "failed" and run.error_code == "delivery_exhausted" and not calls


@pytest.mark.django_db(transaction=True)
def test_api_queue_polling_etag_csrf_and_ownership(system):
    p, r, s, clock, calls, sent, w, _ = system
    c = Client(enforce_csrf_checks=True)
    token = c.get("/api/v1/session/").json()["csrf_token"]
    from services.trip.trip_service import TripService

    service = TripService(TripStore(), planning=p)
    with (
        patch("api.routes.trip_routes.get_trip_service", return_value=service),
        patch("api.routes.analysis_routes.get_planning_service", return_value=p),
        patch("api.routes.analysis_routes.get_refresh_service", return_value=r),
    ):
        assert c.post("/api/v1/trips/", INPUTS, content_type="application/json").status_code == 403
        response = c.post(
            "/api/v1/trips/", INPUTS, content_type="application/json", HTTP_X_CSRFTOKEN=token
        )
        assert response.status_code == 202, response.content
        trip = response.json()
        url = f"/api/v1/trips/{trip['id']}/analysis/"
        first = c.get(url)
        assert first.status_code == 200 and not calls
        assert c.get(url, HTTP_IF_NONE_MATCH=first["ETag"]).status_code == 304
        other = Client()
        other.get("/api/v1/session/")
        assert other.get(url).status_code == 404
        p.execute(trip["analysis_id"])
        published = c.get(url)
        assert published["ETag"] != first["ETag"]
        before = len(calls)
        for _ in range(3):
            c.get(url)
        assert len(calls) == before
        base = url.removesuffix("analysis/")
        assert c.post(base + "heartbeat/").status_code == 403
        assert c.post(base + "heartbeat/", HTTP_X_CSRFTOKEN=token).status_code == 200
        with (
            patch("api.routes.recommendation_routes.get_planning_service", return_value=p),
            patch("api.routes.weather_routes.get_planning_service", return_value=p),
            patch("api.routes.checkpoint_routes.get_planning_service", return_value=p),
        ):
            assert (
                c.get(base + "recommendation/").json() == published.json()["data"]["recommendation"]
            )
            assert c.get(base + "weather/").json() == published.json()["data"]["weather"]
            assert c.get(base + "checkpoints/", {"route_id": "A"}).status_code == 200
        assert c.post(base + "stop/", HTTP_X_CSRFTOKEN=token).status_code == 200
        assert c.post(base + "refresh/", HTTP_X_CSRFTOKEN=token).status_code == 409


@pytest.mark.django_db(transaction=True)
def test_stale_projections_keep_snapshot_but_withhold_current_recommendation(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    frozen = p.read(owner, trip.id).data
    c = Client()
    session = c.session
    session["owner_id"] = str(owner)
    session.save()
    c.cookies["sessionid"] = session.session_key
    base = f"/api/v1/trips/{trip.id}/"
    clock.advance(901)
    with (
        patch("api.routes.recommendation_routes.get_planning_service", return_value=p),
        patch("api.routes.weather_routes.get_planning_service", return_value=p),
    ):
        rec = c.get(base + "recommendation/").json()
        assert rec["stale"] and rec["recommended_route_id"] is None
        assert rec["previous_recommended_route_id"] == "A" and rec["state"] == "INCOMPLETE_DATA"
        assert not any(x["eligible"] for x in rec["routes"])
        assert all(
            x["freshness"] == "stale" for x in c.get(base + "weather/").json()["checkpoints"]
        )
    assert p.read(owner, trip.id).data == frozen
    r.update(owner, trip.id, TripCreateRequest.model_validate({**INPUTS, "cargo_load_lb": 2}))
    assert p.read(owner, trip.id).routing_stale


@pytest.mark.django_db(transaction=True)
def test_api_cooldown_and_full_input_patch(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    c = Client(enforce_csrf_checks=True)
    c.get("/api/v1/session/")
    session = c.session
    session["owner_id"] = str(owner)
    session.save()
    c.cookies["sessionid"] = session.session_key
    token = c.get("/api/v1/session/").json()["csrf_token"]
    base = f"/api/v1/trips/{trip.id}/"
    with (
        patch("api.routes.analysis_routes.get_refresh_service", return_value=r),
        patch("api.routes.trip_routes.get_refresh_service", return_value=r),
    ):
        first = c.post(base + "refresh/", HTTP_X_CSRFTOKEN=token)
        assert first.status_code == 202
        p.execute(first.json()["analysis_id"])
        cooldown = c.post(base + "refresh/", HTTP_X_CSRFTOKEN=token)
        assert cooldown.status_code == 429, cooldown.content
        assert cooldown.json()["retry_after_seconds"] == 60
        changed = c.patch(
            base,
            {**INPUTS, "cargo_load_lb": 200},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        assert changed.status_code == 202, changed.content
        assert Trip.objects.get(pk=trip.id).input_revision == 2


@pytest.mark.django_db(transaction=True)
def test_routing_stages_and_weather_batch_guard_are_real(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    stages = []
    real = s.guard

    def record(run_id, token, now, stage):
        stages.append(stage)
        return real(run_id, token, now, stage)

    s.guard = record
    p.execute(trip.analysis_id)
    assert {"routing", "checkpoints", "weather", "assessing"} <= set(stages)
    assert stages.count("weather") >= 2


def test_real_weather_batch_guard_prevents_next_provider_batch():
    from copy import deepcopy

    from services.weather.models import ForecastRequest
    from tests.test_phase2 import generate
    from tests.test_phase3 import setup_service

    service, calls = setup_service()
    cp = generate()
    template = cp.checkpoints[0]
    cp.checkpoints = []
    for i in range(51):
        item = deepcopy(template)
        item.id = str(i)
        item.coordinate.latitude = i / 100
        cp.checkpoints.append(item)
    checks = []

    def guard():
        checks.append(1)
        if len(checks) == 2:
            raise LeaseLost()

    service.guard = guard
    with pytest.raises(LeaseLost):
        service.assess(ForecastRequest(routes=[cp]), fetch=True)
    assert len(calls) == 1


@pytest.mark.django_db(transaction=True)
def test_publish_rolls_back_payload_and_pointer_together(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    with patch(
        "persistence.stores.analysis_store.RouteSnapshot.objects.update_or_create",
        side_effect=RuntimeError("store failed"),
    ):
        with pytest.raises(RuntimeError):
            p.execute(trip.analysis_id)
    run = AnalysisRun.objects.get(pk=trip.analysis_id)
    assert run.payload is None and run.status == "failed"
    assert Trip.objects.get(pk=trip.id).current_analysis_id is None


@pytest.mark.django_db(transaction=True)
def test_live_test_mode_disables_background_tick(system):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    clock.advance(901)
    r.scheduling_enabled = False
    r.tick()
    assert AnalysisRun.objects.filter(trip_id=trip.id).count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "code",
    [
        "provider_authentication",
        "provider_budget_exhausted",
        "provider_budget_unavailable",
    ],
)
def test_credential_failure_does_not_trigger_periodic_retry(system, code):
    p, r, s, clock, calls, sent, w, _ = system
    owner, trip = create(system)
    w.failure = ProviderError(code, "Rejected")
    p.execute(trip.analysis_id)
    clock.advance(901)
    r.tick()
    assert AnalysisRun.objects.filter(trip_id=trip.id).count() == 1
    assert w.calls == 1
