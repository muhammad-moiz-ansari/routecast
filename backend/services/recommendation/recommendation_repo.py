from abc import ABC, abstractmethod

from services.risk.models import RouteRiskSummary
from services.trip.models import TripResponse

from .models import RecommendationResult


class RecommendationRepo(ABC):
    @abstractmethod
    def recommend(self, trip: TripResponse) -> RecommendationResult:
        """Assess owned stored routes against cached weather without provider requests."""

    @abstractmethod
    def rank(self, routes: list[RouteRiskSummary], analysis_version: int) -> RecommendationResult:
        """Filter eligibility then apply the prescribed lexicographic priority order."""
