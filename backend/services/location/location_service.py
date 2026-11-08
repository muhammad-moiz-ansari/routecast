from .location_repo import LocationRepo
from .models import LocationOption, LocationSearchRequest


class LocationService(LocationRepo):
    def __init__(self, client):
        self.client = client

    def search(self, request: LocationSearchRequest) -> list[LocationOption]:
        """Return normalized provider locations, including an honest empty result."""
        return self.client.search(request)
