"""Spherical measurements on full route geometry; coordinate tuples are lon/lat."""

from math import asin, atan2, cos, degrees, hypot, radians, sin, sqrt

EARTH_RADIUS_METERS = 6371008.8


def segment_length(a, b):
    """Measure the minor great-circle arc, including a dateline crossing."""
    lat_a, lat_b = radians(a[1]), radians(b[1])
    dlat, dlon = lat_b - lat_a, radians(b[0] - a[0])
    hav = sin(dlat / 2) ** 2 + cos(lat_a) * cos(lat_b) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * asin(sqrt(min(1, max(0, hav))))


def interpolate_arc(a, b, fraction):
    """Interpolate the minor arc without taking the long way across the dateline."""
    if fraction <= 0:
        return a
    if fraction >= 1:
        return b
    angle = segment_length(a, b) / EARTH_RADIUS_METERS
    if angle < 1e-12:
        return a
    if abs(sin(angle)) < 1e-12:
        raise ValueError("Antipodal route segment has no unique interpolation")

    def vector(point):
        lon, lat = map(radians, point)
        return cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)

    u, v = vector(a), vector(b)
    left, right = sin((1 - fraction) * angle) / sin(angle), sin(fraction * angle) / sin(angle)
    x, y, z = [left * p + right * q for p, q in zip(u, v)]
    return degrees(atan2(y, x)), degrees(atan2(z, hypot(x, y)))
