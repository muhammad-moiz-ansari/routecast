"""Phase 0 regression checks run with network sockets blocked by pytest-socket."""

from datetime import UTC, datetime
from importlib import import_module
from unittest.mock import Mock, patch

import pytest
from django.db import OperationalError
from pydantic import ValidationError
from redis.exceptions import ConnectionError as RedisConnectionError

from common.enums import CheckpointSpacing, RiskCategory
from common.time_utils import in_timezone, to_utc
from common.units import (
    kilometers_per_hour_to_mph,
    meters_to_miles,
    millimeters_to_inches,
)
from services.health.health_repo import HealthRepo
from services.health.health_service import HealthService
from services.health.models import ReadinessStatus


def test_imports_and_idle_celery():
    for name in ["config.asgi", "config.wsgi", "api.app", "api.dependencies"]:
        import_module(name)
    app = import_module("config.celery").app
    assert app.conf.beat_schedule == {}
    assert not [name for name in app.tasks if name.startswith("tasks.")]


def test_liveness_and_documentation(client):
    with (
        patch("api.dependencies.database_available", side_effect=AssertionError),
        patch("api.dependencies.cache_available", side_effect=AssertionError),
    ):
        response = client.get("/api/v1/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert client.get("/api/v1/docs").status_code == 200
    schema = client.get("/api/v1/openapi.json").json()
    assert set(schema["paths"]) == {"/api/v1/health/", "/api/v1/ready/"}


@pytest.mark.parametrize(
    "database,cache", [(True, True), (False, True), (True, False), (False, False)]
)
def test_readiness(client, database, cache):
    with (
        patch("api.dependencies.database_available", return_value=database),
        patch("api.dependencies.cache_available", return_value=cache),
    ):
        response = client.get("/api/v1/ready/")
    assert response.status_code == (200 if database and cache else 503)
    assert response.json() == {
        "status": "ready" if database and cache else "unavailable",
        "database": database,
        "cache": cache,
    }


@pytest.mark.django_db
def test_database_probe_on_migrated_test_database():
    from persistence.stores.health_store import database_available

    assert database_available()
    with patch("persistence.stores.health_store.connection.cursor", side_effect=OperationalError):
        assert not database_available()


def test_redis_probe():
    from cache.redis_client import cache_available

    with patch("cache.redis_client.Redis.from_url") as factory:
        factory.return_value.__enter__.return_value.ping.return_value = True
        assert cache_available()
        assert factory.call_args.kwargs == {"socket_connect_timeout": 2, "socket_timeout": 2}
    with patch("cache.redis_client.Redis.from_url", side_effect=RedisConnectionError):
        assert not cache_available()


def test_interface_and_schema():
    with pytest.raises(TypeError):
        HealthRepo()
    service = HealthService(Mock(return_value=False), Mock(return_value=True))
    assert isinstance(service, HealthRepo)
    assert service.readiness().status == "unavailable"
    service._cache_probe.assert_called_once()
    with pytest.raises(ValidationError):
        ReadinessStatus(status="healthy", database=True, cache=True)
    with pytest.raises(ValidationError):
        ReadinessStatus(status="ready", database=True, cache=True, secret="hidden")
    assert CheckpointSpacing.TWENTY_FIVE.value == 25
    assert RiskCategory.UNKNOWN.value == "unknown"


def test_units_and_time():
    assert meters_to_miles(1609.344) == 1
    assert kilometers_per_hour_to_mph(1.609344) == 1
    assert millimeters_to_inches(25.4) == 1
    instant = datetime.fromisoformat("2026-11-08T15:00:00+05:00")
    assert to_utc(instant) == datetime(2026, 11, 8, 10, tzinfo=UTC)
    assert in_timezone(instant, "Asia/Karachi").hour == 15
    with pytest.raises(ValueError):
        to_utc(datetime(2026, 11, 8))


@pytest.mark.parametrize("value", [-1, float("nan"), float("inf"), -float("inf")])
@pytest.mark.parametrize(
    "convert", [meters_to_miles, kilometers_per_hour_to_mph, millimeters_to_inches]
)
def test_invalid_quantities(convert, value):
    with pytest.raises(ValueError):
        convert(value)
