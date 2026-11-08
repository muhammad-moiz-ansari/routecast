from abc import ABC, abstractmethod

from .models import RouteOptions, RouteRequest


class RoutingRepo(ABC):
    @abstractmethod
    def options(self, request: RouteRequest) -> RouteOptions:
        """Retrieve distinct candidate routes, reporting fewer than three honestly."""
