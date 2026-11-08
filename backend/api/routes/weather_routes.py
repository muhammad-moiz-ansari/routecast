from uuid import UUID

from ninja import Router
from ninja.responses import Status

from api.dependencies import get_checkpoint_service, get_trip_service, get_weather_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse
from api.session import OwnerSessionAuth
from services.checkpoint.checkpoint_service import CheckpointGeometryError
from services.checkpoint.models import CheckpointRequest
from services.weather.models import ForecastRequest, WeatherResult

router = Router(tags=["Weather"], auth=OwnerSessionAuth())


def project(request, trip_id, fetch):
    trip = get_trip_service().get(request.auth, trip_id)
    if trip.route_options is None:
        return Status(409, error_body("routes_unavailable", "No completed routes available."))
    try:
        routes = [
            get_checkpoint_service().generate(
                CheckpointRequest(
                    route=r,
                    departure_at=trip.departure_at,
                    spacing_miles=trip.checkpoint_spacing_miles,
                    analysis_version=trip.route_options.analysis_version,
                )
            )
            for r in trip.route_options.routes
        ]
    except CheckpointGeometryError as exc:
        return Status(409, error_body("checkpoint_geometry_unavailable", str(exc)))
    return get_weather_service().assess(ForecastRequest(routes=routes), fetch=fetch)


@router.get(
    "/trips/{trip_id}/weather/",
    response={200: WeatherResult, 409: ErrorResponse, **ERROR_RESPONSES},
)
def weather(request, trip_id: UUID):
    """Read cached checkpoint weather; never fetch providers from a projection GET."""
    return project(request, trip_id, False)


@router.post(
    "/trips/{trip_id}/weather/prefetch/",
    response={200: WeatherResult, 409: ErrorResponse, **ERROR_RESPONSES},
)
def prefetch(request, trip_id: UUID):
    """Explicitly prefetch route-checkpoint forecasts; cookie auth enforces CSRF."""
    return project(request, trip_id, True)
