# API contract — Phase 1

Base prefix `/api/v1/`. Same-origin session cookies and CSRF are required; owner IDs are never accepted from clients.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | /health/ | Process liveness, no dependency I/O |
| GET | /ready/ | PostgreSQL/Redis readiness (200 or 503), no providers |
| GET | /session/ | Establish anonymous owner and return `csrf_token`; response is not cacheable |
| GET | /locations/search/?query=...&limit=5 | Normalized place options: `id`, `label`, `coordinate`; limit 1–10; query 2–200 characters |
| POST | /trips/ | 201 with persisted trip and route options, synchronous routing for Phase 1 |
| GET | /trips/{uuid}/ | Stored inputs, status and route options; session owner only |
| GET | /trips/{uuid}/routes/ | Stored route snapshot; no provider requests; 409 if no completed snapshot |

OpenAPI `/api/v1/openapi.json`; interactive docs `/api/v1/docs`. Error response schemas are documented for domain endpoints.

## Session and submission

First GET /session/ and retain its session cookie. Send the returned token in `X-CSRFToken` on POST /trips/ along with that cookie. Anonymous sessions require no registration. Clearing/expiring the session loses access; no recovery/account workflow exists. Missing session returns 401; invalid/missing CSRF returns 403. Unknown and foreign-owned trip IDs both return 404.

Example POST body (choose an actual future departure before submitting):

```json
{
  "origin": {"latitude": 30.0, "longitude": 70.0},
  "destination": {"latitude": 31.0, "longitude": 71.0},
  "departure_at": "2099-11-09T12:00:00+05:00",
  "timezone": "Asia/Karachi",
  "cargo_load_lb": 42000,
  "checkpoint_spacing_miles": 25
}
```

The example demonstrates schema only, not a provider-supported departure horizon or a real recommended trip. Trip inputs reject naive timestamps, past departures, invalid IANA zones, equal endpoints, invalid coordinates, NaN/infinity, negative cargo, extra fields and spacing outside 10/25/50. Departure is stored/responded in UTC; IANA zone is retained for display. Cargo load is solely assessment input; no gross weight/dimensions are fabricated or sent.

Statuses: `routing`, `routes_ready`, `routing_failed`. `routes_ready` indicates route fetching completed, including an honest zero-route response; no weather assessment or recommendation is implied. Failed provider operations retain the trip with sanitized `error_code`; the error response includes `trip_id` for owner-scoped inspection. There is no automatic retry.

Route options contain `provider`, `fetched_at`, `analysis_version` (1), `available_route_count`, `routes`, `notices`. Each route has stable snapshot ID A/B/C, generic label, GeoJSON LineString `[longitude, latitude]`, `distance_meters`, `duration_seconds`, and UTC `arrival_at`. No roads or provider route names are invented. Full geometry is retained; duplicate/collinearly resampled geometry is removed for comparison. Fewer than three alternatives and incomplete truck-dimension validation are explicit notices. No-route results have an empty routes array.

Errors contain `code`, `message`, `request_id` and optionally `field_errors`, `retry_after_seconds`, `trip_id`. Validation: 422; provider credentials/missing configuration/unavailability: 503; timeout: 504; provider limit: 429. Raw provider bodies, URLs and keys are excluded. Retry-After numeric seconds are retained (bounded to a day); HTTP-date values are not yet translated.

POST currently has no idempotency-key support: clients must prevent duplicate submissions and must not automatically retry. Phase 5 introduces queued planning and 202 responses, lifecycle/version publication and refresh. PATCH, stop, weather, checkpoints and recommendations are not implemented in Phase 1.
