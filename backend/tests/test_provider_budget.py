"""Durable budget boundaries on SQLite; PostgreSQL lock behavior is a separate runtime check."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from django.db import OperationalError, transaction
from django.test import Client

from integrations.exceptions import ProviderError
from integrations.http_client import ProviderHTTP
from integrations.open_meteo.weather_client import OpenMeteoClient
from integrations.provider_budget import reserve_provider_budget
from persistence.models import ProviderBudget
from persistence.stores.provider_budget_store import periods, reserve
from services.location.models import Coordinate

pytestmark = pytest.mark.django_db(transaction=True)
NOW = datetime(2026, 11, 9, 12, 30, tzinfo=UTC)
LIMITS = {"minute": 3, "hour": 10, "day": 20, "month": 30}


def test_reservation_is_shared_and_rejection_does_not_consume_other_windows():
    assert reserve("tomtom", 2, LIMITS, NOW) == 0
    assert reserve("tomtom", 1, LIMITS, NOW) == 0
    assert reserve("tomtom", 1, LIMITS, NOW) == 60
    ledger = ProviderBudget.objects.get(pk="tomtom").windows
    assert all(w["used"] == 3 for w in ledger.values())
    assert reserve("tomtom", 1, LIMITS, NOW + timedelta(minutes=1)) == 0
    ledger = ProviderBudget.objects.get(pk="tomtom").windows
    assert ledger["minute"]["used"] == 1 and ledger["day"]["used"] == 4


@pytest.mark.parametrize("period", ["minute", "hour", "day", "month"])
def test_each_window_enforces_its_limit_and_zero_blocks(period):
    limits = {**LIMITS, period: 0}
    assert reserve("tomtom", 1, limits, NOW) == int((periods(NOW)[period][1] - NOW).total_seconds())
    assert ProviderBudget.objects.get(pk="tomtom").windows == {}


def test_monthly_limits_survive_daily_rollover_and_reset_in_december():
    limits = {"minute": 100, "hour": 100, "day": 100, "month": 2}
    assert reserve("tomtom", 2, limits, NOW) == 0
    assert reserve("tomtom", 1, limits, NOW + timedelta(days=1)) > 0
    assert reserve("tomtom", 1, limits, NOW.replace(month=12, day=1)) == 0
    assert periods(NOW.replace(month=12))["month"][1].year == 2027


def test_provider_failure_consumes_allowance_and_blocks_the_next_http_request(settings):
    settings.PROVIDER_BUDGETS = {"tomtom": dict.fromkeys(LIMITS, 1)}
    calls = []

    def respond(request):
        calls.append(request)
        return httpx.Response(500)

    # Separate clients represent web and worker processes sharing the same durable ledger.
    first = ProviderHTTP("secret", httpx.MockTransport(respond))
    second = ProviderHTTP("secret", httpx.MockTransport(respond))
    with pytest.raises(ProviderError) as failure:
        first.get("/search/2/search/test.json", {})
    assert failure.value.code == "provider_unavailable"
    with pytest.raises(ProviderError) as failure:
        second.get("/routing/1/calculateRoute/test/json", {})
    assert failure.value.code == "provider_budget_exhausted"
    assert failure.value.status == 429 and failure.value.retry_after_seconds > 0
    assert len(calls) == 1


def test_weather_weights_locations_and_blocks_before_http(settings):
    settings.PROVIDER_BUDGETS = {"open-meteo": dict.fromkeys(LIMITS, 3)}
    calls = []
    client = OpenMeteoClient(httpx.MockTransport(lambda request: calls.append(request)))
    with pytest.raises(ProviderError) as failure:
        client.fetch([Coordinate(latitude=1, longitude=2), Coordinate(latitude=3, longitude=4)])
    assert failure.value.code == "provider_budget_exhausted"
    assert not calls
    assert ProviderBudget.objects.get(pk="open-meteo").windows == {}


def test_storage_failure_is_sanitized_and_never_sends_http(monkeypatch):
    import integrations.provider_budget as budget

    def unavailable(*args):
        raise OperationalError("private database connection details")

    monkeypatch.setattr(budget, "reserve", unavailable)
    calls = []
    with pytest.raises(ProviderError) as failure:
        ProviderHTTP("secret", httpx.MockTransport(lambda r: calls.append(r))).get("/test", {})
    assert failure.value.code == "provider_budget_unavailable"
    assert "private" not in str(failure.value) and not calls


def test_reservation_cannot_be_rolled_back_by_an_outer_transaction():
    with transaction.atomic(), pytest.raises(ProviderError) as failure:
        reserve_provider_budget("tomtom", 1)
    assert failure.value.code == "provider_budget_unavailable"


@pytest.mark.parametrize("amount", [0, -1, 1.5, True])
def test_invalid_reservations_cannot_refund_usage(amount):
    with pytest.raises(ValueError):
        reserve("tomtom", amount, LIMITS, NOW)
    assert not ProviderBudget.objects.exists()


def test_search_returns_429_retry_header_without_outbound_io(monkeypatch, settings):
    from services.location.location_service import LocationService

    settings.PROVIDER_BUDGETS = {"tomtom": dict.fromkeys(LIMITS, 0)}
    calls = []
    from integrations.tomtom.geocoding_client import TomTomGeocodingClient

    service = LocationService(
        TomTomGeocodingClient(
            ProviderHTTP("secret", httpx.MockTransport(lambda request: calls.append(request))),
        )
    )
    monkeypatch.setattr("api.routes.location_routes.get_location_service", lambda: service)
    client = Client()
    client.get("/api/v1/session/")
    response = client.get("/api/v1/locations/search/?query=Lahore")
    assert response.status_code == 429
    assert response.json()["code"] == "provider_budget_exhausted"
    assert int(response["Retry-After"]) == response.json()["retry_after_seconds"]
    assert "secret" not in response.content.decode() and not calls


def test_usage_command_is_read_only_and_contains_no_credentials(settings):
    import json
    from io import StringIO

    from django.core.management import call_command

    now = datetime.now(UTC)
    reserve("tomtom", 1, settings.PROVIDER_BUDGETS["tomtom"], now)
    before = ProviderBudget.objects.get(pk="tomtom").windows
    output = StringIO()
    call_command("provider_usage", stdout=output)
    data = json.loads(output.getvalue())
    assert data["tomtom"]["month"]["used"] == 1
    assert data["open-meteo"]["month"]["used"] == 0
    assert ProviderBudget.objects.get(pk="tomtom").windows == before
    assert "TOMTOM_API_KEY" not in output.getvalue()


def test_old_clock_cannot_reset_a_newer_window():
    reserve("tomtom", 1, LIMITS, NOW)
    with pytest.raises(ValueError, match="clock"):
        reserve("tomtom", 1, LIMITS, NOW - timedelta(minutes=1))
    assert ProviderBudget.objects.get(pk="tomtom").windows["month"]["used"] == 1


def test_invalid_configuration_does_not_disable_protection(monkeypatch):
    from django.core.exceptions import ImproperlyConfigured

    from config.settings.base import provider_limits

    monkeypatch.setenv("TOMTOM_LIMIT_DAY", "-1")
    with pytest.raises(ImproperlyConfigured):
        provider_limits("TOMTOM", (20, 100, 100, 2000))
