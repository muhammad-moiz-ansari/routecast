from ninja import Router
from ninja.responses import Status

from api.dependencies import get_health_service
from services.health.models import HealthStatus, ReadinessStatus

router = Router(tags=["Operations"])


@router.get("/health/", response=HealthStatus, auth=None)
def health(request):
    """Lightweight liveness; does not contact the database, cache, or providers."""
    return get_health_service().health()


@router.get("/ready/", response={200: ReadinessStatus, 503: ReadinessStatus}, auth=None)
def ready(request):
    """Readiness checks local infrastructure only; errors expose no credentials."""
    result = get_health_service().readiness()
    return Status(200 if result.status == "ready" else 503, result)
