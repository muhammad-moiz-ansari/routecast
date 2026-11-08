from abc import ABC, abstractmethod

from .models import RiskRequest, RouteRiskSummary


class RiskRepo(ABC):
    @abstractmethod
    def assess(self, request: RiskRequest) -> RouteRiskSummary:
        """Classify checkpoint conditions and summarize conservative interval mileage."""
