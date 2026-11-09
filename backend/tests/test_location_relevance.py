"""Synthetic provider responses exercise relevance without sockets or real coordinates."""

from integrations.tomtom.geocoding_client import TomTomGeocodingClient
from services.location.models import LocationSearchRequest
from tests.test_phase1 import wire


def place(identifier, label, municipality="", country="", name=None):
    return {
        "id": identifier,
        "address": {"freeformAddress": label, "municipality": municipality, "country": country},
        "position": {"lat": 1, "lon": 2},
        **({"poi": {"name": name}} if name else {}),
    }


def search(query, places, limit=5):
    calls = []
    client = TomTomGeocodingClient(wire({"results": places}, calls))
    return client.search(LocationSearchRequest(query=query, limit=limit)), calls


def test_places_prefer_locality_and_country_evidence_before_limiting():
    results, calls = search(
        "Lahore Pakistan",
        [
            place("unrelated", "Synthetic Street", "Bratislava", "Slovakia"),
            place("poi", "Synthetic Road", "Dubai", "United Arab Emirates", "Lahore Cafe"),
            place("city", "Lahore, Punjab", "Lahore", "Pakistan"),
        ],
        limit=1,
    )
    assert results[0].id == "city"
    assert results[0].label == "Lahore, Punjab, Pakistan"
    assert results[0].coordinate.latitude == 1
    assert len(calls) == 1
    assert int(calls[0].url.params["limit"]) <= 20
    assert calls[0].url.params["typeahead"] == "true"
    assert "countrySet" not in calls[0].url.params


def test_places_keep_worldwide_prefixes_and_accents():
    results, calls = search(
        "Cord",
        [
            place("poi", "Synthetic Road", "Buenos Aires", "Argentina", "Cord Cafe"),
            place("city", "Córdoba", "Córdoba", "Argentina"),
        ],
    )
    assert results[0].label == "Córdoba, Argentina"
    assert results[0].id == "city"
    assert results[1].label == "Cord Cafe, Synthetic Road, Argentina"
    assert len(calls) == 1


def test_places_deduplicate_and_preserve_provider_order_for_equal_matches():
    a = place("a", "Synthetic place one", country="Argentina")
    b = place("b", "Synthetic place two, Argentina", country="Argentina")
    results, _ = search("unmatched", [a, {**a, "id": "duplicate"}, b])
    assert [p.id for p in results] == ["a", "b"]
    assert results[1].label == "Synthetic place two, Argentina"
