from abc import ABC, abstractmethod

from .models import ForecastRequest, WeatherResult


class WeatherRepo(ABC):
    @abstractmethod
    def assess(self, request: ForecastRequest, fetch: bool = False) -> WeatherResult:
        """Match prefetched hourly forecasts to arrival times; fetch only when explicit."""
