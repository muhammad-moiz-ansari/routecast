from copy import deepcopy
from math import inf, nextafter
from unittest.mock import patch

import pytest
from django.test import Client
from pydantic import ValidationError

from common.enums import RiskCategory as R
from config.risk_rules import BOUNDS, ORDER
from services.checkpoint.checkpoint_service import CheckpointService
from services.recommendation.recommendation_service import RecommendationService
from services.risk.models import RiskRequest
from services.risk.risk_service import RiskService, category_for
from services.weather.models import CheckpointWeather, WeatherResult
from tests.test_phase2 import generate, route


def summarize(wind=0, rain=0, snow=0, load=0, fresh=True, route_id="A", duration=1000):
    cp = generate(route(113, route_id=route_id))
    weather = [
        CheckpointWeather(
            route_id=route_id,
            checkpoint_id=c.id,
            arrival_at=c.arrival_at,
            wind_mph=wind,
            rain_inches_per_hour=rain,
            snow_inches_per_hour=snow,
            coverage="complete" if None not in (wind, rain, snow) else "incomplete",
            freshness="fresh" if fresh else "stale",
        )
        for c in cp.checkpoints
    ]
    return RiskService().assess(
        RiskRequest(route=cp, weather=weather, cargo_load_lb=load, duration_seconds=duration)
    )


@pytest.mark.parametrize("variable", list(BOUNDS))
@pytest.mark.parametrize("boundary", range(4))
def test_every_boundary_below_at_above(variable, boundary):
    value = BOUNDS[variable][boundary]
    assert category_for(variable, nextafter(value, -inf))[0] == ORDER[boundary]
    at = ORDER[boundary + 1]
    if variable != "wind_mph" and boundary == 3:
        at = R.SEVERE
    assert category_for(variable, value)[0] == at
    assert category_for(variable, nextafter(value, inf))[0] == ORDER[boundary + 1]


@pytest.mark.parametrize(
    "wind,load,expected",
    [
        (35, 40000, R.HIGH),
        (35, 40000.01, R.SEVERE),
        (44.999, 40000.01, R.SEVERE),
        (45, 30000, R.SEVERE),
        (45, 30000.01, R.NO_TRAVEL),
        (54.999, 30000.01, R.NO_TRAVEL),
        (55, 0, R.NO_TRAVEL),
        (34.999, 999999, R.MODERATE),
    ],
)
def test_exact_load_overrides(wind, load, expected):
    result = summarize(wind=wind, load=load)
    assert result.checkpoints[0].category == expected
    assert result.checkpoints[0].reasons[0].threshold
    assert result.rules_version
    if expected == R.NO_TRAVEL:
        assert not result.eligible and result.average_risk is None


@pytest.mark.parametrize(
    "wind,rain,snow,expected",
    [
        (25, 1.01, 0, R.NO_TRAVEL),
        (0, 1, 0, R.SEVERE),
        (0, 0, 3, R.SEVERE),
        (0, 0, 3.00001, R.NO_TRAVEL),
        (None, 0, 0, R.UNKNOWN),
        (None, 0.6, 0, R.SEVERE),
        (55, None, None, R.NO_TRAVEL),
    ],
)
def test_combination_missing_values_and_hazards(wind, rain, snow, expected):
    result = summarize(wind, rain, snow)
    assert result.checkpoints[0].category == expected
    assert sum(result.miles_by_category.values()) == pytest.approx(113)
    if None in (wind, rain, snow):
        assert not result.eligible and result.average_risk is None
        assert result.unassessed_miles == pytest.approx(113)


def test_conservative_intervals_partial_miles_and_average():
    cp = generate(route(63))
    weather = [
        CheckpointWeather(
            route_id="A",
            checkpoint_id=c.id,
            arrival_at=c.arrival_at,
            wind_mph=w,
            rain_inches_per_hour=0,
            snow_inches_per_hour=0,
            coverage="complete",
            freshness="fresh",
        )
        for c, w in zip(cp.checkpoints, [0, 25, 35, 0])
    ]
    result = RiskService().assess(
        RiskRequest(route=cp, weather=weather, cargo_load_lb=0, duration_seconds=1000)
    )
    assert [i.category for i in result.intervals] == [R.MODERATE, R.HIGH, R.HIGH]
    assert result.miles_by_category[R.MODERATE] == pytest.approx(25)
    assert result.miles_by_category[R.HIGH] == pytest.approx(38)
    assert result.average_risk == pytest.approx((25 + 38 * 2) / 63)


def test_stale_and_invalid_weather():
    assert not summarize(fresh=False).eligible
    cp = generate()
    w = CheckpointWeather(
        route_id="A",
        checkpoint_id=cp.checkpoints[0].id,
        arrival_at=cp.checkpoints[0].arrival_at,
        wind_mph=float("nan"),
        coverage="complete",
        freshness="fresh",
    )
    with pytest.raises(ValidationError):
        RiskRequest(route=cp, weather=[w], cargo_load_lb=0, duration_seconds=100)


def recommender():
    return RecommendationService(None, None, None)


def test_ranking_priorities_no_rounding_and_stable_tie():
    a = summarize(wind=45, route_id="A", duration=100)
    b = summarize(wind=35, route_id="B", duration=2000)
    result = recommender().rank([a, b], 7)
    assert result.recommended_route_id == "B" and result.explanation.code == "fewer_severe_miles"
    a = summarize(route_id="A")
    b = summarize(route_id="B")
    a.miles_by_category[R.SEVERE] = 0.000002
    b.miles_by_category[R.SEVERE] = 0.000001
    assert recommender().rank([a, b], 7).recommended_route_id == "B"
    a = summarize(route_id="A")
    b = summarize(route_id="B")
    assert recommender().rank([b, a], 7).recommended_route_id == "A"


@pytest.mark.parametrize(
    "metric,code",
    [
        ("high", "fewer_high_miles"),
        ("average", "lower_average_risk"),
        ("time", "shorter_travel_time"),
    ],
)
def test_remaining_rank_metrics(metric, code):
    a = summarize(route_id="A")
    b = summarize(route_id="B")
    if metric == "high":
        a.miles_by_category[R.HIGH] = 1
    if metric == "average":
        a.average_risk = 0.00001
    if metric == "time":
        a.duration_seconds = 1001
    result = recommender().rank([a, b], 7)
    assert result.recommended_route_id == "B" and result.explanation.code == code


def test_ineligible_states_and_unassessed_alternative():
    assert recommender().rank([], 7).state == "NO_ELIGIBLE_ROUTE"
    assert recommender().rank([summarize(wind=55)], 7).state == "NO_ELIGIBLE_ROUTE"
    assert recommender().rank([summarize(wind=None)], 7).state == "INCOMPLETE_DATA"
    assert recommender().rank([summarize(fresh=False)], 7).state == "INCOMPLETE_DATA"
    result = recommender().rank([summarize(route_id="A"), summarize(wind=None, route_id="B")], 7)
    assert result.state == "RECOMMENDED" and result.notices and len(result.routes) == 2


@pytest.mark.django_db
def test_owner_cached_recommendation_and_no_provider_requests():
    from tests.test_phase1 import INPUTS, fixture, trip_service

    c = Client()
    token = c.get("/api/v1/session/").json()["csrf_token"]
    with patch(
        "api.routes.trip_routes.get_trip_service", return_value=trip_service(fixture("routes"), [])
    ):
        trip = c.post(
            "/api/v1/trips/", INPUTS, content_type="application/json", HTTP_X_CSRFTOKEN=token
        ).json()
    url = f"/api/v1/trips/{trip['id']}/recommendation/"
    with (
        patch("integrations.http_client.ProviderHTTP.get", side_effect=AssertionError),
        patch(
            "integrations.open_meteo.weather_client.OpenMeteoClient.fetch",
            side_effect=AssertionError,
        ),
    ):
        result = c.get(url)
        assert result.status_code == 200, result.content
        assert result.json()["state"] == "INCOMPLETE_DATA"
        assert c.get(url).json() == result.json()
        other = Client()
        other.get("/api/v1/session/")
        assert other.get(url).status_code == 404
        assert Client().get(url).status_code == 401
        assert "rules_version" in result.json()
        schema = c.get("/api/v1/openapi.json").json()
        assert "/api/v1/trips/{trip_id}/recommendation/" in schema["paths"]


def test_pending_failed_and_version_mismatch():
    from datetime import UTC, datetime
    from uuid import uuid4

    from services.trip.models import TripCreateRequest, TripResponse
    from tests.test_phase1 import INPUTS

    inputs = TripCreateRequest.model_validate(INPUTS)
    trip = TripResponse(
        **inputs.model_dump(), id=uuid4(), created_at=datetime.now(UTC), status="routing"
    )
    service = RecommendationService(None, None, None)
    assert service.recommend(trip).state == "PENDING"
    trip.status = "routing_failed"
    assert service.recommend(trip).state == "NO_ELIGIBLE_ROUTE"
    with pytest.raises(ValueError):
        service.rank([summarize()], 1)
    cp = generate()
    w = CheckpointWeather(
        route_id="A",
        checkpoint_id=cp.checkpoints[0].id,
        arrival_at=cp.checkpoints[-1].arrival_at,
        wind_mph=55,
        rain_inches_per_hour=0,
        snow_inches_per_hour=0,
        coverage="complete",
        freshness="fresh",
    )
    risk = RiskService().assess(
        RiskRequest(route=cp, weather=[w], cargo_load_lb=0, duration_seconds=1000)
    )
    assert risk.checkpoints[0].category == R.UNKNOWN


@pytest.mark.django_db
def test_complete_cached_recommendation_has_no_fetch_or_snapshot_mutation():
    from unittest.mock import Mock

    from persistence.models import RouteSnapshot, Trip
    from tests.test_phase1 import INPUTS, fixture, trip_service

    c = Client()
    token = c.get("/api/v1/session/").json()["csrf_token"]
    with patch(
        "api.routes.trip_routes.get_trip_service", return_value=trip_service(fixture("routes"), [])
    ):
        trip = c.post(
            "/api/v1/trips/", INPUTS, content_type="application/json", HTTP_X_CSRFTOKEN=token
        ).json()
    original = deepcopy(RouteSnapshot.objects.get(trip_id=trip["id"]).data)

    def cached(request, fetch=False):
        assert fetch is False
        rows = [
            CheckpointWeather(
                route_id=r.route_id,
                checkpoint_id=cp.id,
                arrival_at=cp.arrival_at,
                wind_mph=0,
                rain_inches_per_hour=0,
                snow_inches_per_hour=0,
                coverage="complete",
                freshness="fresh",
            )
            for r in request.routes
            for cp in r.checkpoints
        ]
        return WeatherResult(
            analysis_versions={r.route_id: r.analysis_version for r in request.routes},
            checkpoints=rows,
            provider_requests=0,
            unique_locations_requested=0,
            estimated_usage_units=0,
        )

    weather = Mock()
    weather.assess.side_effect = cached
    service = RecommendationService(CheckpointService(), weather, RiskService())
    url = f"/api/v1/trips/{trip['id']}/recommendation/"
    with patch("api.routes.recommendation_routes.get_recommendation_service", return_value=service):
        data = c.get(url).json()
        assert data["state"] == "RECOMMENDED" and data["recommended_route_id"] == "A"
        assert len(data["routes"]) == 3
    assert RouteSnapshot.objects.get(trip_id=trip["id"]).data == original
    assert Trip.objects.get(pk=trip["id"]).status == "routes_ready"
