"""Assessment rules, versioned independently from provider data and presentation."""

from types import MappingProxyType

from common.enums import RiskCategory as R

RULES_VERSION = "2026-11-08.v1"
ORDER = (R.LOW, R.MODERATE, R.HIGH, R.SEVERE, R.NO_TRAVEL)
BOUNDS = MappingProxyType(
    {
        "wind_mph": (25, 35, 45, 55),
        "rain_inches_per_hour": (0.10, 0.25, 0.50, 1.00),
        "snow_inches_per_hour": (0.5, 1, 2, 3),
    }
)
LOAD_NO_TRAVEL_LB = 30000
LOAD_SEVERE_LB = 40000
