import hashlib

from services.weather.models import ForecastSeries


class ForecastCache:
    def __init__(self, cache):
        self.cache = cache

    def key(self, coordinate):
        # Exact coordinates preserve classification locations; never round spatial cells.
        value = f"{float(coordinate.latitude)}:{float(coordinate.longitude)}"
        return "forecast:v1:" + hashlib.sha256(value.encode()).hexdigest()

    def get(self, coordinate):
        data = self.cache.get(self.key(coordinate))
        return ForecastSeries.model_validate(data) if data else None

    def set(self, series):
        # Retain stale series for truthful display; freshness is checked separately.
        self.cache.set(self.key(series.coordinate), series.model_dump(mode="json"), 86400)
