from django.conf import settings
from ninja import NinjaAPI

from api.exceptions import register_errors
from api.routes.analysis_routes import router as analysis_router
from api.routes.checkpoint_routes import router as checkpoint_router
from api.routes.corridor_routes import router as corridor_router
from api.routes.health_routes import router as health_router
from api.routes.location_routes import router as location_router
from api.routes.recommendation_routes import router as recommendation_router
from api.routes.trip_routes import router as trip_router
from api.routes.weather_routes import router as weather_router

api = NinjaAPI(
    title="RouteCast API",
    version="0.1.0",
    urls_namespace="routecast-v1",
    docs_url="/docs" if getattr(settings, "ROUTECAST_API_DOCS", True) else None,
    openapi_url="/openapi.json" if getattr(settings, "ROUTECAST_API_DOCS", True) else None,
)
register_errors(api)
api.add_router("", health_router)
api.add_router("", location_router)
api.add_router("", trip_router)
api.add_router("", checkpoint_router)

api.add_router("", weather_router)

api.add_router("", recommendation_router)

api.add_router("", analysis_router)

api.add_router("", corridor_router)
