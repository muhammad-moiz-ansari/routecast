from datetime import datetime
from enum import StrEnum
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from common.enums import CheckpointSpacing
from services.routing.models import RouteOptions, RouteRequest


class TripStatus(StrEnum):
    QUEUED = "queued"
    CHECKPOINTS = "checkpoints"
    WEATHER = "weather"
    ASSESSING = "assessing"
    COMPLETE = "complete"
    FAILED = "failed"
    STOPPED = "stopped"
    ROUTING = "routing"
    ROUTES_READY = "routes_ready"
    ROUTING_FAILED = "routing_failed"


class TripCreateRequest(RouteRequest):
    timezone: str = Field(min_length=1, max_length=100)
    cargo_load_lb: float = Field(ge=0)
    checkpoint_spacing_miles: CheckpointSpacing = CheckpointSpacing.TWENTY_FIVE

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Use a valid IANA timezone") from exc
        return value

    @model_validator(mode="after")
    def distinct_endpoints(self):
        if self.origin == self.destination:
            raise ValueError("Origin and destination must differ")
        return self


class TripResponse(TripCreateRequest):
    id: UUID
    created_at: datetime
    status: TripStatus
    analysis_version: int = 1
    route_options: RouteOptions | None = None
    error_code: str | None = None
    analysis_revision: int | None = None
    input_revision: int = 1
    analysis_id: UUID | None = None


class SaveTripRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(default="", max_length=200)


class SavedTripQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=50)
    offset: int = Field(default=0, ge=0)


class SavedTripSummary(BaseModel):
    id: UUID
    title: str
    saved_at: datetime
    departure_at: datetime
    timezone: str
    status: TripStatus


class SavedTripPage(BaseModel):
    items: list[SavedTripSummary]
    next_offset: int | None = None
