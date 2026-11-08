from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from services.checkpoint.models import CheckpointResult
from services.location.models import Coordinate


class HourlyForecast(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    at: datetime
    wind_mph: float | None = Field(default=None, ge=0)
    rain_inches_per_hour: float | None = Field(default=None, ge=0)
    snow_inches_per_hour: float | None = Field(default=None, ge=0)


class ForecastSeries(BaseModel):
    coordinate: Coordinate
    fetched_at: datetime
    hours: list[HourlyForecast]


class ForecastRequest(BaseModel):
    routes: list[CheckpointResult]


class CheckpointWeather(BaseModel):
    route_id: str
    checkpoint_id: str
    arrival_at: datetime
    fetched_at: datetime | None = None
    interval_start: datetime | None = None
    interval_end: datetime | None = None
    wind_times: list[datetime] = Field(default_factory=list)
    wind_mph: float | None = None
    rain_inches_per_hour: float | None = None
    snow_inches_per_hour: float | None = None
    coverage: str
    freshness: str


class WeatherResult(BaseModel):
    analysis_versions: dict[str, int] = Field(default_factory=dict)
    checkpoints: list[CheckpointWeather]
    provider_requests: int
    unique_locations_requested: int
    estimated_usage_units: int
