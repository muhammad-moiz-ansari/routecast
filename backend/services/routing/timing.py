"""Validate provider chainage/timing pairs without sorting away provider errors."""

from pydantic import ValidationError

from .models import RouteTimingPoint


def normalize_timing(points, distance, duration):
    """Anchor valid timing to route totals; reject contradictory or nonmonotonic spans."""
    start = RouteTimingPoint(distance_meters=0, cumulative_travel_seconds=0)
    end = RouteTimingPoint(distance_meters=distance, cumulative_travel_seconds=duration)
    normalized = [start]
    for point in points:
        d, t = point.distance_meters, point.cumulative_travel_seconds
        if d > distance or t > duration:
            return []
        previous = normalized[-1]
        if d == previous.distance_meters:
            if t != previous.cumulative_travel_seconds:
                return []
            continue
        if d < previous.distance_meters or t < previous.cumulative_travel_seconds:
            return []
        normalized.append(point)
    if normalized[-1].distance_meters == distance:
        if normalized[-1].cumulative_travel_seconds != duration:
            return []
    else:
        normalized.append(end)
    # Endpoints alone contain no timing information beyond total duration.
    return normalized if len(normalized) > 2 else []


def instruction_timing(guidance, distance, duration):
    """Convert maneuver offsets into typed cumulative timings; invalid input falls back."""
    try:
        instructions = guidance.get("instructions", [])
        points = [
            RouteTimingPoint(
                distance_meters=p["routeOffsetInMeters"],
                cumulative_travel_seconds=p["travelTimeInSeconds"],
            )
            for p in instructions
        ]
        result = normalize_timing(points, distance, duration)
    except (ValidationError, KeyError, TypeError, AttributeError):
        result = []
    if not result:
        return [], "Provider timing absent or invalid; ETA uses proportional distance."
    return result, None
