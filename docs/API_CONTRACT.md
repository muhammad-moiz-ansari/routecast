# API contract — Phase 6

## Current Phase 5 contract (supersedes historical Phase 1–4 behavior below)

All trip operations require the server-side owner session; unsafe requests additionally require X-CSRFToken. Unknown and foreign-owned IDs both return 404. No GET schedules or requests provider data.

| Method | Path | Current behavior |
| --- | --- | --- |
| POST | /trips/ | 202 TripResponse with id, queued analysis_id and input_revision; no synchronous provider calls |
| GET | /trips/{id}/ | Inputs, job status, analysis_id, current analysis_version/revision and available route options |
| PATCH | /trips/{id}/ | Full validated TripCreateRequest replacement, increment input revision, invalidate old candidates, return 202 RefreshResult |
| POST | /trips/{id}/refresh/ | 202 queued/coalesced RefreshResult; 429 refresh_cooldown with retry_after_seconds; stopped trip 409 |
| POST | /trips/{id}/stop/ | 200 stopped=true; retain completed data, cancel/fence queued or running jobs; idempotent |
| POST | /trips/{id}/heartbeat/ | Explicit owner activity, no-store response; does not restart a stopped trip |
| GET | /trips/{id}/analysis/ | AnalysisProjection: current completed data plus latest candidate status, no provider/heartbeat side effect; ETag/If-None-Match returns 304 |
| GET | /trips/{id}/routes/ | Retain published geometry; initial working geometry can appear while weather is pending |
| GET | /trips/{id}/checkpoints/?route_id=A | Stored published checkpoints, 409 until a completed analysis exists |
| GET | /trips/{id}/weather/ | Stored matched forecast values; stale freshness overlaid at read time |
| POST | /trips/{id}/weather/prefetch/ | Compatibility entry point for the coordinated queued refresh, same cooldown/coalescing policy; no direct forecast fetch |
| GET | /trips/{id}/recommendation/ | Stored recommendation; stale/input-mismatched snapshots retain prior data but withhold current recommendation/eligibility |

TripResponse.analysis_version/revision describe the current complete snapshot (version 0/null before first publication), while input_revision describes requested inputs. analysis_id identifies the latest queued/running/completed candidate. analysis_version increases for each requested analysis, including failed/superseded candidates, so gaps are expected. IDs and numeric versions are scoped to the owning trip.

AnalysisProjection includes trip_id, input_revision, latest analysis_id/status/stage/error_code, current completed analysis_version/analysis_revision/completed_at, stopped, retained_previous, routing_stale and weather_stale. `data` is null initially, then an immutable completed payload containing its own captured inputs, route options, checkpoints by route, matched weather, recommendation/risk reasons and independent routing/forecast fetched timestamps. A queued/failed refresh never blanks this data. Always use payload inputs with payload geometry; requested inputs may already be newer. Underlying frozen payload flags describe assessment time; outer stale flags describe present usability. Recommendation projection overlays stale state with INCOMPLETE_DATA, no current recommended_route_id, previous_recommended_route_id, false eligibility/null average and a notice. The original stored assessment remains unchanged.

Processing stages: queued → routing → checkpoints → weather → assessing → complete. Job statuses also include running, failed, superseded and cancelled. Complete may validly contain INCOMPLETE_DATA/NO_ELIGIBLE_ROUTE under actual forecast conditions; it is not a safety guarantee. PENDING denotes no completed assessment yet. There is no corridor job in this phase.

ETags hash the entire owner-scoped analysis projection, including status/freshness, with `Cache-Control: private, no-cache` and `Vary: Cookie`. Authorization occurs before conditional evaluation. Polling does not prolong viewer activity. The frontend should poll every 15 seconds only while visible/active and separately send explicit heartbeat while viewed.

Default policy: 15-minute periodic reassessment and routing reuse window, 60-second manual cooldown, 30-minute viewer expiry, 900-second renewable worker lease. Recently viewed active trips only are scheduled. Initial/new-revision routing is fetched once, candidate routing retained across weather retries, and a fresh same-revision published route is reused. Forecast caching remains Phase 3's policy. Stopped/revised/inactive work is checked before stages, before/after every forecast batch and at atomic publication. An already-running HTTP call cannot be recalled, but its results cannot publish after invalidation.

Transient timeout/unavailability/busy/rate-limit failures allow at most three worker attempts with minimum 60-second delay and numeric Retry-After honored. Credentials, invalid requests and missing configuration are not automatically retried or periodically rescheduled until an owner action. Durable queued records are broker-redelivered at most five times with 60-second spacing; claim/token guards coalesce duplicate deliveries. Delivery exhaustion is visible as delivery_exhausted. One Beat scheduler performs recovery; web processes have no scheduler thread. Redis lock release/renew uses token comparison; PostgreSQL tokens, revision checks and a conditional unique constraint provide a second fence. Analysis publication and current-pointer/route-snapshot updates share one transaction.

Creation does not yet accept idempotency keys: duplicate POSTs create separate trips; clients must submit once explicitly. PATCH is full replacement, not a partial merge. Stopped trips have no resume endpoint. Existing pre-Phase-5 route snapshots remain readable as geometry, but need a new queued refresh for durable assessed projections; migration expires historical viewer activity to prevent unsolicited scheduling.

The sections below document historical field/rule semantics; their synchronous creation and current-cache calculation behavior are superseded by this section.


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

## Phase 3 weather

POST `/api/v1/trips/{id}/weather/prefetch/` explicitly retrieves forecasts for all stored route checkpoints. Requires owner cookie and CSRF. GET `/api/v1/trips/{id}/weather/` only matches cached series to current checkpoint ETAs and never contacts providers. Both return 200 WeatherResult, common owner/auth/validation/provider errors, or 409 if routes/geometry are unavailable. Ownership is checked before cache/provider work. These operations do not classify risk or choose a recommended route.

WeatherResult contains `analysis_versions` by route, `checkpoints`, and per-operation `provider_requests`, `unique_locations_requested`, `estimated_usage_units`. CheckpointWeather includes route/checkpoint IDs, UTC arrival/fetch times, preceding-hour interval boundaries, wind sample times, normalized `wind_mph`, `rain_inches_per_hour`, `snow_inches_per_hour`, `coverage` (complete/incomplete/unavailable) and `freshness` (fresh/stale/missing). Missing values remain null; incomplete/stale records are not eligibility or Low-risk claims.

Accumulation intervals are `(timestamp - 1 hour, timestamp]`: an exact-hour ETA uses the accumulation ending at that timestamp. Rain equals rain + showers only when both are present. Snow uses snowfall depth (cm/2.54), not precipitation water equivalent. Values are hourly accumulation converted to hour-equivalent rates; totals are not temporally interpolated. Wind at an exact timestamp uses that sample; between timestamps it uses the larger of both bracketing samples, requiring both. No extrapolation outside returned coverage.

Series are keyed by exact requested coordinate (no coarse rounding), shared across routes and reused for changed ETAs. Fetches request UTC hourly data for 16 forecast days plus one past day, independent of ETA and the future 48-hour corridor window. This is a requested maximum, not a provider coverage promise: actual returned timestamps/values determine assessment availability. Far-future departures/arrivals remain unassessed. No corridor implementation is added here.

Cache freshness is 15 minutes; normalized series are retained 24 hours so GET can truthfully display stale data. Explicit prefetch replaces missing/stale series in batches of up to 50 exact locations; fresh series are reused even if an ETA is outside their returned horizon (no futile repeat fetch). Provider failures propagate sanitized errors; previously cached series remain available to subsequent GETs. No fixture fallback exists.

Usage counts are recorded before each HTTP attempt, including failures, in shared daily Redis request/location/estimated-unit counters. Estimated units use one per location as an application estimate, not a billing guarantee. HTTP is bounded to two in-flight requests per process, 3-second connection and 20-second read/write/pool limits, with no redirects/retries. Distributed coalescing, quota enforcement and background scheduling remain Phase 5 work; concurrent explicit prefetch operations can duplicate requests.

## Phase 4 recommendation

GET `/api/v1/trips/{id}/recommendation/` requires the trip's owner session. It reads stored routes, generates the same checkpoints and matches cached forecasts with fetch=False. It performs no provider calls, updates, selection changes or refresh scheduling. Missing session returns 401, foreign/missing trip 404, inconsistent/unsampleable inputs 409 with a sanitized assessment_unavailable error.

The 200 result carries `state`, `analysis_version`, `rules_version`, nullable `recommended_route_id`, eligible `ranked_route_ids`, all route summaries, structured `explanation` (code/message) and comparison `notices`. Routing still in progress yields PENDING; routes absent after failure yields NO_ELIGIBLE_ROUTE. Cached weather missing/stale with no eligible route yields INCOMPLETE_DATA. All No Travel alternatives yield NO_ELIGIBLE_ROUTE. Eligible routes can be recommended while unavailable alternatives are explicitly disclosed.

Each RouteRiskSummary includes route/version/duration/distance, checkpoint risks with structured observation/threshold/load reasons, conservative interval risks with actual miles, `miles_by_category`, overlapping `unassessed_miles`, nullable `average_risk`, `eligible` and separate `eligibility_reasons`. Coverage and freshness booleans remain explicit at each checkpoint. Ineligible routes never receive a zero average as a substitute for unknown data. Phase 3's 15-minute cache freshness policy is reused.

See RISK_RULES.md for exact boundary definitions and ranking. Rules do not execute in React. Responses currently represent a deterministic projection of the cache state read for this request; durable atomic assessed snapshots and background consistency remain Phase 5 work. Repeated reads with unchanged input/cache are deterministic, but changing cache freshness or content may change the recommendation without altering the stored route geometry or selected route.

## Phase 6 corridor dataset

GET `/api/v1/trips/{id}/corridor/` is owner-scoped and provider-free. Returns status (`pending`, `processing`, `ready`, `partial`, `failed`), current completed analysis_version, sanitized error_code, stopped/stale flags, and nullable data. Private ETags/If-None-Match support 304; authorization occurs before condition evaluation. It always selects the current completed analysis's dataset, never mixes versions or changes the trip recommendation. A refresh keeps the previous complete analysis/corridor visible until the new core publishes; the new corridor may then be pending independently.

Dataset fields: dataset_id, analysis_version, fixed UTC anchor_at, oldest fetched_at, 49 hourly timestamps (anchor through anchor+48h), grid metadata/samples, scalar values, explicit missing masks, units, coverage and sanitized notices. Values and missing masks are keyed by wind_mph/rain_inches_per_hour/snow_inches_per_hour and indexed `[sample][hour]`; null is missing, never clear weather. Wind is the selected hourly instant; rain/snow are the normalized preceding-hour accumulations ending there. These are corridor visualization values, independent from conservative bracketing weather at checkpoint ETA. No combined risk is included in Phase 6.

The immutable dataset anchor is the UTC hour containing job creation; it never slides during viewing. Each sample has stable dataset-local ID and latitude/longitude. Grid metadata reports half-width (default 10 miles), along-route spacing (coarsened as necessary), cross-route spacing, method spherical_tube_union and cap 100. The grid is curvilinear: spherical full-polyline arc samples, three perpendicular lanes (-width/0/+width) and spherical endpoint caps; overlaps are merged by a set of visualization coordinates quantized at seven decimal places. This is an implicit geographic tube union, not a dense global raster or an exported polygon union. No degree-as-meter buffering is used. Candidate generation is bounded before allocation; spacing doubles until all routes fit at most 100 unique locations. Checkpoint classification sampling remains separate and is never coarsened by this budget.

Render scalar fields using fixed legends/units; overlapping samples must not add intensities. Clip interpolation to the geographic union of source routes buffered by grid.width_miles. The consumer has source geometry in the version-matched analysis; do not fill an unrestricted convex hull or imply detailed meteorological resolution between sparse samples. Actual forecast grid-cell resolution can differ from visualization sampling.

Corridor acquisition is a separate task/queue after core commit. Shared exact-coordinate forecasts are reused for 15 minutes; at most two 50-location batch attempts are needed per dataset. Each attempt records request/location/estimated units and checks job ownership before fetch/cache write. Provider batch failures produce missing masks/partial coverage while other batches remain usable. There are no retries to force complete weather. Missing returned hours are not extrapolated. The completed dataset is cached for 24h and also stored in CorridorRun JSON; a cache miss reads stored JSON without fetching. The stale flag reflects oldest forecast age >15min or changed input revision.

Token-owned Redis leases, database fencing, current analysis/revision/activity checks and atomic corridor publication prevent stopped/replaced jobs from publishing. Pending broker deliveries are bounded at five; expired processing jobs become failed rather than being silently restarted. Missing post-commit outbox entries are recovered for current, active/viewed completed analyses. An expired/failed dataset is replaced on a later core analysis, not on slider movement. Real broker processes and live provider behavior remain pending verification.


## Phase 9 frontend integration and corridor risk projection

Existing analysis/refresh/stop/heartbeat routes and scalar acquisition semantics are unchanged. GET /trips/{id}/corridor/ additionally projects `data.risk_categories` (sample-major arrays of 49 low/moderate/high/severe/no_travel/unknown strings) and `data.rules_version`. This is computed by the same backend weather/load classifier used for checkpoint risk, using the frozen analysis's cargo load. It works for existing Phase 6 scalar datasets without mutation/backfill, provider calls, new jobs or database migrations. Scalar missing masks remain authoritative: known hazards survive incomplete samples; otherwise missing required variables give Unknown. The frontend marks any incomplete combined-risk sample even when a known hazard is retained. Current dataset stale state is independent of its stored categorical values.

Corridor risk is weather at the selected exact frame (instant wind and preceding-hour accumulation values), not conservative bracketing weather at checkpoint ETA. It cannot change stored route ranking or eligibility. Risk categories are a read-time projection under the reported backend rules version; the frozen core recommendation remains unchanged. Optional risk fields are additive to the prior scalar contract; clients must not invent Low when absent.

The frontend caches by trip/analysis version, suppresses mismatched or input-revised corridor datasets, polls analysis every 15 seconds only while visible/online and not stopped, polls corridor only while pending/processing or version-mismatched, and sends owner heartbeats on viewing then at 60-second intervals. Explicit actions use session CSRF and do not retry unsafe requests. Manual refresh uses the backend cooldown response; stop retains completed data. Slider/layer/overlay actions only read cached frame arrays.
