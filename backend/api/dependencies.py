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


def get_checkpoint_service():
    """Compose the pure checkpoint calculator; no infrastructure clients are needed."""
    from services.checkpoint.checkpoint_service import CheckpointService

    return CheckpointService()


def get_weather_service():
    """Wire the forecast adapter, Redis cache and shared usage accounting without I/O."""
    from django.core.cache import cache

    from cache.forecast_cache import ForecastCache
    from cache.provider_usage import record_weather_usage
    from integrations.open_meteo.weather_client import OpenMeteoClient
    from services.weather.weather_service import WeatherService

    return WeatherService(
        OpenMeteoClient(), ForecastCache(cache), lambda n: record_weather_usage(cache, n)
    )
