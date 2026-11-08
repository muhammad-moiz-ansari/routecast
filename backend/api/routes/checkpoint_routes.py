from uuid import UUID

from ninja import Query, Router
from ninja.responses import Status
from pydantic import BaseModel, Field

from api.dependencies import get_planning_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse
from api.session import OwnerSessionAuth
from services.checkpoint.models import CheckpointResult

router = Router(tags=["Checkpoints"], auth=OwnerSessionAuth())


class CheckpointQuery(BaseModel):
    route_id: str = Field(min_length=1, max_length=32)


@router.get(
    "/trips/{trip_id}/checkpoints/",
    response={200: CheckpointResult, 409: ErrorResponse, **ERROR_RESPONSES},
)
def checkpoints(request, trip_id: UUID, query: Query[CheckpointQuery]):
    """Read stored checkpoint geometry/timing from one published analysis version."""
    result = get_planning_service().read(request.auth, trip_id)
    if not result.data:
        return Status(409, error_body("assessment_pending", "No completed assessment available."))
    data = result.data["checkpoints"].get(query.route_id)
    return data if data else Status(404, error_body("route_not_found", "Route not found."))
