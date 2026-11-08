from uuid import UUID

from ninja import Router
from ninja.responses import Status
from pydantic import ValidationError

from api.dependencies import get_recommendation_service, get_trip_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse
from api.session import OwnerSessionAuth
from services.checkpoint.checkpoint_service import CheckpointGeometryError
from services.recommendation.models import RecommendationResult

router = Router(tags=["Recommendation"], auth=OwnerSessionAuth())


@router.get(
    "/trips/{trip_id}/recommendation/",
    response={200: RecommendationResult, 409: ErrorResponse, **ERROR_RESPONSES},
)
def recommendation(request, trip_id: UUID):
    """Return an owner-scoped recommendation using cached forecasts only."""
    trip = get_trip_service().get(request.auth, trip_id)
    try:
        return get_recommendation_service().recommend(trip)
    except (CheckpointGeometryError, ValidationError, ValueError):
        return Status(
            409,
            error_body(
                "assessment_unavailable",
                "Stored assessment inputs are inconsistent or unavailable.",
            ),
        )
