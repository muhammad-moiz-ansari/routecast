from datetime import UTC, datetime


def record_weather_usage(cache, locations):
    """Share daily attempt/location counts through the configured Redis cache."""
    day = datetime.now(UTC).date().isoformat()
    for suffix, amount in [
        ("requests", 1),
        ("locations", locations),
        ("estimated_units", locations),
    ]:
        key = f"provider:open-meteo:{day}:{suffix}"
        cache.add(key, 0, 172800)
        cache.incr(key, amount)
