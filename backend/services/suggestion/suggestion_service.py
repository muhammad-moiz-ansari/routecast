"""Advisory AI text over a frozen analysis; it never feeds back into risk or ranking."""

import json
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from config.risk_rules import BOUNDS, LOAD_NO_TRAVEL_LB, LOAD_SEVERE_LB
from integrations.exceptions import ProviderError
from services.planning.models import AnalysisProjection
from services.recommendation.models import RecommendationResult
from services.weather.models import WeatherResult

from .models import Suggestion, SuggestionResult
from .suggestion_repo import SuggestionRepo

HAZARDS = ("no_travel", "severe", "high", "moderate")
SCHEMA = {
    "type": "object",
    "properties": {
        "suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": ["route", "timing", "cargo", "caution", "data"],
                    },
                    "text": {"type": "string"},
                },
                "required": ["kind", "text"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["suggestions"],
    "additionalProperties": False,
}
# Editable instructions; the facts JSON is appended after the file's text.
PROMPT = Path(__file__).with_name("prompt.txt").read_text(encoding="utf-8").rstrip() + "\n"


def local(value, zone):
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value.astimezone(zone).strftime("%a %d %b %H:%M %Z")


def hazard(checkpoint, w, zone):
    return {
        "checkpoint": checkpoint.checkpoint_id,
        "risk": checkpoint.category.value,
        "local_arrival": local(w.arrival_at, zone) if w else None,
        "wind_mph": getattr(w, "wind_mph", None),
        "rain_in_per_hour": getattr(w, "rain_inches_per_hour", None),
        "snow_in_per_hour": getattr(w, "snow_inches_per_hour", None),
        "reasons": [r.message for r in checkpoint.reasons if not r.code.endswith("_low")],
    }


def facts(projection: AnalysisProjection, now):
    """Summarize published results without coordinates, raw geometry or provider payloads."""
    data = projection.data
    inputs = data["inputs"]
    zone = ZoneInfo(inputs["timezone"])
    rec = RecommendationResult.model_validate(data["recommendation"])
    weather = {
        (w.route_id, w.checkpoint_id): w
        for w in WeatherResult.model_validate(data["weather"]).checkpoints
    }
    stale = projection.routing_stale or projection.weather_stale
    fetched = data.get("weather_fetched_at")
    routes = []
    for route in rec.routes:
        hazards = sorted(
            (c for c in route.checkpoints if c.category in HAZARDS),
            key=lambda c: HAZARDS.index(c.category),
        )[:3]
        routes.append(
            {
                "route": route.route_id,
                "miles": round(route.total_miles, 1),
                "hours": round(route.duration_seconds / 3600, 1),
                "eligible": route.eligible,
                "eligibility_reasons": route.eligibility_reasons,
                "miles_by_risk": {
                    k.value: round(v, 1) for k, v in route.miles_by_category.items() if v > 0
                },
                "unassessed_miles": round(route.unassessed_miles, 1),
                "unknown_checkpoints": sum(c.category == "unknown" for c in route.checkpoints),
                "hazards": [
                    hazard(c, weather.get((route.route_id, c.checkpoint_id)), zone) for c in hazards
                ],
            }
        )
    _, high, severe, no_travel = BOUNDS["wind_mph"]
    return {
        "trip": {
            "departure_local": local(inputs["departure_at"], zone),
            "cargo_load_lb": inputs["cargo_load_lb"],
            "checkpoint_spacing_miles": inputs["checkpoint_spacing_miles"],
        },
        "analysis": {
            "stale": stale,
            "state": "INCOMPLETE_DATA" if stale else rec.state,
            "recommended_route": None if stale else rec.recommended_route_id,
            "previous_recommended_route": rec.recommended_route_id if stale else None,
            "ranking": [] if stale else rec.ranked_route_ids,
            "explanation": rec.explanation.message,
            "notices": rec.notices,
            "forecast_age_minutes": (
                int((now - datetime.fromisoformat(fetched)).total_seconds() // 60)
                if fetched
                else None
            ),
        },
        "routes": routes,
        "cargo_rules": [
            f"Wind {severe}-{no_travel} mph with cargo over {LOAD_NO_TRAVEL_LB} lb is no_travel.",
            f"Wind {high}-{severe} mph with cargo over {LOAD_SEVERE_LB} lb is severe.",
        ],
    }


def parse(raw):
    """Keep at most three valid suggestions; a reply with none is unusable."""
    items = raw.get("suggestions") if isinstance(raw, dict) else None
    kept = []
    for item in items if isinstance(items, list) else []:
        try:
            kept.append(Suggestion.model_validate(item))
        except ValidationError:
            continue
        if len(kept) == 3:
            break
    if not kept:
        raise ProviderError("ai_invalid_response", "The AI provider returned unusable suggestions.")
    return kept


class SuggestionService(SuggestionRepo):
    def __init__(self, client, cache, model, clock=lambda: datetime.now(UTC)):
        self.client = client
        self.cache = cache
        self.model = model
        self.clock = clock

    def suggest(self, projection: AnalysisProjection) -> SuggestionResult:
        """Return cached or newly generated advisory text for one completed analysis version."""
        cached = self.cache.get(projection.trip_id, projection.analysis_version)
        if cached:
            return SuggestionResult.model_validate({**cached, "cached": True})
        now = self.clock()
        prompt = PROMPT + json.dumps(facts(projection, now), separators=(",", ":"))
        result = SuggestionResult(
            analysis_version=projection.analysis_version,
            generated_at=now,
            model=self.model,
            suggestions=parse(self.client.complete_json(prompt, SCHEMA)),
        )
        self.cache.set(
            projection.trip_id, projection.analysis_version, result.model_dump(mode="json")
        )
        return result
