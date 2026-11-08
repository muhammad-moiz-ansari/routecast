from ninja import NinjaAPI

from api.exceptions import register_errors
from api.routes.health_routes import router as health_router
from api.routes.location_routes import router as location_router
from api.routes.trip_routes import router as trip_router

api = NinjaAPI(title="RouteCast API", version="0.1.0", urls_namespace="routecast-v1")
register_errors(api)
api.add_router("", health_router)
api.add_router("", location_router)
api.add_router("", trip_router)
