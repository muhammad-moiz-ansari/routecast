"""Container readiness probe: local API plus database/cache, never providers."""

import os
from urllib.request import Request, urlopen


def check():
    """Reach the internal API using the public Host and controlled HTTPS proxy scheme."""
    host = next(h.strip() for h in os.environ["DJANGO_ALLOWED_HOSTS"].split(",") if h.strip())
    request = Request(
        "http://127.0.0.1:8000/api/v1/ready/",
        headers={"Host": host, "X-Forwarded-Proto": "https"},
    )
    with urlopen(request, timeout=8) as response:
        if response.status != 200:
            raise RuntimeError("API dependencies are not ready")


if __name__ == "__main__":
    check()
