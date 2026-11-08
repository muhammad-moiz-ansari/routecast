from copy import deepcopy
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import httpx
import pytest
from django.core.cache import caches
from django.test import Client

from cache.forecast_cache import ForecastCache
from cache.provider_usage import record_weather_usage
from integrations.exceptions import ProviderError
from integrations.open_meteo.weather_client import OpenMeteoClient, normalize
from services.weather.models import ForecastRequest
from services.weather.weather_service import WeatherService
from tests.test_phase2 import generate, route

NOW = datetime(2099, 11, 9, tzinfo=UTC)


def payload():
    return {
        "hourly_units": {"wind_speed_10m": "km/h", "rain": "mm", "showers": "mm", "snowfall": "cm"},
        "hourly": {
            "time": [int((NOW + timedelta(hours=i)).timestamp()) for i in range(3)],
            "wind_speed_10m": [16.09344, 32.18688, 0],
            "rain": [0, 25.4, 0],
            "showers": [0, 25.4, 0],
            "snowfall": [0, 2.54, None],
        },
    }


def setup_service():
    cache = caches["default"]
    cache.clear()
    calls = []

    def respond(request):
        calls.append(request)
        count = len(request.url.params["latitude"].split(","))
        return httpx.Response(200, json=[payload() for _ in range(count)])

    client = OpenMeteoClient(httpx.MockTransport(respond), clock=lambda: NOW)
    return WeatherService(
        client, ForecastCache(cache), lambda n: record_weather_usage(cache, n), clock=lambda: NOW
    ), calls


def test_units_rain_showers_snow_and_null():
    series = normalize(payload(), route().geometry and generate().checkpoints[0].coordinate, NOW)
    h = series.hours[1]
    assert h.wind_mph == pytest.approx(20)
    assert h.rain_inches_per_hour == pytest.approx(2)
    assert h.snow_inches_per_hour == pytest.approx(1)
    assert series.hours[2].snow_inches_per_hour is None


@pytest.mark.parametrize(
    "minutes,wind,rain,coverage",
    [
        (0, 10, 0, "complete"),
        (30, 20, 2, "complete"),
        (60, 20, 2, "complete"),
        (61, 20, 0, "incomplete"),
        (181, None, None, "incomplete"),
        (-61, None, None, "incomplete"),
    ],
)
def test_matching_boundaries_and_horizon(minutes, wind, rain, coverage):
    service, calls = setup_service()
    result = generate(route(1))
    for cp in result.checkpoints:
        cp.arrival_at = NOW + timedelta(minutes=minutes)
    service.assess(ForecastRequest(routes=[result]), fetch=True)
    data = service.assess(ForecastRequest(routes=[result])).checkpoints[0]
    assert data.wind_mph == pytest.approx(wind) if wind is not None else data.wind_mph is None
    assert (
        data.rain_inches_per_hour == pytest.approx(rain)
        if rain is not None
        else data.rain_inches_per_hour is None
    )
    assert data.coverage == coverage
    assert len(calls) == 1


def test_dedup_cache_changed_eta_and_stale_reads():
    service, calls = setup_service()
    r = generate(route(1))
    request = ForecastRequest(routes=[r, deepcopy(r)])
    first = service.assess(request, fetch=True)
    assert first.unique_locations_requested == 2 and first.provider_requests == 1
    assert first.analysis_versions == {"A": 7}
    r.checkpoints[0].arrival_at += timedelta(minutes=30)
    assert service.assess(request, fetch=True).provider_requests == 0
    service.clock = lambda: NOW + timedelta(minutes=16)
    stale = service.assess(request)
    assert stale.checkpoints[0].freshness == "stale" and stale.provider_requests == 0
    assert len(calls) == 1


@pytest.mark.parametrize("change", ["units", "nan", "length", "time"])
def test_malformed_data(change):
    p = payload()
    if change == "units":
        p["hourly_units"]["snowfall"] = "kg"
    if change == "nan":
        p["hourly"]["rain"][0] = float("nan")
    if change == "length":
        p["hourly"]["rain"].pop()
    if change == "time":
        p["hourly"]["time"][1] += 1
    with pytest.raises(ProviderError):
        normalize(p, generate().checkpoints[0].coordinate, NOW)


def test_missing_variable_and_no_cache():
    p = payload()
    del p["hourly"]["snowfall"]
    assert (
        normalize(p, generate().checkpoints[0].coordinate, NOW).hours[0].snow_inches_per_hour
        is None
    )
    service, calls = setup_service()
    assert (
        service.assess(ForecastRequest(routes=[generate()])).checkpoints[0].freshness == "missing"
    )
    assert not calls


@pytest.mark.parametrize("status", [429, 500])
def test_provider_errors_no_retries(status):
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(status, json={"error": "secret"})

    with pytest.raises(ProviderError):
        OpenMeteoClient(httpx.MockTransport(respond)).fetch([generate().checkpoints[0].coordinate])
    assert len(calls) == 1


@pytest.mark.django_db
def test_weather_owner_csrf_and_cached_get():
    from tests.test_phase1 import INPUTS, fixture, trip_service

    c = Client(enforce_csrf_checks=True)
    token = c.get("/api/v1/session/").json()["csrf_token"]
    with patch(
        "api.routes.trip_routes.get_trip_service", return_value=trip_service(fixture("routes"), [])
    ):
        trip = c.post(
            "/api/v1/trips/", INPUTS, content_type="application/json", HTTP_X_CSRFTOKEN=token
        ).json()
    url = f"/api/v1/trips/{trip['id']}/weather/"
    service, calls = setup_service()
    with patch("api.routes.weather_routes.get_weather_service", return_value=service):
        assert c.get(url).status_code == 200 and not calls
        assert c.post(url + "prefetch/").status_code == 403
        assert c.post(url + "prefetch/", HTTP_X_CSRFTOKEN=token).status_code == 200
        count = len(calls)
        assert c.get(url).status_code == 200 and len(calls) == count
        other = Client()
        other.get("/api/v1/session/")
        assert other.get(url).status_code == 404


def test_batch_boundary_and_shared_accounting():
    service, calls = setup_service()
    result = generate(route(1))
    cp = result.checkpoints[0]
    result.checkpoints = []
    for i in range(51):
        item = deepcopy(cp)
        item.id = str(i)
        item.coordinate.latitude = i / 100
        result.checkpoints.append(item)
    data = service.assess(ForecastRequest(routes=[result]), fetch=True)
    assert data.provider_requests == 2 and data.unique_locations_requested == 51
    assert data.estimated_usage_units == 51 and len(calls) == 2
    day = datetime.now(UTC).date().isoformat()
    assert caches["default"].get(f"provider:open-meteo:{day}:requests") == 2
    assert caches["default"].get(f"provider:open-meteo:{day}:locations") == 51


def test_timeout_and_units_in_inches():
    def timeout(request):
        raise httpx.ReadTimeout("secret", request=request)

    with pytest.raises(ProviderError, match="timed out"):
        OpenMeteoClient(httpx.MockTransport(timeout)).fetch([generate().checkpoints[0].coordinate])
    p = payload()
    p["hourly_units"] = {
        "wind_speed_10m": "mph",
        "rain": "inch",
        "showers": "inch",
        "snowfall": "inch",
    }
    h = normalize(p, generate().checkpoints[0].coordinate, NOW).hours[1]
    assert h.wind_mph == 32.18688 and h.snow_inches_per_hour == 2.54
