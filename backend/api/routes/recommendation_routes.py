from uuid import UUID

from ninja import Router

from api.dependencies import get_planning_service
from api.models import ERROR_RESPONSES
from api.session import OwnerSessionAuth
from services.recommendation.models import RecommendationExplanation, RecommendationResult

router = Router(tags=["Recommendation"], auth=OwnerSessionAuth())


@router.get(
    "/trips/{trip_id}/recommendation/", response={200: RecommendationResult, **ERROR_RESPONSES}
)
def recommendation(request, trip_id: UUID):
    """Read the published recommendation, retaining old data during refresh/failure."""
    result = get_planning_service().read(request.auth, trip_id)
    if result.data:
        recommendation = RecommendationResult.model_validate(result.data["recommendation"])
        recommendation.retained_previous = result.retained_previous
        if result.routing_stale or result.weather_stale:
            recommendation.stale = True
            recommendation.previous_recommended_route_id = recommendation.recommended_route_id
            recommendation.recommended_route_id = None
            recommendation.ranked_route_ids = []
            recommendation.state = "INCOMPLETE_DATA"
            recommendation.notices.append(
                "Showing a previous assessment; data or trip inputs are stale."
            )
            for route in recommendation.routes:
                route.eligible = False
                route.average_risk = None
                route.eligibility_reasons.append("stale_analysis")
                for checkpoint in route.checkpoints:
                    checkpoint.fresh = False
        return recommendation
    return RecommendationResult(
        state="PENDING" if result.status in ("queued", "running") else "NO_ELIGIBLE_ROUTE",
        analysis_version=result.analysis_version or 0,
        explanation=RecommendationExplanation(
            code="assessment_pending", message="No completed assessment is available."
        ),
    )
