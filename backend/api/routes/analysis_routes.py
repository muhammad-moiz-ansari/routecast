import hashlib
import json
from uuid import UUID

from django.http import HttpResponse
from ninja import Router
from ninja.responses import Status

from api.dependencies import get_planning_service, get_refresh_service
from api.exceptions import error_body
from api.models import ERROR_RESPONSES, ErrorResponse
from api.session import OwnerSessionAuth
from services.planning.models import AnalysisProjection
from services.refresh.models import RefreshResult

router = Router(tags=["Analysis lifecycle"], auth=OwnerSessionAuth())


@router.get(
    "/trips/{trip_id}/analysis/",
    response={
        200: AnalysisProjection,
        304: None,
        **{k: v for k, v in ERROR_RESPONSES.items() if k != 429},
    },
)
def analysis(request, trip_id: UUID, response: HttpResponse):
    """Poll immutable published data and changing status; polling never maintains activity."""
    result = get_planning_service().read(request.auth, trip_id)
    body = result.model_dump(mode="json")
    etag = '"' + hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest() + '"'
    response["ETag"] = etag
    response["Cache-Control"] = "private, no-cache"
    response["Vary"] = "Cookie"
    if request.headers.get("If-None-Match") == etag:
        return HttpResponse(
            status=304,
            headers={"ETag": etag, "Cache-Control": "private, no-cache", "Vary": "Cookie"},
        )
    return result


@router.post(
    "/trips/{trip_id}/heartbeat/",
    response={200: dict, **{k: v for k, v in ERROR_RESPONSES.items() if k != 429}},
)
def heartbeat(request, trip_id: UUID, response: HttpResponse):
    """Explicit owner viewer activity; CSRF protection is supplied by cookie auth."""
    get_refresh_service().heartbeat(request.auth, trip_id)
    response["Cache-Control"] = "no-store"
    return {"status": "ok"}


@router.post(
    "/trips/{trip_id}/refresh/",
    response={
        202: RefreshResult,
        409: ErrorResponse,
        429: ErrorResponse,
        **{k: v for k, v in ERROR_RESPONSES.items() if k != 429},
    },
)
def refresh(request, trip_id: UUID):
    """Coalesce requests and expose manual cooldown instead of duplicating provider work."""
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


@router.post(
    "/trips/{trip_id}/stop/",
    response={200: RefreshResult, **{k: v for k, v in ERROR_RESPONSES.items() if k != 429}},
)
def stop(request, trip_id: UUID):
    """Stop refresh and invalidate queued/running candidates without losing completed data."""
    return get_refresh_service().stop(request.auth, trip_id)
