"""Explicit unit conversions; precipitation accumulation is not a rate."""

from math import isfinite


def _nonnegative(value: float) -> float:
    if not isfinite(value) or value < 0:
        raise ValueError("Expected a finite, nonnegative quantity")
    return value


def meters_to_miles(meters: float) -> float:
    """Convert international meters to statute miles using the exact mile definition."""
    return _nonnegative(meters) / 1609.344


def kilometers_per_hour_to_mph(kilometers_per_hour: float) -> float:
    """Convert wind speed without rounding values used at rule boundaries."""
    return _nonnegative(kilometers_per_hour) / 1.609344


def millimeters_to_inches(millimeters: float) -> float:
    """Convert depth only; callers must retain the source accumulation interval."""
    return _nonnegative(millimeters) / 25.4
