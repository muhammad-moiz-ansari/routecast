from ninja import NinjaAPI

from api.routes.health_routes import router as health_router

api = NinjaAPI(title="RouteCast API", version="0.1.0", urls_namespace="routecast-v1")
api.add_router("", health_router)
