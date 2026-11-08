from math import isfinite

from pydantic import BaseModel, ConfigDict, Field, model_validator

from common.enums import RiskCategory
from config.risk_rules import RULES_VERSION
from services.checkpoint.models import CheckpointResult
from services.weather.models import CheckpointWeather


class RiskReason(BaseModel):
    code: str
    observed_value: float
    threshold: str
    units: str
    cargo_load_lb: float | None = None
    message: str


class CheckpointRisk(BaseModel):
    checkpoint_id: str
    category: RiskCategory
    coverage_complete: bool
    fresh: bool
    reasons: list[RiskReason]


class IntervalRisk(BaseModel):
    start_checkpoint_id: str
    end_checkpoint_id: str
    distance_miles: float
    category: RiskCategory
    coverage_complete: bool


class RiskRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    route: CheckpointResult
    weather: list[CheckpointWeather]
    cargo_load_lb: float = Field(ge=0)
    duration_seconds: float = Field(gt=0)

    @model_validator(mode="after")
    def validated_weather(self):
        keys = set()
        for w in self.weather:
            key = (w.route_id, w.checkpoint_id)
            if key in keys:
                raise ValueError("Duplicate checkpoint weather")
            keys.add(key)
            for v in (w.wind_mph, w.rain_inches_per_hour, w.snow_inches_per_hour):
                if v is not None and (not isfinite(v) or v < 0):
                    raise ValueError("Weather must be finite and nonnegative")
        return self


class RouteRiskSummary(BaseModel):
    route_id: str
    analysis_version: int
    rules_version: str = RULES_VERSION
    duration_seconds: float
    total_miles: float
    checkpoints: list[CheckpointRisk]
    intervals: list[IntervalRisk]
    miles_by_category: dict[RiskCategory, float]
    unassessed_miles: float
    average_risk: float | None
    eligible: bool
    eligibility_reasons: list[str]
