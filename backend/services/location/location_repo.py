from abc import ABC, abstractmethod

from .models import LocationOption, LocationSearchRequest


class LocationRepo(ABC):
    @abstractmethod
    def search(self, request: LocationSearchRequest) -> list[LocationOption]:
        """Find named places without silently selecting a result."""
