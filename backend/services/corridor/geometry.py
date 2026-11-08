"""Curvilinear tube grid: spherical distances/bearings, never degree-as-meter buffers."""

from bisect import bisect_right
from math import asin, atan2, ceil, cos, degrees, radians, sin

from common.geo_utils import EARTH_RADIUS_METERS, interpolate_arc, segment_length
from services.location.models import Coordinate

from .models import CorridorGrid, CorridorSample


def bearing(a, b):
    lon1, lat1 = map(radians, a)
    lon2, lat2 = map(radians, b)
    return atan2(
        sin(lon2 - lon1) * cos(lat2),
        cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(lon2 - lon1),
    )


def destination(point, angle, distance):
    lon, lat = map(radians, point)
    arc = distance / EARTH_RADIUS_METERS
    y = asin(max(-1, min(1, sin(lat) * cos(arc) + cos(lat) * sin(arc) * cos(angle))))
    x = lon + atan2(sin(angle) * sin(arc) * cos(lat), cos(arc) - sin(lat) * sin(y))
    return ((degrees(x) + 180) % 360 - 180, degrees(y))


def make_grid(request):
    width = request.width_miles * 1609.344
    spacing = request.spacing_miles * 1609.344
    paths = []
    for route in request.routes:
        points = [route.geometry.coordinates[0]]
        dist = [0.0]
        for p in route.geometry.coordinates[1:]:
            d = segment_length(points[-1], p)
            if d > 1e-8:
                points.append(p)
                dist.append(dist[-1] + d)
        if len(points) > 1:
            paths.append((points, dist))
    for _ in range(64):
        samples = {}
        # Avoid allocating an unbounded fine grid on a long route before coarsening.
        if sum(ceil(d[-1] / spacing) + 1 for _, d in paths) * 3 + len(paths) * 16 > 400:
            spacing *= 2
            continue
        for points, dist in paths:
            positions = [i * spacing for i in range(ceil(dist[-1] / spacing))] + [dist[-1]]
            candidates = []
            for distance in positions:
                i = min(max(bisect_right(dist, distance) - 1, 0), len(points) - 2)
                f = (distance - dist[i]) / (dist[i + 1] - dist[i])
                center = interpolate_arc(points[i], points[i + 1], f)
                normal = bearing(points[i], points[i + 1]) + 1.5707963267948966
                candidates.extend(
                    [
                        center,
                        destination(center, normal, width),
                        destination(center, normal, -width),
                    ]
                )
            # Endcaps complete the sampled geographic buffer; overlaps are a set union.
            for endpoint in (points[0], points[-1]):
                candidates.extend(
                    destination(endpoint, i * 0.7853981633974483, width) for i in range(8)
                )
            for lon, lat in candidates:
                key = (round(lon, 7), round(lat, 7))
                samples.setdefault(key, Coordinate(longitude=lon, latitude=lat))
        if len(samples) <= 100:
            return CorridorGrid(
                samples=[
                    CorridorSample(id=f"cell-{i:03d}", coordinate=c)
                    for i, c in enumerate(samples.values())
                ],
                width_miles=request.width_miles,
                along_spacing_meters=spacing,
                cross_spacing_meters=width,
            )
        spacing *= 2
    raise ValueError("Corridor cannot fit bounded sample budget")
