"""Unknown describes coverage and must never be treated as a zero risk score."""

from enum import Enum, StrEnum


class RiskCategory(StrEnum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    SEVERE = "severe"
    NO_TRAVEL = "no_travel"
    UNKNOWN = "unknown"


class CheckpointSpacing(int, Enum):
    TEN = 10
    TWENTY_FIVE = 25
    FIFTY = 50
