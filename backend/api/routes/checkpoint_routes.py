from uuid import UUID

from ninja import Query, Router
from ninja.responses import Status
from pydantic import BaseModel, ConfigDict, Field

from api.dependencies import get_checkpoint_service, get_trip_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse
from api.session import OwnerSessionAuth
from services.checkpoint.checkpoint_service import CheckpointGeometryError
from services.checkpoint.models import CheckpointRequest, CheckpointResult

router = Router(tags=["Checkpoints"], auth=OwnerSessionAuth())


class CheckpointQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    route_id: str = Field(min_length=1, max_length=32)


@router.get(
    "/trips/{trip_id}/checkpoints/",
    response={200: CheckpointResult, 409: ErrorResponse, **ERROR_RESPONSES},
)
def checkpoints(request, trip_id: UUID, query: Query[CheckpointQuery]):
    """Project an owned route snapshot without fetching or changing provider data."""
    trip = get_trip_service().get(request.auth, trip_id)
    if trip.route_options is None:
        return Status(
            409, error_body("routes_unavailable", "No completed route snapshot is available.")
        )
    route = next((r for r in trip.route_options.routes if r.id == query.route_id), None)
    if route is None:
        return Status(404, error_body("route_not_found", "Route not found."))
    try:
        return get_checkpoint_service().generate(
            CheckpointRequest(
                route=route,
                departure_at=trip.departure_at,
                spacing_miles=trip.checkpoint_spacing_miles,
                analysis_version=trip.route_options.analysis_version,
            )
        )
    except CheckpointGeometryError as exc:
        return Status(409, error_body("checkpoint_geometry_unavailable", str(exc)))
