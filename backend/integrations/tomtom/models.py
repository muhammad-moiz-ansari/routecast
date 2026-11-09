"""Provider transport shapes tolerate extra fields but validate required quantities."""

from pydantic import BaseModel, ConfigDict, Field


class Point(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class Summary(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    lengthInMeters: float = Field(gt=0)
    travelTimeInSeconds: float = Field(gt=0)


class Leg(BaseModel):
    points: list[Point] = Field(min_length=2)


class ProviderRoute(BaseModel):
    guidance: dict = Field(default_factory=dict)
    summary: Summary
    legs: list[Leg] = Field(min_length=1)


class RoutingResponse(BaseModel):
    routes: list[ProviderRoute]


class Address(BaseModel):
    freeformAddress: str
    municipality: str = ""
    countrySubdivision: str = ""
    country: str = ""


class POI(BaseModel):
    name: str = ""


class SearchPoint(BaseModel):
    lat: float
    lon: float


class Place(BaseModel):
    id: str
    address: Address
    position: SearchPoint
    poi: POI | None = None


class SearchResponse(BaseModel):
    results: list[Place]
