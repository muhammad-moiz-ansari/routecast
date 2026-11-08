"""HTTPS production settings for the private trusted gateway topology."""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or SECRET_KEY.startswith("local-"):  # noqa: F405
    raise ImproperlyConfigured("Set a unique DJANGO_SECRET_KEY of at least 50 characters")
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()
]
if not ALLOWED_HOSTS or any("*" in h or "://" in h or "/" in h for h in ALLOWED_HOSTS):
    raise ImproperlyConfigured("Set explicit DJANGO_ALLOWED_HOSTS without schemes or wildcards")
DEBUG = False
ROUTECAST_API_DOCS = False
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_NAME = "__Host-routecast_session"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_NAME = "__Host-routecast_csrf"
SECURE_SSL_REDIRECT = True
# Only deploy behind the private gateway, which overwrites this header; never expose API port 8000.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 3600
# Do not enroll unaudited subdomains or preload a domain before hosted HTTPS verification.
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
MIDDLEWARE = [*MIDDLEWARE, "django.middleware.clickjacking.XFrameOptionsMiddleware"]  # noqa: F405
