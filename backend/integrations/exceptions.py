class ProviderError(Exception):
    """Sanitized provider failure; never retain URLs, keys or raw response bodies."""

    def __init__(self, code, message, status=503, retry_after_seconds=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retry_after_seconds = retry_after_seconds
