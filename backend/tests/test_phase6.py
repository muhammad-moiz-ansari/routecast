from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.cache import caches
from django.test import Client

from cache.corridor_cache import CorridorCache
from cache.forecast_cache import ForecastCache
from integrations.exceptions import ProviderError
from persistence.models import AnalysisRun, CorridorRun
from persistence.stores.corridor_store import CorridorStore
from services.corridor.corridor_service import CorridorService
from services.corridor.geometry import make_grid
from services.corridor.models import CorridorRequest
from services.weather.models import ForecastSeries, HourlyForecast
from tests.test_phase2 import route
from tests.test_phase5 import create
from tests.test_phase5 import system as system


def test_overlap_cap_and_coarsening():
    a = route(coordinates=[(0, 0), (30, 30)])
    one = make_grid(CorridorRequest(routes=[a]))
    duplicate = make_grid(CorridorRequest(routes=[a, a]))
    assert len(one.samples) == len(duplicate.samples) <= 100
    assert one.along_spacing_meters > 16093.44
    assert len({(s.coordinate.latitude, s.coordinate.longitude) for s in one.samples}) == len(
        one.samples
    )


@pytest.mark.parametrize(
    "points", [[(179, 0), (-179, 0)], [(0, 85), (20, 85)], [(0, 0), (0, 0), (1, 1)]]
)
def test_geographic_samples(points):
    data = make_grid(CorridorRequest(routes=[route(coordinates=points)]))
    assert 0 < len(data.samples) <= 100
    assert all(
        -180 <= s.coordinate.longitude <= 180 and -90 <= s.coordinate.latitude <= 90
        for s in data.samples
    )
    assert data.width_miles == 10


class Forecasts:
    def __init__(self, clock):
        self.clock = clock
        self.calls = 0
        self.fail = False
        self.null = False

    def fetch(self, coords):
        self.calls += 1
        if self.fail:
            raise ProviderError("provider_timeout", "Timeout")
        anchor = self.clock().replace(minute=0, second=0, microsecond=0)
        return [
            ForecastSeries(
                coordinate=c,
                fetched_at=self.clock(),
                hours=[
                    HourlyForecast(
                        at=anchor + timedelta(hours=i),
                        wind_mph=None if self.null else 10,
                        rain_inches_per_hour=0,
                        snow_inches_per_hour=0,
                    )
                    for i in range(49)
                ],
            )
            for c in coords
        ]


def corridor(system):
    p, r, s, clock, calls, sent, w, locks = system
    cache = caches["default"]
    cache.clear()
    forecasts = Forecasts(clock)
    dispatch = []
    usage = []
    service = CorridorService(
        CorridorStore(),
        forecasts,
        ForecastCache(cache),
        CorridorCache(cache),
        usage.append,
        locks,
        dispatch.append,
        clock,
    )
    return service, forecasts, dispatch, usage


@pytest.mark.django_db(transaction=True)
def test_frames_fixed_anchor_cache_and_no_slider_fetch(system):
    p, r, s, clock, calls, sent, w, locks = system
    service, forecasts, dispatch, usage = corridor(system)
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    core = deepcopy(p.read(owner, trip.id).data)
    service.enqueue(trip.analysis_id)
    job = CorridorRun.objects.get()
    service.execute(job.id)
    result = service.read(owner, trip.id)
    assert result["status"] == "ready"
    data = result["data"]
    assert len(data["timestamps"]) == 49 and data["analysis_version"] == 1
    assert data["timestamps"][0] == data["anchor_at"]
    assert data["missing"]["wind_mph"][0] == [False] * 49
    assert sum(usage) <= 100
    count = forecasts.calls
    clock.advance(3600)
    assert service.read(owner, trip.id)["data"] == data and forecasts.calls == count
    service.execute(job.id)
    assert forecasts.calls == count and p.read(owner, trip.id).data == core
    c = Client()
    session = c.session
    session["owner_id"] = str(owner)
    session.save()
    c.cookies["sessionid"] = session.session_key
    url = f"/api/v1/trips/{trip.id}/corridor/"
    with patch("api.routes.corridor_routes.get_corridor_service", return_value=service):
        response = c.get(url)
        assert response.status_code == 200
        assert c.get(url, HTTP_IF_NONE_MATCH=response["ETag"]).status_code == 304
        assert Client().get(url).status_code == 401
        other = Client()
        other.get("/api/v1/session/")
        assert other.get(url).status_code == 404
    assert forecasts.calls == count


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("failure", ["null", "provider", "stop", "budget"])
def test_partial_failure_or_stop_never_invalidates_core(system, failure):
    p, r, s, clock, calls, sent, w, locks = system
    service, forecasts, dispatch, usage = corridor(system)
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    frozen = p.read(owner, trip.id).data
    service.enqueue(trip.analysis_id)
    job = CorridorRun.objects.get()
    forecasts.null = failure == "null"
    forecasts.fail = failure == "provider"
    if failure == "budget":

        def exhausted(_):
            raise ProviderError("provider_budget_exhausted", "Allowance exhausted", 429, 60)

        forecasts.fetch = exhausted
    if failure == "stop":
        r.stop(owner, trip.id)
    service.execute(job.id)
    assert p.read(owner, trip.id).data == frozen
    if failure != "stop":
        data = service.read(owner, trip.id)["data"]
        assert data["coverage"] == "partial" and all(data["missing"]["wind_mph"][0])
    else:
        assert forecasts.calls == 0


@pytest.mark.django_db(transaction=True)
def test_ancillary_dispatch_failure_keeps_completed_core(system):
    p, r, s, clock, calls, sent, w, locks = system

    def fail(_):
        raise RuntimeError("dispatch")

    p.corridor_submit = fail
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    assert AnalysisRun.objects.get(pk=trip.analysis_id).status == "complete"


@pytest.mark.django_db(transaction=True)
def test_recovery_discovers_missing_corridor_job(system):
    p, r, s, clock, calls, sent, w, locks = system
    service, forecasts, dispatch, usage = corridor(system)
    owner, trip = create(system)
    p.execute(trip.analysis_id)
    assert not CorridorRun.objects.exists()
    service.recover()
    assert CorridorRun.objects.count() == 1 and len(dispatch) == 1
    service.recover()
    assert len(dispatch) == 1 and not forecasts.calls


def test_buffer_is_geographic_and_three_route_budget():
    from math import radians

    from common.geo_utils import EARTH_RADIUS_METERS, segment_length

    g = make_grid(CorridorRequest(routes=[route(coordinates=[(0, 0), (1, 0)])]))
    for sample in g.samples:
        c = sample.coordinate
        distance = (
            abs(radians(c.latitude)) * EARTH_RADIUS_METERS
            if 0 <= c.longitude <= 1
            else min(
                segment_length((0, 0), (c.longitude, c.latitude)),
                segment_length((1, 0), (c.longitude, c.latitude)),
            )
        )
        assert distance <= 16093.44 + 1e-6
    routes = [route(coordinates=[(i * 10, 0), (i * 10 + 8, 50)], route_id=str(i)) for i in range(3)]
    assert len(make_grid(CorridorRequest(routes=routes)).samples) <= 100
