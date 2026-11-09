import re
import unicodedata
from urllib.parse import quote

from pydantic import ValidationError

from integrations.exceptions import ProviderError
from services.location.models import Coordinate, LocationOption

from .models import SearchResponse


def words(value):
    """Compare accent-insensitively without changing provider labels or coordinates."""
    folded = unicodedata.normalize("NFKD", value.casefold())
    return re.findall(r"[^\W_]+", "".join(c for c in folded if not unicodedata.combining(c)))


def label_for(place):
    parts = [place.poi.name if place.poi else "", place.address.freeformAddress]
    label = ", ".join(part for part in parts if part)
    country = place.address.country
    if country and not set(words(country)).issubset(words(label)):
        label += ", " + country
    return label


class TomTomGeocodingClient:
    def __init__(self, http):
        self.http = http

    def search(self, request):
        """Search places predictively; users must explicitly select a returned coordinate."""
        data = self.http.get(
            f"/search/2/search/{quote(request.query, safe='')}.json",
            {
                "typeahead": "true",
                # Re-rank a bounded pool without another lookup or a country restriction.
                "limit": max(10, min(20, request.limit * 4)),
            },
        )
        try:
            result = SearchResponse.model_validate(data)
            query = words(request.query)

            def relevance(place):
                tokens = words(
                    " ".join(
                        [
                            label_for(place),
                            place.address.municipality,
                            place.address.countrySubdivision,
                        ]
                    )
                )
                matches = sum(any(t.startswith(q) for t in tokens) for q in query)
                locality = words(place.address.municipality)
                locality_matches = sum(any(t.startswith(q) for t in locality) for q in query)
                return matches, locality_matches

            # Equal textual matches keep their original provider order.
            ranked = sorted(result.results, key=relevance, reverse=True)
            options, seen = [], set()
            for p in ranked:
                label = label_for(p)
                identity = (tuple(words(label)), p.position.lat, p.position.lon)
                if identity in seen:
                    continue
                seen.add(identity)
                options.append(
                    LocationOption(
                        id=p.id,
                        label=label,
                        coordinate=Coordinate(latitude=p.position.lat, longitude=p.position.lon),
                    )
                )
            return options[: request.limit]
        except ValidationError:
            raise ProviderError(
                "provider_invalid_response", "Provider returned invalid place data."
            ) from None
