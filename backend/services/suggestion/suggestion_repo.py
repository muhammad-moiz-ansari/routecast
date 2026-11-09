from abc import ABC, abstractmethod

from services.planning.models import AnalysisProjection

from .models import SuggestionResult


class SuggestionRepo(ABC):
    @abstractmethod
    def suggest(self, projection: AnalysisProjection) -> SuggestionResult:
        """Return cached or newly generated advisory text for one completed analysis version."""
