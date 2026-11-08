from ninja import Query, Router

from api.dependencies import get_location_service
from api.models import ERROR_RESPONSES
from api.session import OwnerSessionAuth
from services.location.models import LocationOption, LocationSearchRequest

router = Router(tags=["Locations"], auth=OwnerSessionAuth())


@router.get("/locations/search/", response={200: list[LocationOption], **ERROR_RESPONSES})
def search(request, query: Query[LocationSearchRequest]):
    """Search places without creating trips or selecting a coordinate automatically."""
    return get_location_service().search(query)
