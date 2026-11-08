from bisect import bisect_right
from datetime import timedelta
from math import isclose

from common.geo_utils import interpolate_arc, segment_length
from common.units import meters_to_miles
from services.location.models import Coordinate
from services.routing.timing import normalize_timing

from .checkpoint_repo import CheckpointRepo
from .models import Checkpoint, CheckpointInterval, CheckpointRequest, CheckpointResult


class CheckpointGeometryError(ValueError):
    """Stored geometry cannot be sampled as a usable bounded route."""


class CheckpointService(CheckpointRepo):
    def generate(self, request: CheckpointRequest) -> CheckpointResult:
        """Interpolate full geometry and cumulative timing, preserving endpoints and totals."""
        route = request.route
        points, chainage = [route.geometry.coordinates[0]], [0.0]
        for point in route.geometry.coordinates[1:]:
            length = segment_length(points[-1], point)
            if length > 1e-8:
                points.append(point)
                chainage.append(chainage[-1] + length)
        total = chainage[-1]
        if total <= 0:
            raise CheckpointGeometryError("Route geometry has no measurable length.")
        spacing = request.spacing_miles.value * 1609.344
        if route.distance_meters / spacing > 10000:
            raise CheckpointGeometryError("Route exceeds the 10000-interval sampling limit.")
        distances = [0.0]
        index = 1
        while index * spacing < route.distance_meters:
            distance = index * spacing
            if isclose(distance, route.distance_meters, rel_tol=1e-12, abs_tol=1e-8):
                break
            distances.append(distance)
            index += 1
        distances.append(route.distance_meters)
        timings = normalize_timing(
            route.timing_points, route.distance_meters, route.duration_seconds
        )
        method = "provider_timing_interpolation" if timings else "proportional_distance"
        notice = (
            None
            if timings
            else (
                route.timing_notice
                or "Provider timing absent or invalid; ETA uses proportional distance."
            )
        )
        time_distances = [p.distance_meters for p in timings]
        checkpoints = []
        for index, distance in enumerate(distances):
            # Scale spherical polyline chainage to provider road distance so maneuver
            # offsets, endpoint duration, spacing and later risk mileage share one axis.
            target = total * (distance / route.distance_meters)
            span = min(max(bisect_right(chainage, target) - 1, 0), len(points) - 2)
            fraction = (target - chainage[span]) / (chainage[span + 1] - chainage[span])
            try:
                lon, lat = interpolate_arc(points[span], points[span + 1], fraction)
            except ValueError as exc:
                raise CheckpointGeometryError(str(exc)) from exc
            if index == 0:
                lon, lat = points[0]
            elif index == len(distances) - 1:
                lon, lat = points[-1]
            if timings:
                tspan = min(max(bisect_right(time_distances, distance) - 1, 0), len(timings) - 2)
                left, right = timings[tspan : tspan + 2]
                ratio = (distance - left.distance_meters) / (
                    right.distance_meters - left.distance_meters
                )
                # Interpolate cumulative travel time inside the applicable provider span.
                seconds = left.cumulative_travel_seconds + ratio * (
                    right.cumulative_travel_seconds - left.cumulative_travel_seconds
                )
            else:
                seconds = route.duration_seconds * distance / route.distance_meters
            if index == 0:
                seconds = 0.0
            elif index == len(distances) - 1:
                seconds = route.duration_seconds
            try:
                arrival = request.departure_at + timedelta(seconds=seconds)
            except OverflowError as exc:
                raise CheckpointGeometryError(
                    "Route arrival is outside the supported date range."
                ) from exc
            checkpoints.append(
                Checkpoint(
                    id=f"{route.id}-{index:04d}",
                    coordinate=Coordinate(latitude=lat, longitude=lon),
                    distance_meters=distance,
                    distance_miles=meters_to_miles(distance),
                    cumulative_travel_seconds=seconds,
                    arrival_at=arrival,
                )
            )
        intervals = [
            CheckpointInterval(
                start_checkpoint_id=a.id,
                end_checkpoint_id=b.id,
                distance_meters=b.distance_meters - a.distance_meters,
                distance_miles=meters_to_miles(b.distance_meters - a.distance_meters),
            )
            for a, b in zip(checkpoints, checkpoints[1:])
        ]
        return CheckpointResult(
            route_id=route.id,
            analysis_version=request.analysis_version,
            spacing_miles=request.spacing_miles,
            route_distance_meters=route.distance_meters,
            polyline_length_meters=total,
            eta_method=method,
            timing_notice=notice,
            checkpoints=checkpoints,
            intervals=intervals,
        )
