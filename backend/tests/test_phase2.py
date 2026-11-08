"""Offline checkpoint and ETA acceptance cases; no external provider calls."""

from datetime import UTC, datetime, timedelta
from math import pi

import pytest
from pydantic import ValidationError

from common.geo_utils import EARTH_RADIUS_METERS, segment_length
from services.checkpoint.checkpoint_repo import CheckpointRepo
from services.checkpoint.checkpoint_service import CheckpointGeometryError, CheckpointService
from services.checkpoint.models import CheckpointRequest
from services.routing.models import RouteCandidate, RouteTimingPoint
from services.routing.timing import instruction_timing
from services.trip.models import TripCreateRequest
from tests.test_phase1 import INPUTS, fixture, trip_service

DEPARTURE = datetime(2099, 11, 9, tzinfo=UTC)


def route(miles=100, coordinates=None, timing=None, route_id="A"):
    return RouteCandidate(
        id=route_id,
        label=f"Route {route_id}",
        geometry={"coordinates": coordinates or [(0, 0), (1, 0)]},
        distance_meters=miles * 1609.344,
        duration_seconds=1000,
        arrival_at=DEPARTURE + timedelta(seconds=1000),
        timing_points=timing or [],
    )


def generate(candidate=None, spacing=25):
    return CheckpointService().generate(
        CheckpointRequest(
            route=candidate or route(),
            departure_at=DEPARTURE,
            spacing_miles=spacing,
            analysis_version=7,
        )
    )


@pytest.mark.parametrize("spacing", [10, 25, 50])
@pytest.mark.parametrize("miles", [0.001, 5, 50, 100, 113])
def test_endpoints_spacing_intervals_and_monotonic_eta(miles, spacing):
    result = generate(route(miles), spacing)
    cps = result.checkpoints
    assert cps[0].distance_meters == 0
    assert cps[-1].distance_meters == miles * 1609.344
    assert cps[0].coordinate.longitude == 0 and cps[-1].coordinate.longitude == 1
    assert cps[0].arrival_at == DEPARTURE
    assert cps[-1].arrival_at == DEPARTURE + timedelta(seconds=1000)
    assert all(a.distance_meters < b.distance_meters for a, b in zip(cps, cps[1:]))
    assert all(a.arrival_at <= b.arrival_at for a, b in zip(cps, cps[1:]))
    assert all(c.distance_miles == pytest.approx(i * spacing) for i, c in enumerate(cps[:-1]))
    assert sum(i.distance_miles for i in result.intervals) == pytest.approx(miles)
    assert all(i.distance_miles <= spacing + 1e-9 for i in result.intervals)
    assert result.eta_method == "proportional_distance" and result.timing_notice
    assert result.analysis_version == 7
    if miles <= spacing:
        assert len(cps) == 2
    elif miles % spacing == 0:
        assert len(cps) == miles // spacing + 1
    else:
        assert result.intervals[-1].distance_miles == pytest.approx(miles % spacing)


def test_full_bent_polyline_route_specific_and_repeated_vertices():
    points = [(0, 0), (0, 0), (1, 0), (1, 1)]
    result = generate(route(100, points))
    midpoint = result.checkpoints[2].coordinate
    assert midpoint.longitude == pytest.approx(1) and midpoint.latitude == pytest.approx(0)
    other = generate(route(100, [(0, 0), (0, 1), (1, 1)], route_id="B"))
    assert other.checkpoints[2].coordinate.longitude < 0.01
    assert result.checkpoints[2].id != other.checkpoints[2].id
    assert route(100, points).geometry.coordinates == points
    assert result.distance_method == "provider_distance_scaled_polyline"


def test_dateline_and_measurement():
    assert segment_length((0, 0), (1, 0)) == pytest.approx(EARTH_RADIUS_METERS * pi / 180)
    result = generate(route(100, [(179, 0), (-179, 0)]))
    assert abs(result.checkpoints[2].coordinate.longitude) == pytest.approx(180)
    assert result.polyline_length_meters < 225000


def test_provider_span_interpolation_and_exact_total():
    timing = [RouteTimingPoint(distance_meters=25 * 1609.344, cumulative_travel_seconds=900)]
    result = generate(route(timing=timing))
    assert result.eta_method == "provider_timing_interpolation" and result.timing_notice is None
    assert [c.cumulative_travel_seconds for c in result.checkpoints] == pytest.approx(
        [0, 900, 900 + 100 / 3, 900 + 200 / 3, 1000]
    )
    assert generate(route(timing=timing)).model_dump() == result.model_dump()


@pytest.mark.parametrize(
    "instructions",
    [
        [],
        [
            {"routeOffsetInMeters": 30, "travelTimeInSeconds": 5},
            {"routeOffsetInMeters": 20, "travelTimeInSeconds": 8},
        ],
        [
            {"routeOffsetInMeters": 20, "travelTimeInSeconds": 8},
            {"routeOffsetInMeters": 30, "travelTimeInSeconds": 5},
        ],
        [{"routeOffsetInMeters": 101, "travelTimeInSeconds": 5}],
        [{"routeOffsetInMeters": 20, "travelTimeInSeconds": 11}],
        [{"routeOffsetInMeters": 0, "travelTimeInSeconds": 1}],
        [{"routeOffsetInMeters": 100, "travelTimeInSeconds": 9}],
        [{"routeOffsetInMeters": float("nan"), "travelTimeInSeconds": 5}],
        [{"routeOffsetInMeters": 20}],
    ],
)
def test_invalid_provider_timing_falls_back(instructions):
    points, notice = instruction_timing({"instructions": instructions}, 100, 10)
    assert points == [] and notice


def test_timing_endpoints_duplicates_and_plateaus():
    data = [
        {"routeOffsetInMeters": d, "travelTimeInSeconds": t}
        for d, t in [(0, 0), (20, 4), (20, 4), (40, 4), (100, 10)]
    ]
    points, notice = instruction_timing({"instructions": data}, 100, 10)
    assert not notice
    assert [(p.distance_meters, p.cumulative_travel_seconds) for p in points] == [
        (0, 0),
        (20, 4),
        (40, 4),
        (100, 10),
    ]
    assert instruction_timing({"instructions": None}, 100, 10)[0] == []


def test_invalid_stored_timing_uses_labeled_fallback():
    timing = [
        RouteTimingPoint(distance_meters=2, cumulative_travel_seconds=900),
        RouteTimingPoint(distance_meters=1, cumulative_travel_seconds=950),
    ]
    assert generate(route(timing=timing)).eta_method == "proportional_distance"


def test_degenerate_antipodal_and_excessive_routes():
    for candidate in [
        route(coordinates=[(0, 0), (0, 0)]),
        route(coordinates=[(0, 0), (180, 0)]),
        route(miles=1000000),
    ]:
        with pytest.raises(CheckpointGeometryError):
            generate(candidate)


def test_schema_and_inheritance():
    with pytest.raises(TypeError):
        CheckpointRepo()
    assert isinstance(CheckpointService(), CheckpointRepo)
    for change in [{"spacing_miles": 20}, {"departure_at": datetime(2099, 1, 1)}]:
        with pytest.raises(ValidationError):
            CheckpointRequest.model_validate(
                {"route": route(), "departure_at": DEPARTURE, **change}
            )


def test_provider_normalization_preserves_timing_in_same_request():
    payload = fixture("routes")
    for item in payload["routes"]:
        item["guidance"] = {
            "instructions": [{"routeOffsetInMeters": 2000, "travelTimeInSeconds": 200}]
        }
    calls = []
    options = trip_service(payload, calls).routing.options(TripCreateRequest.model_validate(INPUTS))
    assert len(calls) == 1 and calls[0].url.params["instructionsType"] == "coded"
    assert len(options.routes[0].timing_points) == 3
    assert options.routes[0].timing_points[-1].cumulative_travel_seconds == 600
    assert not options.routes[0].timing_notice


def test_spacing_on_measured_polyline():
    length = segment_length((0, 0), (1, 0))
    candidate = route(length / 1609.344)
    result = generate(candidate)
    point = result.checkpoints[1].coordinate
    assert segment_length((0, 0), (point.longitude, point.latitude)) == pytest.approx(25 * 1609.344)


def test_checkpoint_openapi_contract(client):
    schema = client.get("/api/v1/openapi.json").json()
    operation = schema["paths"]["/api/v1/trips/{trip_id}/checkpoints/"]["get"]
    assert "200" in operation["responses"] and "409" in operation["responses"]
    assert any(p["name"] == "route_id" and p["required"] for p in operation["parameters"])
