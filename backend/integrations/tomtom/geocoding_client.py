from urllib.parse import quote

from pydantic import ValidationError

from integrations.exceptions import ProviderError
from services.location.models import Coordinate, LocationOption

from .models import SearchResponse


class TomTomGeocodingClient:
    def __init__(self, http):
        self.http = http

    def search(self, request):
        """Search places predictively; users must explicitly select a returned coordinate."""
        data = self.http.get(
            f"/search/2/search/{quote(request.query, safe='')}.json",
            {
                "typeahead": "true",
                "limit": request.limit,
            },
        )
        try:
            result = SearchResponse.model_validate(data)
            return [
                LocationOption(
                    id=p.id,
                    label=p.address.freeformAddress,
                    coordinate=Coordinate(latitude=p.position.lat, longitude=p.position.lon),
                )
                for p in result.results
            ][: request.limit]
        except ValidationError:
            raise ProviderError(
                "provider_invalid_response", "Provider returned invalid place data."
            ) from None
