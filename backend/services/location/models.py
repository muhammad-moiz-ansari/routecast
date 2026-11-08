from pydantic import BaseModel, ConfigDict, Field


class Coordinate(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class LocationSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    query: str = Field(min_length=2, max_length=200)
    limit: int = Field(default=5, ge=1, le=10)


class LocationOption(BaseModel):
    id: str
    label: str
    coordinate: Coordinate
