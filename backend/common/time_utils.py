from datetime import UTC, datetime
from zoneinfo import ZoneInfo


def to_utc(value: datetime) -> datetime:
    """Normalize an aware instant; never guess the timezone of a naive departure."""
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("A timezone-aware timestamp is required")
    return value.astimezone(UTC)


def in_timezone(value: datetime, timezone_name: str) -> datetime:
    """Display an instant in a validated IANA timezone, retaining DST semantics."""
    return to_utc(value).astimezone(ZoneInfo(timezone_name))
