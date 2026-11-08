"""Shared settings; importing configuration never contacts a dependency."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
# Existing process variables win over the optional, untracked backend .env file.
load_dotenv(BASE_DIR / ".env", override=False)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
DEBUG = False
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]").split(",")
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "persistence.apps.PersistenceConfig",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]
# Ninja renders its documentation page through Django's template engine.
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "APP_DIRS": True}]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "routecast"),
        "USER": os.environ.get("POSTGRES_USER", "routecast"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 0,
        "OPTIONS": {"connect_timeout": 3},
    }
}
REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {"socket_connect_timeout": 2, "socket_timeout": 2},
    }
}
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://127.0.0.1:6379/1")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/2")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
# No provider tasks or periodic schedules are enabled in Phase 0.
ROUTECAST_LIVE_TEST_MODE = os.environ.get("ROUTECAST_LIVE_TEST_MODE", "false").lower() == "true"
CELERY_BEAT_SCHEDULE = (
    {}
    if ROUTECAST_LIVE_TEST_MODE
    else {"refresh-active-trips": {"task": "routecast.refresh_tick", "schedule": 60.0}}
)
CELERY_TASK_PUBLISH_RETRY = False
CELERY_BROKER_TRANSPORT_OPTIONS = {"socket_connect_timeout": 2, "socket_timeout": 2}

CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = False
USE_TZ = True
TIME_ZONE = "UTC"
LANGUAGE_CODE = "en-us"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

TOMTOM_API_KEY = os.environ.get("TOMTOM_API_KEY", "")

# Celery commonly runs with INFO logging; HTTPX INFO includes credential-bearing URLs.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "loggers": {"httpx": {"level": "WARNING"}, "httpcore": {"level": "WARNING"}},
}

CORRIDOR_WIDTH_MILES = float(os.environ.get("CORRIDOR_WIDTH_MILES", "10"))

CELERY_TASK_ROUTES = {"routecast.corridor": {"queue": "corridor"}}
