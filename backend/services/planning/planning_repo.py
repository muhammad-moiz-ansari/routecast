from abc import ABC, abstractmethod
from uuid import UUID

from services.trip.models import TripCreateRequest, TripResponse

from .models import AnalysisProjection


class PlanningRepo(ABC):
    @abstractmethod
    def create(self, owner_id: UUID, inputs: TripCreateRequest) -> TripResponse:
        """Persist a trip and queue its initial analysis after commit."""

    @abstractmethod
    def execute(self, run_id: UUID) -> None:
        """Build a candidate snapshot and publish only while its revision/lease is current."""

    @abstractmethod
    def read(self, owner_id: UUID, trip_id: UUID) -> AnalysisProjection:
        """Read completed stored analysis and processing status without provider calls."""
