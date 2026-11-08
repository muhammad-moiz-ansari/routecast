"""Configurable application defaults, not provider quota guarantees."""

import os

REFRESH_SECONDS = int(os.environ.get("REFRESH_SECONDS", "900"))
VIEWER_EXPIRY_SECONDS = int(os.environ.get("VIEWER_EXPIRY_SECONDS", "1800"))
MANUAL_COOLDOWN_SECONDS = int(os.environ.get("MANUAL_COOLDOWN_SECONDS", "60"))
LEASE_SECONDS = 900
MAX_ATTEMPTS = 3
