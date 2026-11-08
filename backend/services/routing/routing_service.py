from datetime import UTC, datetime, timedelta

from integrations.exceptions import ProviderError

from .models import RouteCandidate, RouteGeometry, RouteOptions, RouteRequest
from .routing_repo import RoutingRepo
from .timing import instruction_timing


def geometry_key(points):
    """Ignore duplicate vertices and collinear resampling when identifying equal paths."""
    result = []
    for point in points:
        if result and result[-1] == point:
            continue
        while len(result) >= 2:
            a, b = result[-2:]
            cross = (b[0] - a[0]) * (point[1] - b[1]) - (b[1] - a[1]) * (point[0] - b[0])
            forward = (b[0] - a[0]) * (point[0] - b[0]) + (b[1] - a[1]) * (point[1] - b[1])
            if abs(cross) > 1e-12 or forward < 0:
                break
            result.pop()
        result.append(point)
    return tuple(result)


class RoutingService(RoutingRepo):
    def __init__(self, client, clock=lambda: datetime.now(UTC)):
        self.client, self.clock = client, clock

    def options(self, request: RouteRequest) -> RouteOptions:
        """Normalize full geometry; never repeat provider requests to force alternatives."""
        response = self.client.routes(request)
        routes, seen = [], set()
        for candidate in response.routes:
            # TomTom uses lat/lon objects; GeoJSON must use [longitude, latitude].
            points = [(p.longitude, p.latitude) for leg in candidate.legs for p in leg.points]
            key = geometry_key(points)
            if len(key) < 2 or key in seen:
                continue
            seen.add(key)
            identifier = chr(ord("A") + len(routes))
            try:
                arrival_at = request.departure_at + timedelta(
                    seconds=candidate.summary.travelTimeInSeconds
                )
            except OverflowError:
                raise ProviderError(
                    "provider_invalid_response", "Provider returned an invalid route duration."
                ) from None
            timing_points, timing_notice = instruction_timing(
                candidate.guidance,
                candidate.summary.lengthInMeters,
                candidate.summary.travelTimeInSeconds,
            )
            routes.append(
                RouteCandidate(
                    id=identifier,
                    label=f"Route {identifier}",
                    geometry=RouteGeometry(coordinates=points),
                    distance_meters=candidate.summary.lengthInMeters,
                    duration_seconds=candidate.summary.travelTimeInSeconds,
                    arrival_at=arrival_at,
                    timing_points=timing_points,
                    timing_notice=timing_notice,
                )
            )
            if len(routes) == 3:
                break
        notices = [
            "Truck routing without complete vehicle dimensions cannot validate every restriction."
        ]
        if len(routes) < 3:
            notices.append(
                f"Only {len(routes)} distinct route options were available; three were requested."
            )
        return RouteOptions(
            fetched_at=self.clock(),
            available_route_count=len(routes),
            routes=routes,
            notices=notices,
        )
