from datetime import UTC, datetime
from math import ceil, isfinite
from threading import BoundedSemaphore

import httpx

from integrations.exceptions import ProviderError
from integrations.provider_budget import reserve_provider_budget
from services.weather.models import ForecastSeries, HourlyForecast

_slots = BoundedSemaphore(2)
FORECAST_DAYS = 16
PAST_DAYS = 1
HOURLY_VARIABLES = ("wind_speed_10m", "rain", "showers", "snowfall")


def normalize(payload, coordinate, fetched_at):
    """Inspect units and retain nulls; hourly accumulation represents the preceding hour."""
    try:
        units, hourly = payload["hourly_units"], payload["hourly"]
        if payload.get("utc_offset_seconds", 0) != 0:
            raise ValueError("Expected UTC")
        times = [datetime.fromtimestamp(t, UTC) for t in hourly["time"]]
        if any((b - a).total_seconds() != 3600 for a, b in zip(times, times[1:])):
            raise ValueError("Non-hourly time axis")
        factors = {
            "wind_speed_10m": {"km/h": 1 / 1.609344, "mp/h": 1, "mph": 1, "m/s": 2.2369362921},
            "rain": {"mm": 1 / 25.4, "inch": 1},
            "showers": {"mm": 1 / 25.4, "inch": 1},
            "snowfall": {"cm": 1 / 2.54, "inch": 1},
        }

        def value(name, index):
            if name not in hourly or name not in units:
                return None
            factor = factors[name][units[name]]
            raw = hourly[name][index]
            if raw is None:
                return None
            if not isfinite(raw) or raw < 0:
                raise ValueError("Invalid weather value")
            return raw * factor

        for name in factors:
            if name in hourly and len(hourly[name]) != len(times):
                raise ValueError("Mismatched arrays")
        rows = []
        for i, at in enumerate(times):
            rain, showers = value("rain", i), value("showers", i)
            rows.append(
                HourlyForecast(
                    at=at,
                    wind_mph=value("wind_speed_10m", i),
                    rain_inches_per_hour=None
                    if rain is None or showers is None
                    else rain + showers,
                    snow_inches_per_hour=value("snowfall", i),
                )
            )
        return ForecastSeries(coordinate=coordinate, fetched_at=fetched_at, hours=rows)
    except (KeyError, TypeError, ValueError, OverflowError, IndexError):
        raise ProviderError(
            "provider_invalid_response", "Forecast response has invalid units or data."
        ) from None


class OpenMeteoClient:
    def __init__(
        self, transport=None, clock=lambda: datetime.now(UTC), budget=reserve_provider_budget
    ):
        self.transport, self.clock = transport, clock
        self.budget = budget

    def fetch(self, coordinates):
        """Fetch up to 50 exact locations once; never retry or extrapolate."""
        if not coordinates or len(coordinates) > 50:
            raise ValueError("Expected 1–50 locations")
        if not _slots.acquire(timeout=1):
            raise ProviderError("provider_busy", "Forecast capacity is busy.")
        try:
            # Round horizon/variable multipliers up per location, not once per batch.
            units = ceil((FORECAST_DAYS + PAST_DAYS) / 14) * ceil(len(HOURLY_VARIABLES) / 10)
            self.budget("open-meteo", units * len(coordinates))
            with httpx.Client(
                timeout=httpx.Timeout(20, connect=3),
                transport=self.transport,
                trust_env=False,
                follow_redirects=False,
            ) as client:
                response = client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": ",".join(str(c.latitude) for c in coordinates),
                        "longitude": ",".join(str(c.longitude) for c in coordinates),
                        "hourly": ",".join(HOURLY_VARIABLES),
                        "timezone": "UTC",
                        "timeformat": "unixtime",
                        "forecast_days": FORECAST_DAYS,
                        "past_days": PAST_DAYS,
                        "wind_speed_unit": "kmh",
                        "precipitation_unit": "mm",
                    },
                )
            if response.status_code == 429:
                retry = response.headers.get("Retry-After", "")
                raise ProviderError(
                    "provider_rate_limit",
                    "Forecast provider limit reached.",
                    429,
                    min(int(retry), 86400) if retry.isdigit() else None,
                )
            if response.status_code != 200:
                raise ProviderError("provider_unavailable", "Forecast provider unavailable.")
            data = response.json()
            items = data if isinstance(data, list) else [data]
            if len(items) != len(coordinates):
                raise ValueError("Location count mismatch")
            return [normalize(p, c, self.clock()) for p, c in zip(items, coordinates)]
        except httpx.TimeoutException:
            raise ProviderError("provider_timeout", "Forecast request timed out.", 504) from None
        except httpx.HTTPError:
            raise ProviderError("provider_unavailable", "Forecast provider unreachable.") from None
        except (ValueError, TypeError):
            raise ProviderError("provider_invalid_response", "Invalid forecast response.") from None
        finally:
            _slots.release()
