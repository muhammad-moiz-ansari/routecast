"""Explicit Celery entry point; no workers or connections start at import."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
app = Celery("routecast")
app.config_from_object("django.conf:settings", namespace="CELERY")
