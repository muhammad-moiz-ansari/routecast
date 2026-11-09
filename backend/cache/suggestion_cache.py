class SuggestionCache:
    """One advisory result per trip analysis version, so repeat views never call the provider."""

    def __init__(self, cache):
        self.cache = cache

    def get(self, trip_id, analysis_version):
        return self.cache.get(f"suggestions:v1:{trip_id}:{analysis_version}")

    def set(self, trip_id, analysis_version, data):
        self.cache.set(f"suggestions:v1:{trip_id}:{analysis_version}", data, 86400)
