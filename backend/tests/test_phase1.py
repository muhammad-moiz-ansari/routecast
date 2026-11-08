"""Synthetic TomTom fixtures and HTTPX MockTransport: all sockets remain blocked."""

import json
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest
from django.test import Client
from pydantic import ValidationError

from integrations.exceptions import ProviderError
from integrations.http_client import ProviderHTTP
from integrations.tomtom.geocoding_client import TomTomGeocodingClient
from integrations.tomtom.routing_client import TomTomRoutingClient
from persistence.models import Trip
from persistence.stores.trip_store import TripStore
from services.location.location_service import LocationService
from services.location.models import LocationSearchRequest
from services.routing.routing_service import RoutingService
from services.trip.models import TripCreateRequest
from services.trip.trip_service import TripService

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

    return ProviderHTTP("test-secret", transport=httpx.MockTransport(respond))


def trip_service(payload, calls):
    return TripService(TripStore(), RoutingService(TomTomRoutingClient(wire(payload, calls))))


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
        ProviderHTTP("test-secret", httpx.MockTransport(timeout)).get("/test", {})
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


@pytest.mark.django_db
def test_owner_csrf_and_persisted_reads():
    owner, other = Client(enforce_csrf_checks=True), Client(enforce_csrf_checks=True)
    calls = []
    service = trip_service(fixture("routes"), calls)
    with patch("api.routes.trip_routes.get_trip_service", return_value=service):
        assert owner.get("/api/v1/trips/" + str(uuid4()) + "/").status_code == 401
        token = owner.get("/api/v1/session/").json()["csrf_token"]
        assert (
            owner.post("/api/v1/trips/", INPUTS, content_type="application/json").status_code == 403
        )
        result = owner.post(
            "/api/v1/trips/", INPUTS, content_type="application/json", HTTP_X_CSRFTOKEN=token
        )
        assert result.status_code == 201, result.content
        trip = result.json()
        assert trip["status"] == "routes_ready"
        url = f"/api/v1/trips/{trip['id']}/"
        for _ in range(2):
            assert owner.get(url).status_code == 200
            assert owner.get(url + "routes/").json()["available_route_count"] == 3
        other.get("/api/v1/session/")
        assert other.get(url).status_code == 404
        assert other.get(url + "routes/").status_code == 404
        owner.cookies.clear()
        owner.get("/api/v1/session/")
        assert owner.get(url).status_code == 404
    assert len(calls) == 1
    assert Trip.objects.count() == 1


@pytest.mark.django_db
def test_failed_trip_retained_and_route_read_does_not_retry():
    service = trip_service({"routes": [{"bad": "shape"}]}, [])
    owner = uuid4()
    with pytest.raises(ProviderError):
        service.create(owner, TripCreateRequest.model_validate(INPUTS))
    trip = Trip.objects.get()
    assert service.get(owner, trip.id).error_code == "provider_invalid_response"
    assert service.get(owner, trip.id).route_options is None


@pytest.mark.django_db
def test_past_departure_does_not_persist_or_call_provider():
    from common.exceptions import InvalidDeparture

    calls = []
    service = trip_service(fixture("routes"), calls)
    service.clock = lambda: datetime(2100, 1, 1, tzinfo=UTC)
    with pytest.raises(InvalidDeparture):
        service.create(uuid4(), TripCreateRequest.model_validate(INPUTS))
    assert Trip.objects.count() == 0 and not calls


@pytest.mark.django_db
def test_api_composition_errors_and_search():
    client = Client(enforce_csrf_checks=True)
    token = client.get("/api/v1/session/").json()["csrf_token"]
    with patch("integrations.http_client.ProviderHTTP.get", return_value=fixture("places")) as http:
        result = client.get("/api/v1/locations/search/", {"query": "Synthetic"})
        assert result.status_code == 200, result.content
        assert result.json()[0]["coordinate"]["latitude"] == 30
        assert http.call_count == 1
    with patch(
        "integrations.http_client.ProviderHTTP.get",
        side_effect=ProviderError("provider_authentication", "Provider credentials were rejected."),
    ) as http:
        response = client.post(
            "/api/v1/trips/", INPUTS, content_type="application/json", HTTP_X_CSRFTOKEN=token
        )
        assert response.status_code == 503
        body = response.json()
        assert body["code"] == "provider_authentication" and body["request_id"]
        assert body["trip_id"] and http.call_count == 1
        url = f"/api/v1/trips/{body['trip_id']}/"
        assert client.get(url).json()["status"] == "routing_failed"
        assert client.get(url + "routes/").status_code == 409
        assert http.call_count == 1
    with patch("integrations.http_client.ProviderHTTP.get") as http:
        response = client.post(
            "/api/v1/trips/",
            {**INPUTS, "cargo_load_lb": -1},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        assert response.status_code == 422
        assert response.json()["field_errors"] and response.json()["request_id"]
        http.assert_not_called()
