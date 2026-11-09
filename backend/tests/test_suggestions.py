"""AI suggestions are advisory, cached per analysis and guarded like other providers."""

import json
from datetime import UTC, datetime

import httpx
import pytest
from django.test import Client

from integrations.exceptions import ProviderError
from integrations.groq.chat_client import GroqChatClient
from persistence.models import ProviderBudget, Trip
from services.planning.models import AnalysisProjection
from services.recommendation.models import RecommendationExplanation, RecommendationResult
from services.risk.models import CheckpointRisk, RiskReason, RouteRiskSummary
from services.suggestion.suggestion_service import SuggestionService, facts, parse
from services.weather.models import CheckpointWeather, WeatherResult

NOW = datetime(2026, 11, 9, 8, 0, tzinfo=UTC)
MODEL = "openai/gpt-oss-20b"


def reason(code, value, message):
    return RiskReason(code=code, observed_value=value, threshold="t", units="mph", message=message)


def projection(stale=False):
    checkpoints = [
        CheckpointRisk(
            checkpoint_id="A-0000",
            category="low",
            coverage_complete=True,
            fresh=True,
            reasons=[reason("wind_mph_low", 10, "wind_mph 10 meets <25: low.")],
        ),
        CheckpointRisk(
            checkpoint_id="A-0025",
            category="severe",
            coverage_complete=True,
            fresh=True,
            reasons=[
                reason("wind_mph_high", 40, "wind_mph 40.0 meets >=35: high."),
                reason("wind_load_severe", 40, "Cargo load override: cargo > 40000 -> severe."),
            ],
        ),
    ]
    route = RouteRiskSummary(
        route_id="A",
        analysis_version=2,
        duration_seconds=7200,
        total_miles=120.04,
        checkpoints=checkpoints,
        intervals=[],
        miles_by_category={"low": 100.0, "severe": 20.04, "high": 0.0},
        unassessed_miles=0,
        average_risk=0.5,
        eligible=True,
        eligibility_reasons=[],
    )
    recommendation = RecommendationResult(
        state="RECOMMENDED",
        analysis_version=2,
        recommended_route_id="A",
        ranked_route_ids=["A"],
        routes=[route],
        explanation=RecommendationExplanation(code="single", message="Only Route A is eligible."),
    )
    weather = WeatherResult(
        checkpoints=[
            CheckpointWeather(
                route_id="A",
                checkpoint_id="A-0025",
                arrival_at=datetime(2026, 11, 9, 10, 0, tzinfo=UTC),
                wind_mph=40.0,
                rain_inches_per_hour=0.0,
                snow_inches_per_hour=0.0,
                coverage="complete",
                freshness="fresh",
            )
        ],
        provider_requests=1,
        unique_locations_requested=1,
        estimated_usage_units=2,
    )
    return AnalysisProjection(
        trip_id="trip-1",
        input_revision=1,
        analysis_version=2,
        status="complete",
        stage="complete",
        stopped=False,
        routing_stale=False,
        weather_stale=stale,
        data={
            "inputs": {
                "origin": {"latitude": 31.52, "longitude": 74.35},
                "destination": {"latitude": 31.42, "longitude": 73.08},
                "departure_at": "2026-11-09T08:00:00Z",
                "timezone": "Asia/Karachi",
                "cargo_load_lb": 42000,
                "checkpoint_spacing_miles": 25,
            },
            "recommendation": recommendation.model_dump(mode="json"),
            "weather": weather.model_dump(mode="json"),
            "weather_fetched_at": "2026-11-09T07:50:00+00:00",
        },
    )


class MemoryCache:
    def __init__(self):
        self.data = {}

    def get(self, trip_id, version):
        return self.data.get((trip_id, version))

    def set(self, trip_id, version, data):
        self.data[(trip_id, version)] = data


def groq(calls, content, status=200, headers=None):
    def respond(request):
        calls.append(request)
        body = {"choices": [{"message": {"content": content}}]}
        return httpx.Response(status, headers=headers or {}, json=body)

    # Budget reservations are exercised separately against the real ledger.
    return GroqChatClient("secret-key", MODEL, httpx.MockTransport(respond), lambda *_: None)


def test_facts_use_local_times_hazards_only_and_exclude_coordinates():
    result = facts(projection(), NOW)
    assert "latitude" not in json.dumps(result) and "31.52" not in json.dumps(result)
    assert result["trip"]["departure_local"] == "Mon 09 Nov 13:00 PKT"
    assert result["analysis"]["recommended_route"] == "A"
    assert result["analysis"]["forecast_age_minutes"] == 10
    route = result["routes"][0]
    assert route["miles"] == 120.0 and route["miles_by_risk"] == {"low": 100.0, "severe": 20.0}
    assert route["hazards"] == [
        {
            "checkpoint": "A-0025",
            "risk": "severe",
            "local_arrival": "Mon 09 Nov 15:00 PKT",
            "wind_mph": 40.0,
            "rain_in_per_hour": 0.0,
            "snow_in_per_hour": 0.0,
            "reasons": [
                "wind_mph 40.0 meets >=35: high.",
                "Cargo load override: cargo > 40000 -> severe.",
            ],
        }
    ]


def test_stale_analysis_withholds_current_recommendation_in_facts():
    result = facts(projection(stale=True), NOW)["analysis"]
    assert result["stale"] is True and result["state"] == "INCOMPLETE_DATA"
    assert result["recommended_route"] is None and result["ranking"] == []
    assert result["previous_recommended_route"] == "A"


def test_groq_is_called_once_per_analysis_with_strict_schema():
    calls = []
    content = json.dumps({"suggestions": [{"kind": "route", "text": " Route A is recommended. "}]})
    service = SuggestionService(groq(calls, content), MemoryCache(), MODEL, clock=lambda: NOW)
    first = service.suggest(projection())
    second = service.suggest(projection())
    assert len(calls) == 1
    assert (first.cached, second.cached) == (False, True)
    assert second.suggestions == first.suggestions
    assert first.suggestions[0].text == "Route A is recommended."
    request = calls[0]
    assert str(request.url) == "https://api.groq.com/openai/v1/chat/completions"
    assert request.headers["Authorization"] == "Bearer secret-key"
    body = json.loads(request.content)
    assert body["model"] == MODEL and body["include_reasoning"] is False
    assert body["response_format"]["json_schema"]["strict"] is True
    assert [m["role"] for m in body["messages"]] == ["user"]
    content = body["messages"][0]["content"]
    # Instructions come from prompt.txt; the facts JSON follows its final "Facts:" line.
    assert content.startswith("You help a truck dispatcher")
    assert content.split("Facts:\n", 1)[1].startswith('{"trip":')
    assert "A-0025" in content


def test_output_keeps_three_valid_suggestions_and_rejects_unusable_replies():
    items = [
        {"kind": "route", "text": "x" * 241},
        {"kind": "weather", "text": "Unsupported kind."},
        *({"kind": "data", "text": f"Tip {i}"} for i in range(5)),
    ]
    assert [s.text for s in parse({"suggestions": items})] == ["Tip 0", "Tip 1", "Tip 2"]
    for raw in ({}, [], {"suggestions": []}, {"suggestions": [{"kind": "route", "text": " "}]}):
        with pytest.raises(ProviderError) as failure:
            parse(raw)
        assert failure.value.code == "ai_invalid_response"
    with pytest.raises(ProviderError) as failure:
        groq([], "not json").complete_json("prompt", {})
    assert failure.value.code == "ai_invalid_response"


@pytest.mark.parametrize(
    ("status", "headers", "code", "http_status"),
    [
        (401, {}, "ai_authentication", 503),
        (429, {"Retry-After": "7"}, "ai_rate_limit", 429),
        (400, {}, "ai_request_rejected", 503),
        (500, {}, "ai_unavailable", 503),
    ],
)
def test_provider_failures_are_sanitized(status, headers, code, http_status):
    with pytest.raises(ProviderError) as failure:
        groq([], "", status, headers).complete_json("prompt", {})
    assert (failure.value.code, failure.value.status) == (code, http_status)
    assert "secret-key" not in failure.value.message
    assert failure.value.retry_after_seconds == (7 if status == 429 else None)


@pytest.mark.django_db(transaction=True)
def test_missing_key_and_exhausted_budget_block_before_http(settings):
    calls = []
    transport = httpx.MockTransport(lambda request: calls.append(request))
    with pytest.raises(ProviderError) as failure:
        GroqChatClient("", MODEL, transport).complete_json("prompt", {})
    assert failure.value.code == "ai_not_configured"
    settings.PROVIDER_BUDGETS = {"groq": {"minute": 0, "hour": 1, "day": 1, "month": 1}}
    with pytest.raises(ProviderError) as failure:
        GroqChatClient("secret-key", MODEL, transport).complete_json("prompt", {})
    assert failure.value.code == "provider_budget_exhausted" and failure.value.status == 429
    assert not calls
    assert ProviderBudget.objects.get(pk="groq").windows == {}


@pytest.mark.django_db
def test_api_requires_owner_csrf_and_completed_analysis():
    c = Client(enforce_csrf_checks=True)
    token = c.get("/api/v1/session/").json()["csrf_token"]
    trip = Trip.objects.create(owner_id=c.session["owner_id"], inputs={})
    url = f"/api/v1/trips/{trip.id}/suggestions/"
    assert c.post(url).status_code == 403
    response = c.post(url, HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 409 and response.json()["code"] == "assessment_pending"
    other = Client(enforce_csrf_checks=True)
    other_token = other.get("/api/v1/session/").json()["csrf_token"]
    assert other.post(url, HTTP_X_CSRFTOKEN=other_token).status_code == 404
