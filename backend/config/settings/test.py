"""Offline tests use SQLite and memory cache, never local infrastructure."""

from .base import *  # noqa: F403

SECRET_KEY = "offline-test-only"
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"

CELERY_BEAT_SCHEDULE = {}
ROUTECAST_LIVE_TEST_MODE = True
