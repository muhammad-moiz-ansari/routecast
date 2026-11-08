"""Read-only corridor risk enrichment must preserve stored data and shared boundaries."""

from copy import deepcopy
from datetime import UTC, datetime
from types import SimpleNamespace

from services.corridor.corridor_service import CorridorService


def test_corridor_risk_projection_masks_load_boundaries_and_snapshot_immutability():
    names = ("wind_mph", "rain_inches_per_hour", "snow_inches_per_hour")
    source = {
        "dataset_id": "fixture",
        "analysis_version": 2,
        "fetched_at": "2026-11-09T00:00:00+00:00",
        "timestamps": ["a", "b", "c"],
        "grid": {"samples": [{"id": "sample"}]},
        "values": {
            "wind_mph": [[35, 60, 0]],
            "rain_inches_per_hour": [[0, None, 0]],
            "snow_inches_per_hour": [[0, 0, 0]],
        },
        "missing": {n: [[False, n == "rain_inches_per_hour", n == "wind_mph"]] for n in names},
    }
    original = deepcopy(source)
    analysis = SimpleNamespace(version=2, revision=1, payload={"inputs": {"cargo_load_lb": 40000}})
    job = SimpleNamespace(
        id="fixture", data=source, status="partial", error_code=None, analysis=analysis
    )
    trip = SimpleNamespace(active=True, input_revision=1)
    store = SimpleNamespace(read=lambda *_: (trip, job))
    cache = SimpleNamespace(get=lambda _: source)
    service = CorridorService(
        store, None, None, cache, None, None, None, clock=lambda: datetime(2026, 11, 9, tzinfo=UTC)
    )
    result = service.read("owner", "trip")
    assert result["data"]["risk_categories"] == [["high", "no_travel", "unknown"]]
    assert result["data"]["rules_version"]
    analysis.payload["inputs"]["cargo_load_lb"] = 40000.01
    assert service.read("owner", "trip")["data"]["risk_categories"][0][0] == "severe"
    assert source == original
    assert result["data"] is not source


def test_corridor_pending_has_no_invented_risk_or_provider_work():
    trip = SimpleNamespace(active=True, input_revision=1)
    service = CorridorService(
        SimpleNamespace(read=lambda *_: (trip, None)), None, None, None, None, None, None
    )
    result = service.read("owner", "trip")
    assert result["data"] is None
    assert result["status"] == "pending"
