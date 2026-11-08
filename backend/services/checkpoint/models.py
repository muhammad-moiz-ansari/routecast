from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from common.enums import CheckpointSpacing
from common.time_utils import to_utc
from services.location.models import Coordinate
from services.routing.models import RouteCandidate


class CheckpointRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    route: RouteCandidate
    departure_at: datetime
    spacing_miles: CheckpointSpacing = CheckpointSpacing.TWENTY_FIVE
    analysis_version: int = Field(default=1, ge=1)

    @field_validator("departure_at")
    @classmethod
    def aware_departure(cls, value):
        return to_utc(value)


class Checkpoint(BaseModel):
    id: str
    coordinate: Coordinate
    distance_meters: float = Field(ge=0)
    distance_miles: float = Field(ge=0)
    cumulative_travel_seconds: float = Field(ge=0)
    arrival_at: datetime


class CheckpointInterval(BaseModel):
    start_checkpoint_id: str
    end_checkpoint_id: str
    distance_meters: float = Field(gt=0)
    distance_miles: float = Field(gt=0)


class CheckpointResult(BaseModel):
    route_id: str
    analysis_version: int
    spacing_miles: CheckpointSpacing
    route_distance_meters: float
    polyline_length_meters: float
    distance_method: Literal["provider_distance_scaled_polyline"] = (
        "provider_distance_scaled_polyline"
    )
    eta_method: Literal["provider_timing_interpolation", "proportional_distance"]
    timing_notice: str | None = None
    checkpoints: list[Checkpoint]
    intervals: list[CheckpointInterval]
