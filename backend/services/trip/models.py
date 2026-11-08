from datetime import datetime
from enum import StrEnum
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator

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
