from pydantic import ValidationError

from integrations.exceptions import ProviderError

from .models import RoutingResponse


class TomTomRoutingClient:
    def __init__(self, http):
        self.http = http

    def routes(self, request):
        """Request one primary plus two alternatives; cargo is not gross vehicle weight."""
        origin, destination = request.origin, request.destination
        path = (
            f"/routing/1/calculateRoute/{origin.latitude},{origin.longitude}:"
            f"{destination.latitude},{destination.longitude}/json"
        )
        data = self.http.get(
            path,
            {
                "travelMode": "truck",
                "maxAlternatives": 2,
                "routeRepresentation": "polyline",
                "instructionsType": "coded",
                "departAt": request.departure_at.isoformat(),
                "traffic": "true",
            },
        )
        try:
            return RoutingResponse.model_validate(data)
        except ValidationError:
            raise ProviderError(
                "provider_invalid_response", "Provider returned invalid route data."
            ) from None
