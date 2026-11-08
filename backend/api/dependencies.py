"""The explicit composition root: constructing dependencies performs no I/O."""

from cache.redis_client import cache_available
from persistence.stores.health_store import database_available
from services.health.health_repo import HealthRepo
from services.health.health_service import HealthService


def get_health_service() -> HealthRepo:
    """Wire infrastructure probes into the health service."""
    return HealthService(database_available, cache_available)


def get_location_service():
    """Construct the place-search adapter without contacting TomTom."""
    from django.conf import settings

    from integrations.http_client import ProviderHTTP
    from integrations.tomtom.geocoding_client import TomTomGeocodingClient
    from services.location.location_service import LocationService

    return LocationService(TomTomGeocodingClient(ProviderHTTP(settings.TOMTOM_API_KEY)))


def get_trip_service():
    """Compose the trip store and routing service explicitly."""
    from django.conf import settings

    from integrations.http_client import ProviderHTTP
    from integrations.tomtom.routing_client import TomTomRoutingClient
    from persistence.stores.trip_store import TripStore
    from services.routing.routing_service import RoutingService
    from services.trip.trip_service import TripService

    routing = RoutingService(TomTomRoutingClient(ProviderHTTP(settings.TOMTOM_API_KEY)))
    return TripService(TripStore(), routing)
