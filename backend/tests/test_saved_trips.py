"""Bookmarks use persisted data only; pytest-socket blocks all provider traffic."""

from uuid import uuid4

import pytest
from django.test import Client

from persistence.models import AnalysisRun, Trip
from tests.test_phase1 import INPUTS

pytestmark = pytest.mark.django_db


def owner_client():
    client = Client(enforce_csrf_checks=True)
    token = client.get("/api/v1/session/").json()["csrf_token"]
    return client, token, client.session["owner_id"]


def bookmark(client, token, trip, title="Lahore → Faisalabad"):
    return client.post(
        f"/api/v1/trips/{trip.id}/save/",
        {"title": title},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )


def test_save_is_idempotent_and_listing_is_owner_scoped():
    client, token, owner = owner_client()
    other, other_token, other_owner = owner_client()
    trip = Trip.objects.create(owner_id=owner, inputs=INPUTS, status="complete")
    foreign = Trip.objects.create(owner_id=other_owner, inputs=INPUTS)
    unsaved = Trip.objects.create(owner_id=owner, inputs=INPUTS)
    first = bookmark(client, token, trip)
    assert first.status_code == 200
    assert first["Cache-Control"] == "no-store"
    again = bookmark(client, token, trip, "Changed display label").json()
    assert again["saved_at"] == first.json()["saved_at"]
    assert again["title"] == "Lahore → Faisalabad"
    assert bookmark(other, other_token, trip).status_code == 404
    assert bookmark(client, token, foreign).status_code == 404
    page = client.get("/api/v1/trips/saved/")
    assert page.status_code == 200 and page["Cache-Control"] == "no-store"
    assert [item["id"] for item in page.json()["items"]] == [str(trip.id)]
    assert other.get("/api/v1/trips/saved/").json()["items"] == []
    unsaved.refresh_from_db()
    assert unsaved.saved_at is None
    assert AnalysisRun.objects.count() == 0
    restored = client.get(f"/api/v1/trips/{trip.id}/")
    assert restored.status_code == 200
    assert restored.json()["origin"] == INPUTS["origin"]
    assert AnalysisRun.objects.count() == 0


def test_bookmark_authentication_csrf_validation_and_pagination():
    client, token, owner = owner_client()
    trip = Trip.objects.create(owner_id=owner, inputs=INPUTS)
    anonymous = Client()
    assert anonymous.get("/api/v1/trips/saved/").status_code == 401
    assert anonymous.post(
        f"/api/v1/trips/{trip.id}/save/", {}, content_type="application/json"
    ).status_code in (401, 403)
    assert (
        client.post(
            f"/api/v1/trips/{trip.id}/save/", {}, content_type="application/json"
        ).status_code
        == 403
    )
    assert bookmark(client, token, trip, "x" * 201).status_code == 422
    assert client.get("/api/v1/trips/saved/?limit=51").status_code == 422
    assert client.get("/api/v1/trips/saved/?offset=-1").status_code == 422
    assert (
        client.post(
            f"/api/v1/trips/{uuid4()}/save/",
            {},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        ).status_code
        == 404
    )
    bookmark(client, token, trip)
    newer = Trip.objects.create(owner_id=owner, inputs=INPUTS)
    bookmark(client, token, newer)
    first = client.get("/api/v1/trips/saved/?limit=1").json()
    assert first["items"][0]["id"] == str(newer.id) and first["next_offset"] == 1
    second = client.get("/api/v1/trips/saved/?limit=1&offset=1").json()
    assert second["items"][0]["id"] == str(trip.id) and second["next_offset"] is None
    assert AnalysisRun.objects.count() == 0
