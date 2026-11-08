"""Local PostgreSQL/Redis development settings."""

from .base import *  # noqa: F403

DEBUG = True
SECRET_KEY = SECRET_KEY or "local-only-routecast-do-not-deploy"  # noqa: F405
