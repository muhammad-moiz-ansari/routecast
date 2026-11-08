from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AnalysisProjection(BaseModel):
    trip_id: str
    input_revision: int
    analysis_id: str | None = None
    analysis_version: int | None = None
    analysis_revision: int | None = None
    status: str
    stage: str
    stopped: bool
    error_code: str | None = None
    completed_at: datetime | None = None
    routing_stale: bool = True
    weather_stale: bool = True
    retained_previous: bool = False
    data: dict[str, Any] | None = None
    retry_after_seconds: int | None = None
