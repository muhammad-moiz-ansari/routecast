"""Synthetic TomTom fixtures and HTTPX MockTransport: all sockets remain blocked."""

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from pydantic import ValidationError

from integrations.exceptions import ProviderError
from integrations.http_client import ProviderHTTP
from integrations.tomtom.geocoding_client import TomTomGeocodingClient
from integrations.tomtom.routing_client import TomTomRoutingClient
from services.location.location_service import LocationService
from services.location.models import LocationSearchRequest
from services.routing.routing_service import RoutingService
from services.trip.models import TripCreateRequest

FIXTURES = Path(__file__).parent / "fixtures"
INPUTS = {
    "origin": {"latitude": 30, "longitude": 70},
    "destination": {"latitude": 31, "longitude": 71},
    "departure_at": "2099-11-09T12:00:00+05:00",
    "timezone": "Asia/Karachi",
    "cargo_load_lb": 42000,
    "checkpoint_spacing_miles": 25,
}


def fixture(name):
    return json.loads((FIXTURES / f"tomtom_{name}.synthetic.json").read_text())


def wire(payload, calls, status=200, headers=None):
    def respond(request):
        calls.append(request)
        return httpx.Response(status, json=payload, headers=headers)

    return ProviderHTTP(
        "test-secret", transport=httpx.MockTransport(respond), budget=lambda *_: None
    )


def trip_service(payload, calls):
    from types import SimpleNamespace

    return SimpleNamespace(routing=RoutingService(TomTomRoutingClient(wire(payload, calls))))


def test_routing_contract_and_normalization():
    calls = []
    options = RoutingService(TomTomRoutingClient(wire(fixture("routes"), calls))).options(
        TripCreateRequest.model_validate(INPUTS)
    )
    assert len(calls) == 1
    params = calls[0].url.params
    assert params["travelMode"] == "truck" and params["maxAlternatives"] == "2"
    assert "vehicleWeight" not in params and "cargo_load_lb" not in params
    assert datetime.fromisoformat(params["departAt"]).utcoffset().total_seconds() == 0
    assert options.available_route_count == 3
    assert [r.id for r in options.routes] == ["A", "B", "C"]
    assert options.routes[0].geometry.coordinates[0] == (70, 30)
    assert options.routes[0].arrival_at > TripCreateRequest.model_validate(INPUTS).departure_at


@pytest.mark.parametrize("count", [0, 1, 2])
def test_fewer_routes_and_no_retries(count):
    payload = fixture("routes")
    payload["routes"] = payload["routes"][:count]
    if count:
        payload["routes"].append(deepcopy(payload["routes"][0]))
    calls = []
    options = trip_service(payload, calls).routing.options(TripCreateRequest.model_validate(INPUTS))
    assert options.available_route_count == count
    assert len(calls) == 1
    assert any(f"Only {count}" in notice for notice in options.notices)


def test_resampled_duplicate_geometry():
    payload = fixture("routes")
    route = deepcopy(payload["routes"][0])
    route["legs"][0]["points"].insert(1, {"latitude": 30.25, "longitude": 70.2})
    payload["routes"] = [payload["routes"][0], route]
    assert (
        trip_service(payload, [])
        .routing.options(TripCreateRequest.model_validate(INPUTS))
        .available_route_count
        == 1
    )


@pytest.mark.parametrize(
    "status,code",
    [
        (401, "provider_authentication"),
        (403, "provider_authentication"),
        (429, "provider_rate_limit"),
        (400, "provider_invalid_request"),
        (500, "provider_unavailable"),
    ],
)
def test_provider_errors_are_sanitized_and_not_retried(status, code):
    calls = []
    http = wire({"secret": "test-secret"}, calls, status, {"Retry-After": "60"})
    with pytest.raises(ProviderError) as failure:
        http.get("/test", {})
    assert failure.value.code == code and "test-secret" not in str(failure.value)
    assert len(calls) == 1
    if status == 429:
        assert failure.value.retry_after_seconds == 60


def test_timeouts_and_missing_configuration():
    calls = []

    def timeout(request):
        calls.append(request)
        raise httpx.ReadTimeout("secret URL", request=request)

    with pytest.raises(ProviderError, match="timed out"):
        ProviderHTTP("test-secret", httpx.MockTransport(timeout), budget=lambda *_: None).get(
            "/test", {}
        )
    assert len(calls) == 1
    with pytest.raises(ProviderError, match="not configured"):
        ProviderHTTP("").get("/test", {})


def test_places_and_empty_results():
    calls = []
    service = LocationService(TomTomGeocodingClient(wire(fixture("places"), calls)))
    places = service.search(LocationSearchRequest(query="Synthetic / place"))
    assert places[0].coordinate.longitude == 70
    assert calls[0].url.params["typeahead"] == "true"
    assert (
        LocationService(TomTomGeocodingClient(wire({"results": []}, []))).search(
            LocationSearchRequest(query="none")
        )
        == []
    )


@pytest.mark.parametrize(
    "change",
    [
        {"cargo_load_lb": -1},
        {"cargo_load_lb": float("inf")},
        {"cargo_load_lb": float("nan")},
        {"checkpoint_spacing_miles": 20},
        {"timezone": "bad/zone"},
        {"departure_at": "2099-01-01T12:00:00"},
        {"origin": {"latitude": 91, "longitude": 0}},
        {"origin": {"latitude": 30, "longitude": float("nan")}},
        {"owner_id": str(uuid4())},
        {"destination": INPUTS["origin"]},
    ],
)
def test_invalid_inputs(change):
    with pytest.raises(ValidationError):
        TripCreateRequest.model_validate({**INPUTS, **change})
