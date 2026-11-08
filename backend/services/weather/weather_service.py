from bisect import bisect_left
from datetime import UTC, datetime, timedelta

from .models import CheckpointWeather, ForecastRequest, WeatherResult
from .weather_repo import WeatherRepo


class WeatherService(WeatherRepo):
    def __init__(self, client, cache, usage, clock=lambda: datetime.now(UTC), guard=lambda: None):
        self.client, self.cache, self.usage, self.clock = client, cache, usage, clock
        self.guard = guard

    def assess(self, request: ForecastRequest, fetch: bool = False) -> WeatherResult:
        """Deduplicate checkpoint locations, reuse fresh series and match ETAs independently."""
        coordinates = {}
        for route in request.routes:
            for cp in route.checkpoints:
                c = cp.coordinate
                coordinates[(c.latitude, c.longitude)] = c
        series = {key: self.cache.get(c) for key, c in coordinates.items()}
        now = self.clock()
        missing = [
            key
            for key, s in series.items()
            if s is None or (now - s.fetched_at).total_seconds() > 900
        ]
        requests = locations = 0
        if fetch:
            for offset in range(0, len(missing), 50):
                keys = missing[offset : offset + 50]
                # Account attempts before I/O, including provider errors and multi-location usage.
                self.guard()
                self.usage(len(keys))
                requests += 1
                locations += len(keys)
                batch = self.client.fetch([coordinates[k] for k in keys])
                self.guard()
                for key, s in zip(keys, batch):
                    self.cache.set(s)
                    series[key] = s
        results = []
        for route in request.routes:
            for cp in route.checkpoints:
                s = series[(cp.coordinate.latitude, cp.coordinate.longitude)]
                row = CheckpointWeather(
                    route_id=route.route_id,
                    checkpoint_id=cp.id,
                    arrival_at=cp.arrival_at,
                    coverage="unavailable",
                    freshness="missing",
                )
                if s:
                    row.fetched_at = s.fetched_at
                    row.freshness = (
                        "fresh" if (now - s.fetched_at).total_seconds() <= 900 else "stale"
                    )
                    times = [h.at for h in s.hours]
                    i = bisect_left(times, cp.arrival_at)
                    # Accumulations use (t-1h,t], so an exact-hour ETA uses that ending hour.
                    if i < len(times) and times[i] - timedelta(hours=1) < cp.arrival_at <= times[i]:
                        h = s.hours[i]
                        row.interval_start = h.at - timedelta(hours=1)
                        row.interval_end = h.at
                        row.rain_inches_per_hour = h.rain_inches_per_hour
                        row.snow_inches_per_hour = h.snow_inches_per_hour
                    # Exact timestamps need one wind sample; between hours require both brackets.
                    indices = [i] if i < len(times) and times[i] == cp.arrival_at else [i - 1, i]
                    if all(0 <= j < len(times) for j in indices):
                        row.wind_times = [times[j] for j in indices]
                        winds = [s.hours[j].wind_mph for j in indices]
                        if all(w is not None for w in winds):
                            row.wind_mph = max(winds)
                    values = [row.wind_mph, row.rain_inches_per_hour, row.snow_inches_per_hour]
                    row.coverage = (
                        "complete" if all(v is not None for v in values) else "incomplete"
                    )
                results.append(row)
        return WeatherResult(
            analysis_versions={r.route_id: r.analysis_version for r in request.routes},
            checkpoints=results,
            provider_requests=requests,
            unique_locations_requested=locations,
            estimated_usage_units=locations,
        )
