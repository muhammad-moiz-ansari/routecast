class TripNotFound(Exception):
    """Trip does not exist or is not owned by this session."""


class InvalidDeparture(Exception):
    """Departure is earlier than the injected clock."""
