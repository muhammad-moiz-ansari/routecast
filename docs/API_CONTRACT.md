# API contract — Phase 2

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
| GET | /trips/{uuid}/checkpoints/?route_id=A | Owner-scoped checkpoint/ETA projection from stored route geometry and timing |

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

POST currently has no idempotency-key support: clients must prevent duplicate submissions and must not automatically retry. Phase 5 introduces queued planning and 202 responses, lifecycle/version publication and refresh. PATCH, stop, weather and recommendations remain later work.

## Phase 2 checkpoint contract

GET `/api/v1/trips/{uuid}/checkpoints/?route_id=A` requires the existing owner session. `route_id` is required (1–32 characters); use an ID from the stored route options. Spacing comes from the trip's saved 10/25/50-mile choice, not a query override. Missing/invalid query returns 422; no session 401; foreign/missing trip or unknown route 404; missing snapshot or unsampleable geometry 409. Error bodies follow the common contract. Repeated reads do not fetch providers, mutate snapshots, or change analysis version.

Response fields:

- `route_id`, `analysis_version`, `spacing_miles` identify the source snapshot/spacing.
- `route_distance_meters` is provider road distance; `polyline_length_meters` is the measured spherical full-polyline length.
- `distance_method` is `provider_distance_scaled_polyline`.
- `eta_method` is `provider_timing_interpolation` or `proportional_distance`; `timing_notice` explains fallback when needed.
- `checkpoints`: stable IDs such as `A-0000`, coordinate `{latitude, longitude}`, cumulative `distance_meters`, `distance_miles`, `cumulative_travel_seconds`, and UTC `arrival_at`.
- `intervals`: consecutive `start_checkpoint_id`/`end_checkpoint_id`, actual `distance_meters` and `distance_miles`, including the last partial interval. Distances reconcile with provider route length.

Origin and destination are included exactly once by route position, even for routes shorter than the spacing; a route that loops back may legitimately have matching endpoint coordinates at different cumulative distances. Interior targets are exact spacing multiples in provider-distance chainage. Segment lengths are measured along the complete polyline with a mean-radius spherical Earth (6,371,008.8 m); positions use great-circle interpolation, including the short arc across the dateline. The measured polyline chainage is scaled to provider road distance to align spacing, maneuver offsets and endpoint totals. This is an explicit spatial approximation, not an ellipsoidal survey or proof of conditions everywhere between samples. Full stored geometry is unchanged.

Provider maneuver offsets and elapsed seconds are normalized to origin `(0,0)` and destination `(route distance, total duration)`. Exact duplicates are removed; distances must strictly increase and cumulative times must not decrease. Conflicting duplicates, decreasing/out-of-bounds/missing timing trigger the labeled proportional fallback. No sorting, guessed speeds or silent extrapolation repairs provider timing. With valid interior timings, elapsed time is linearly interpolated within the bracketing provider span. Otherwise elapsed time is route duration × route-distance fraction. Destination arrival always equals departure plus route duration. No GPS tracking or traffic precision is implied by fallback.

New route snapshots additionally include `timing_points` (`distance_meters`, `cumulative_travel_seconds`) and nullable `timing_notice`. Old snapshots without these fields deserialize to an empty list and use the same explicit fallback; no re-fetch/backfill is needed. Checkpoint IDs are stable within the same snapshot, route and trip spacing. Degenerate geometry, ambiguous antipodal interpolation, arrival overflow or more than 10,000 intervals fail explicitly with 409; they are never replaced by fabricated geometry/times.

No weather/risk fields or recommendation are returned in Phase 2. Checkpoint generation on read is deterministic and pure; persistence of assessed checkpoints belongs with later analysis snapshots.
