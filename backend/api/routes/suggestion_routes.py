from uuid import UUID

from ninja import Router
from ninja.responses import Status

from api.dependencies import get_planning_service, get_suggestion_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse
from api.session import OwnerSessionAuth
from services.suggestion.models import SuggestionResult

router = Router(tags=["Suggestions"], auth=OwnerSessionAuth())


@router.post(
    "/trips/{trip_id}/suggestions/",
    response={200: SuggestionResult, 409: ErrorResponse, **ERROR_RESPONSES},
)
def suggestions(request, trip_id: UUID):
    """Explicitly request advisory AI text for the owner's current completed analysis."""
    result = get_planning_service().read(request.auth, trip_id)
    if not result.data:
        return Status(409, error_body("assessment_pending", "No completed assessment available."))
    return get_suggestion_service().suggest(result)
