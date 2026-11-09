from datetime import datetime

from pydantic import BaseModel, Field

from services.location.models import Coordinate
from services.routing.models import RouteCandidate


class CorridorRequest(BaseModel):
    routes: list[RouteCandidate] = Field(max_length=3)
    width_miles: float = Field(default=10, gt=0, le=100)
    spacing_miles: float = Field(default=10, gt=0)


class CorridorSample(BaseModel):
    id: str
    coordinate: Coordinate


class CorridorGrid(BaseModel):
    samples: list[CorridorSample]
    width_miles: float
    along_spacing_meters: float
    cross_spacing_meters: float
    sample_cap: int = 100
    method: str = "spherical_tube_union"


class CorridorDataset(BaseModel):
    dataset_id: str
    analysis_version: int
    anchor_at: datetime
    fetched_at: datetime | None
    timestamps: list[datetime]
    grid: CorridorGrid
    values: dict[str, list[list[float | None]]]
    missing: dict[str, list[list[bool]]]
    units: dict[str, str]
    coverage: str
    notices: list[str]
    provider: str = "open-meteo"
