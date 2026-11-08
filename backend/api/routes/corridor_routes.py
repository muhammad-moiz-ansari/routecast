import hashlib
import json
from uuid import UUID

from django.http import HttpResponse
from ninja import Router

from api.dependencies import get_corridor_service
from api.models import ERROR_RESPONSES
from api.session import OwnerSessionAuth

router = Router(tags=["Corridor"], auth=OwnerSessionAuth())


@router.get("/trips/{trip_id}/corridor/", response={200: dict, 304: None, **ERROR_RESPONSES})
def corridor(request, trip_id: UUID, response: HttpResponse):
    """Return the complete cached frame array; slider selection requires no further fetch."""
    result = get_corridor_service().read(request.auth, trip_id)
    etag = '"' + hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest() + '"'
    response["ETag"] = etag
    response["Cache-Control"] = "private, no-cache"
    response["Vary"] = "Cookie"
    if request.headers.get("If-None-Match") == etag:
        return HttpResponse(
            status=304,
            headers={"ETag": etag, "Cache-Control": "private, no-cache", "Vary": "Cookie"},
        )
    return result
