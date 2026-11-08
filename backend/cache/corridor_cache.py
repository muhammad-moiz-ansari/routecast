class CorridorCache:
    def __init__(self, cache):
        self.cache = cache

    def get(self, dataset_id):
        return self.cache.get(f"corridor:v1:{dataset_id}")

    def set(self, dataset_id, data):
        self.cache.set(f"corridor:v1:{dataset_id}", data, 86400)
