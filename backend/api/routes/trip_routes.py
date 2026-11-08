from uuid import UUID

from django.http import HttpResponse
from django.middleware.csrf import get_token
from ninja import Router
from ninja.responses import Status

from api.dependencies import get_refresh_service, get_trip_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse, SessionResponse
from api.session import OwnerSessionAuth, establish_owner
from common.exceptions import InvalidDeparture
from services.refresh.models import RefreshResult
from services.routing.models import RouteOptions
from services.trip.models import TripCreateRequest, TripResponse

router = Router(tags=["Trips"], auth=OwnerSessionAuth())


@router.get("/session/", auth=None, response=SessionResponse)
def session(request, response: HttpResponse):
    """Bootstrap the anonymous session and CSRF token for same-origin clients."""
    establish_owner(request)
    response["Cache-Control"] = "no-store"
    return {"csrf_token": get_token(request)}


@router.post("/trips/", response={202: TripResponse, **ERROR_RESPONSES})
def create(request, payload: TripCreateRequest):
    """Persist a trip and return its queued analysis identifier without provider I/O."""
    try:
        return Status(202, get_trip_service().create(request.auth, payload))
    except InvalidDeparture:
        return Status(
            422,
            error_body(
                "validation_error",
                "Departure must not be in the past.",
                field_errors=[{"field": "departure_at", "message": "Use a future departure."}],
            ),
        )


@router.get("/trips/{trip_id}/", response={200: TripResponse, **ERROR_RESPONSES})
def detail(request, trip_id: UUID):
    """Read persisted inputs and route-processing status for this session only."""
    return get_trip_service().get(request.auth, trip_id)


@router.get(
    "/trips/{trip_id}/routes/", response={200: RouteOptions, 409: ErrorResponse, **ERROR_RESPONSES}
)
def routes(request, trip_id: UUID):
    """Read the stored snapshot; repeated reads never request fresh routes."""
    trip = get_trip_service().get(request.auth, trip_id)
    if trip.route_options is None:
        return Status(
            409, error_body("routes_unavailable", "No completed route snapshot is available.")
        )
    return trip.route_options


@router.patch(
    "/trips/{trip_id}/",
    response={
        202: RefreshResult,
        409: ErrorResponse,
        **{k: v for k, v in ERROR_RESPONSES.items() if k != 429},
    },
)
def update(request, trip_id: UUID, payload: TripCreateRequest):
    """Replace the complete input document and queue a fenced new revision."""
    try:
        result = get_refresh_service().update(request.auth, trip_id, payload)
    except InvalidDeparture:
        return Status(422, error_body("validation_error", "Use a future departure."))
    if result.stopped:
        return Status(409, error_body("trip_stopped", "Trip is stopped."))
    return Status(202, result)
