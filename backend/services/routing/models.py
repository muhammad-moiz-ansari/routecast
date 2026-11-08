from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from common.time_utils import to_utc
from services.location.models import Coordinate


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    origin: Coordinate
    destination: Coordinate
    departure_at: datetime

    @field_validator("departure_at")
    @classmethod
    def aware_departure(cls, value):
        return to_utc(value)


class RouteGeometry(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[tuple[float, float]] = Field(min_length=2)

    @field_validator("coordinates")
    @classmethod
    def valid_coordinates(cls, values):
        for longitude, latitude in values:
            Coordinate(latitude=latitude, longitude=longitude)
        return values


class RouteTimingPoint(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    distance_meters: float = Field(ge=0)
    cumulative_travel_seconds: float = Field(ge=0)


class RouteCandidate(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    id: str
    label: str
    geometry: RouteGeometry
    distance_meters: float = Field(gt=0)
    duration_seconds: float = Field(gt=0)
    arrival_at: datetime
    timing_points: list[RouteTimingPoint] = Field(default_factory=list)
    timing_notice: str | None = None


class RouteOptions(BaseModel):
    provider: Literal["tomtom"] = "tomtom"
    fetched_at: datetime
    analysis_version: int = 1
    available_route_count: int = Field(ge=0, le=3)
    routes: list[RouteCandidate]
    notices: list[str]
