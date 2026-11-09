import hashlib

from services.weather.models import ForecastSeries


class ForecastCache:
    def __init__(self, cache, prefix="forecast:v1:"):
        # A separate prefix per provider keeps one provider's series from being reused as another's.
        self.cache, self.prefix = cache, prefix

    def key(self, coordinate):
        # Exact coordinates preserve classification locations; never round spatial cells.
        value = f"{float(coordinate.latitude)}:{float(coordinate.longitude)}"
        return self.prefix + hashlib.sha256(value.encode()).hexdigest()

    def get(self, coordinate):
        data = self.cache.get(self.key(coordinate))
        return ForecastSeries.model_validate(data) if data else None

    def set(self, series):
        # Retain stale series for truthful display; freshness is checked separately.
        self.cache.set(self.key(series.coordinate), series.model_dump(mode="json"), 86400)
