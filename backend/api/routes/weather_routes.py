from uuid import UUID

from ninja import Router
from ninja.responses import Status

from api.dependencies import get_planning_service, get_refresh_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse
from api.session import OwnerSessionAuth
from services.refresh.models import RefreshResult
from services.weather.models import WeatherResult

router = Router(tags=["Weather"], auth=OwnerSessionAuth())


@router.get(
    "/trips/{trip_id}/weather/",
    response={
        200: WeatherResult,
        409: ErrorResponse,
        **{k: v for k, v in ERROR_RESPONSES.items() if k != 429},
    },
)
def weather(request, trip_id: UUID):
    """Read frozen matched forecasts; live freshness is exposed by the analysis endpoint."""
    result = get_planning_service().read(request.auth, trip_id)
    if not result.data:
        return Status(409, error_body("assessment_pending", "No completed assessment available."))
    weather = WeatherResult.model_validate(result.data["weather"])
    if result.weather_stale:
        for checkpoint in weather.checkpoints:
            if checkpoint.freshness != "missing":
                checkpoint.freshness = "stale"
    return weather


@router.post(
    "/trips/{trip_id}/weather/prefetch/",
    response={
        202: RefreshResult,
        409: ErrorResponse,
        429: ErrorResponse,
        **{k: v for k, v in ERROR_RESPONSES.items() if k != 429},
    },
)
def prefetch(request, trip_id: UUID):
    """Queue the coordinated refresh; never mutate a published assessment in this request."""
    result = get_refresh_service().refresh(request.auth, trip_id)
    if result.stopped:
        return Status(409, error_body("trip_stopped", "Trip is stopped."))
    if result.retry_after_seconds:
        return Status(
            429,
            error_body(
                "refresh_cooldown",
                "Wait before refreshing again.",
                retry_after_seconds=result.retry_after_seconds,
            ),
        )
    return Status(202, result)
