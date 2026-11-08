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
    """Compose owner-scoped storage and the queued planning service explicitly."""
    from persistence.stores.trip_store import TripStore
    from services.trip.trip_service import TripService

    return TripService(TripStore(), get_planning_service())


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


def get_recommendation_service():
    """Compose cached weather, checkpoint and risk interfaces; constructing them performs no I/O."""
    from services.recommendation.recommendation_service import RecommendationService
    from services.risk.risk_service import RiskService

    return RecommendationService(get_checkpoint_service(), get_weather_service(), RiskService())


def get_planning_service():
    """Compose the queued workflow and token-owned Redis locks without network I/O."""
    from django.conf import settings
    from redis import Redis

    from cache.locks import RedisLocks
    from integrations.http_client import ProviderHTTP
    from integrations.tomtom.routing_client import TomTomRoutingClient
    from persistence.stores.analysis_store import AnalysisStore
    from persistence.stores.trip_store import TripStore
    from services.planning.planning_service import PlanningService
    from services.recommendation.recommendation_service import RecommendationService
    from services.risk.risk_service import RiskService
    from services.routing.routing_service import RoutingService

    checkpoint = get_checkpoint_service()

    def dispatch(run_id):
        from tasks.planning_tasks import analyze

        analyze.apply_async(args=[run_id], retry=False)

    return PlanningService(
        AnalysisStore(),
        TripStore(),
        RoutingService(TomTomRoutingClient(ProviderHTTP(settings.TOMTOM_API_KEY))),
        checkpoint,
        get_weather_service(),
        lambda weather: RecommendationService(checkpoint, weather, RiskService()),
        RedisLocks(Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=2)),
        dispatch,
        corridor_submit=lambda run_id: get_corridor_service().enqueue(run_id),
    )


def get_refresh_service():
    """Compose the owner-scoped lifecycle coordinator."""
    from django.conf import settings

    from persistence.stores.analysis_store import AnalysisStore
    from services.refresh.refresh_service import RefreshService

    return RefreshService(
        AnalysisStore(),
        get_planning_service(),
        scheduling_enabled=not settings.ROUTECAST_LIVE_TEST_MODE,
        corridor_recover=lambda: get_corridor_service().recover(),
    )


def get_corridor_service():
    """Compose independent corridor storage/cache/provider/lock dependencies without I/O."""
    from django.conf import settings
    from django.core.cache import cache
    from redis import Redis

    from cache.corridor_cache import CorridorCache
    from cache.forecast_cache import ForecastCache
    from cache.locks import RedisLocks
    from cache.provider_usage import record_weather_usage
    from integrations.open_meteo.weather_client import OpenMeteoClient
    from persistence.stores.corridor_store import CorridorStore
    from services.corridor.corridor_service import CorridorService

    def dispatch(job_id):
        from tasks.corridor_tasks import corridor

        corridor.apply_async(args=[job_id], retry=False)

    return CorridorService(
        CorridorStore(),
        OpenMeteoClient(),
        ForecastCache(cache),
        CorridorCache(cache),
        lambda n: record_weather_usage(cache, n),
        RedisLocks(Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=2)),
        dispatch,
        width_miles=settings.CORRIDOR_WIDTH_MILES,
    )
