"""Pirate Weather adapter: units, hour alignment, errors, budget and provider selection."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from integrations.exceptions import ProviderError
from integrations.pirate_weather.weather_client import PirateWeatherClient, normalize
from persistence.models import ProviderBudget
from services.checkpoint.models import Checkpoint, CheckpointResult
from services.location.models import Coordinate
from services.weather.models import ForecastRequest
from services.weather.weather_service import WeatherService

T0 = datetime(2026, 11, 10, 6, tzinfo=UTC)
NOW = T0 + timedelta(minutes=20)
A = Coordinate(latitude=31.5204, longitude=74.3587)
B = Coordinate(latitude=31.4504, longitude=73.135)


def at(hours):
    return int((T0 + timedelta(hours=hours)).timestamp())


def payload(points=None, units="si"):
    points = (
        points
        if points is not None
        else [
            {"time": at(0), "windSpeed": 10.0, "liquidAccumulation": 0.254, "snowAccumulation": 0},
            {"time": at(1), "windSpeed": 20.0, "liquidAccumulation": 0, "snowAccumulation": 2.54},
        ]
    )
    return {"flags": {"units": units}, "hourly": {"data": points}}


def client(respond, key="secret-key", budget=lambda *_: None):
    return PirateWeatherClient(key, httpx.MockTransport(respond), lambda: NOW, budget)


def test_hour_starting_points_become_preceding_hour_accumulations():
    hours = normalize(payload(), A, NOW).hours
    assert [h.at for h in hours] == [T0 + timedelta(hours=i) for i in range(3)]
    first, second, last = hours
    # The first hour has no preceding accumulation; wind is the value at each point's time.
    assert first.wind_mph == pytest.approx(22.369362921)
    assert first.rain_inches_per_hour is None and first.snow_inches_per_hour is None
    assert second.wind_mph == pytest.approx(44.738725842)
    assert second.rain_inches_per_hour == pytest.approx(0.1)
    assert second.snow_inches_per_hour == 0
    assert last.wind_mph is None
    assert last.rain_inches_per_hour == 0 and last.snow_inches_per_hour == pytest.approx(1.0)


def test_missing_and_sentinel_values_stay_missing():
    hours = normalize(
        payload([{"time": at(0), "windSpeed": -999}, {"time": at(1), "liquidAccumulation": 0}]),
        A,
        NOW,
    ).hours
    assert hours[0].wind_mph is None and hours[1].wind_mph is None
    assert hours[1].rain_inches_per_hour is None and hours[1].snow_inches_per_hour is None
    assert hours[2].rain_inches_per_hour == 0


@pytest.mark.parametrize(
    "bad",
    [
        payload(units="us"),
        payload([]),
        payload([{"time": at(0), "windSpeed": -1}]),
        payload([{"time": at(0)}, {"time": at(2)}]),
        payload([{"time": at(0), "windSpeed": "fast"}]),
        {"hourly": {"data": []}},
    ],
)
def test_invalid_payloads_are_rejected(bad):
    with pytest.raises(ProviderError) as failure:
        normalize(bad, A, NOW)
    assert failure.value.code == "provider_invalid_response"


def test_one_call_per_location_with_budget_reserved_first():
    events = []

    def respond(request):
        events.append(("http", request))
        return httpx.Response(200, json=payload())

    def budget(provider, amount):
        events.append(("budget", provider, amount))

    series = client(respond, budget=budget).fetch([A, B])
    assert events[0] == ("budget", "pirate-weather", 2)
    requests = [e[1] for e in events[1:]]
    assert [r.url.path for r in requests] == [
        "/forecast/secret-key/31.5204,74.3587",
        "/forecast/secret-key/31.4504,73.1350",
    ]
    assert requests[0].url.host == "api.pirateweather.net"
    assert dict(requests[0].url.params) == {
        "units": "si",
        "extend": "hourly",
        "version": "2",
        "exclude": "currently,minutely,daily,alerts",
    }
    assert [s.coordinate for s in series] == [A, B]
    assert all(s.fetched_at == NOW for s in series)


@pytest.mark.parametrize(
    ("status", "headers", "code", "http_status", "retry"),
    [
        (401, {}, "provider_authentication", 503, None),
        (403, {}, "provider_authentication", 503, None),
        (429, {"Ratelimit-Reset": "120"}, "provider_rate_limit", 429, 120),
        (429, {"Ratelimit-Reset": "2600000"}, "provider_rate_limit", 429, 86400),
        (400, {}, "provider_invalid_request", 422, None),
        (500, {}, "provider_unavailable", 503, None),
    ],
)
def test_statuses_are_sanitized(status, headers, code, http_status, retry):
    with pytest.raises(ProviderError) as failure:
        client(lambda r: httpx.Response(status, headers=headers)).fetch([A])
    assert (failure.value.code, failure.value.status) == (code, http_status)
    assert failure.value.retry_after_seconds == retry
    assert "secret-key" not in failure.value.message


def test_invalid_json_timeout_missing_key_and_batch_size():
    with pytest.raises(ProviderError) as failure:
        client(lambda r: httpx.Response(200, content=b"not json")).fetch([A])
    assert failure.value.code == "provider_invalid_response"

    def slow(request):
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(ProviderError) as failure:
        client(slow).fetch([A])
    assert failure.value.code == "provider_timeout"
    calls = []
    with pytest.raises(ProviderError) as failure:
        client(lambda r: calls.append(r), key="").fetch([A])
    assert failure.value.code == "provider_not_configured" and not calls
    with pytest.raises(ValueError):
        client(lambda r: httpx.Response(200, json=payload())).fetch([A] * 51)


@pytest.mark.django_db(transaction=True)
def test_exhausted_budget_blocks_before_http(settings):
    settings.PROVIDER_BUDGETS = {"pirate-weather": {"minute": 1, "hour": 9, "day": 9, "month": 9}}
    calls = []
    real = PirateWeatherClient("secret-key", httpx.MockTransport(lambda r: calls.append(r)))
    with pytest.raises(ProviderError) as failure:
        real.fetch([A, B])
    assert failure.value.code == "provider_budget_exhausted" and not calls
    assert ProviderBudget.objects.get(pk="pirate-weather").windows == {}


def test_key_selects_pirate_weather_with_its_own_cache_namespace(settings):
    from api.dependencies import get_corridor_service, get_weather_service
    from integrations.open_meteo.weather_client import OpenMeteoClient

    settings.PIRATE_WEATHER_API_KEY = "secret-key"
    weather, corridor = get_weather_service(), get_corridor_service()
    assert isinstance(weather.client, PirateWeatherClient)
    assert isinstance(corridor.client, PirateWeatherClient)
    assert weather.cache.prefix == corridor.forecasts.prefix == "forecast:pirate-weather:v1:"
    settings.PIRATE_WEATHER_API_KEY = ""
    weather = get_weather_service()
    assert isinstance(weather.client, OpenMeteoClient)
    assert weather.cache.prefix == "forecast:v1:"


def test_checkpoint_between_hours_uses_aligned_rain_and_bracketing_wind():
    class Cache:
        def __init__(self):
            self.data = {}

        def get(self, c):
            return self.data.get((c.latitude, c.longitude))

        def set(self, s):
            self.data[(s.coordinate.latitude, s.coordinate.longitude)] = s

    route = CheckpointResult(
        route_id="A",
        analysis_version=1,
        spacing_miles=25,
        route_distance_meters=1000,
        polyline_length_meters=1000,
        eta_method="proportional_distance",
        checkpoints=[
            Checkpoint(
                id="A-0000",
                coordinate=A,
                distance_meters=0,
                distance_miles=0,
                cumulative_travel_seconds=0,
                arrival_at=T0 + timedelta(minutes=30),
            )
        ],
        intervals=[],
    )
    pirate = client(lambda r: httpx.Response(200, json=payload()))
    result = WeatherService(pirate, Cache(), lambda n: None, clock=lambda: NOW).assess(
        ForecastRequest(routes=[route]), fetch=True
    )
    row = result.checkpoints[0]
    assert result.provider == "pirate-weather"
    assert (row.interval_start, row.interval_end) == (T0, T0 + timedelta(hours=1))
    assert row.rain_inches_per_hour == pytest.approx(0.1) and row.snow_inches_per_hour == 0
    assert row.wind_mph == pytest.approx(44.738725842)
    assert row.coverage == "complete" and row.freshness == "fresh"
