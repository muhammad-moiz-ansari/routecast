from typing import Literal

from pydantic import BaseModel, Field

from config.risk_rules import RULES_VERSION
from services.risk.models import RouteRiskSummary


class RecommendationExplanation(BaseModel):
    code: str
    message: str


class RecommendationResult(BaseModel):
    state: Literal["RECOMMENDED", "NO_ELIGIBLE_ROUTE", "INCOMPLETE_DATA", "PENDING"]
    analysis_version: int
    rules_version: str = RULES_VERSION
    recommended_route_id: str | None = None
    ranked_route_ids: list[str] = Field(default_factory=list)
    routes: list[RouteRiskSummary] = Field(default_factory=list)
    explanation: RecommendationExplanation
    notices: list[str] = Field(default_factory=list)
