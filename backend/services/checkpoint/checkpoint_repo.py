from abc import ABC, abstractmethod

from .models import CheckpointRequest, CheckpointResult


class CheckpointRepo(ABC):
    @abstractmethod
    def generate(self, request: CheckpointRequest) -> CheckpointResult:
        """Sample a route and estimate checkpoint arrival times without provider I/O."""
