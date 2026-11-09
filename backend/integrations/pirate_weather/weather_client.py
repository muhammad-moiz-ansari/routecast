from datetime import UTC, datetime, timedelta
from math import isfinite
from threading import BoundedSemaphore

import httpx

from integrations.exceptions import ProviderError
from integrations.provider_budget import reserve_provider_budget
from services.weather.models import ForecastSeries, HourlyForecast

_slots = BoundedSemaphore(2)
MPH_PER_MPS = 2.2369362921
MISSING = -999


def amount(point, name):
    """Absent or sentinel values stay missing; other invalid numbers reject the response."""
    raw = point.get(name)
    if raw is None or raw == MISSING:
        return None
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not isfinite(raw) or raw < 0:
        raise ValueError("Invalid weather value")
    return float(raw)


def normalize(payload, coordinate, fetched_at):
    """Map hour-starting data points onto the shared (t-1h, t] accumulation convention.

    Pirate Weather hourly points begin at `time` and their accumulations cover the hour that
    follows, so a point's rain/snow become the accumulation ending one hour later. Wind is the
    value at each point's own time.
    """
    try:
        if payload["flags"]["units"] != "si":
            raise ValueError("Expected SI units")
        points = payload["hourly"]["data"]
        times = [datetime.fromtimestamp(p["time"], UTC) for p in points]
        if not times or any((b - a).total_seconds() != 3600 for a, b in zip(times, times[1:])):
            raise ValueError("Non-hourly time axis")
        rows = []
        for i in range(len(points) + 1):
            current = points[i] if i < len(points) else None
            previous = points[i - 1] if i else None
            wind = amount(current, "windSpeed") if current else None
            rain = amount(previous, "liquidAccumulation") if previous else None
            snow = amount(previous, "snowAccumulation") if previous else None
            rows.append(
                HourlyForecast(
                    at=times[i] if current else times[-1] + timedelta(hours=1),
                    wind_mph=None if wind is None else wind * MPH_PER_MPS,
                    # SI accumulations are centimetres over one hour: liquid rain and snow depth.
                    rain_inches_per_hour=None if rain is None else rain / 2.54,
                    snow_inches_per_hour=None if snow is None else snow / 2.54,
                )
            )
        return ForecastSeries(coordinate=coordinate, fetched_at=fetched_at, hours=rows)
    except (KeyError, TypeError, ValueError, OverflowError, IndexError, AttributeError):
        raise ProviderError(
            "provider_invalid_response", "Forecast response has invalid units or data."
        ) from None


class PirateWeatherClient:
    name = "pirate-weather"

    def __init__(
        self,
        api_key,
        transport=None,
        clock=lambda: datetime.now(UTC),
        budget=reserve_provider_budget,
    ):
        self.api_key, self.transport, self.clock = api_key, transport, clock
        self.budget = budget

    def fetch(self, coordinates):
        """Fetch up to 50 locations, one call each; never retry or extrapolate."""
        if not coordinates or len(coordinates) > 50:
            raise ValueError("Expected 1–50 locations")
        if not self.api_key:
            raise ProviderError("provider_not_configured", "Pirate Weather is not configured.")
        if not _slots.acquire(timeout=1):
            raise ProviderError("provider_busy", "Forecast capacity is busy.")
        try:
            # The provider bills each location as one call, so reserve the whole batch first.
            self.budget("pirate-weather", len(coordinates))
            results = []
            with httpx.Client(
                base_url="https://api.pirateweather.net",
                timeout=httpx.Timeout(20, connect=3),
                transport=self.transport,
                trust_env=False,
                follow_redirects=False,
            ) as client:
                for c in coordinates:
                    response = client.get(
                        f"/forecast/{self.api_key}/{c.latitude:.4f},{c.longitude:.4f}",
                        params={
                            "units": "si",
                            "extend": "hourly",
                            "version": "2",
                            "exclude": "currently,minutely,daily,alerts",
                        },
                    )
                    self.check(response)
                    results.append(normalize(response.json(), c, self.clock()))
            return results
        except httpx.TimeoutException:
            raise ProviderError("provider_timeout", "Forecast request timed out.", 504) from None
        except httpx.HTTPError:
            raise ProviderError("provider_unavailable", "Forecast provider unreachable.") from None
        except (ValueError, TypeError):
            raise ProviderError("provider_invalid_response", "Invalid forecast response.") from None
        finally:
            _slots.release()

    @staticmethod
    def check(response):
        """Translate documented statuses without exposing the key-bearing URL."""
        if response.status_code in (401, 403):
            raise ProviderError(
                "provider_authentication", "Forecast provider credentials were rejected."
            )
        if response.status_code == 429:
            reset = response.headers.get("Ratelimit-Reset", "")
            raise ProviderError(
                "provider_rate_limit",
                "Forecast provider limit reached.",
                429,
                min(int(reset), 86400) if reset.isdigit() else None,
            )
        if response.status_code == 400:
            raise ProviderError(
                "provider_invalid_request", "Forecast provider rejected the location.", 422
            )
        if response.status_code != 200:
            raise ProviderError("provider_unavailable", "Forecast provider unavailable.")
