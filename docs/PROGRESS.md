# Progress

Current phase: **Phase 3 complete — weather integration, prefetch and matching.**
Completed implementation phases: 0, 1, 2 and 3. Next phase: 4, only upon explicit user request.

## Current implementation

Existing owner-scoped trips, location search, truck route snapshots and idle infrastructure remain in place. Phase 2 adds CheckpointRepo/CheckpointService/Pydantic models, full-polyline sampling at saved 10/25/50-mile spacing, origin/destination inclusion, final partial intervals, route-specific stable checkpoint IDs and cumulative ETA calculation. No checkpoint ORM scaffold, migration, dependency or environment change was needed.

The existing routing call now asks for coded maneuver timing. Valid provider offsets/elapsed times are normalized to route totals and interpolated by span. Missing or inconsistent timings use explicit proportional_distance fallback. Old route snapshot JSON without timing remains readable without re-fetch/backfill. Checkpoint projection uses owned stored route geometry/timing only and never calls providers.

## API changes

Added GET /api/v1/trips/{id}/checkpoints/?route_id=A. Requires owner session; saved trip spacing applies. Returns route/analysis identifiers, checkpoint coordinates/distances/UTC arrival times, actual interval lengths, eta_method, timing_notice and distance-method metadata. Optional normalized timing_points/timing_notice are added to route snapshots. See API_CONTRACT.md.

## Verification

P2-CHECKPOINTS through P2-LINT in VERIFICATION_LOG.md: 44 tests passed once (35 new, 9 affected regressions), 39 unrelated cases deselected. Django check and targeted lint passed. Coverage includes short/exact/partial spacing cases, route-specific geometry, repeated vertices/dateline, interval reconciliation, monotonic distance/time, exact destination duration, provider interpolation/fallback, schema/interface checks, old snapshots, ownership, OpenAPI and provider-free repeated reads. No failed checks remain.

Dependencies/lockfile and ORM/migrations unchanged; prior PostgreSQL migration, provider-error, unit/time and readiness evidence reused. No external provider calls: 0 requests, 0 locations, 0 estimated usage units. Public guidance docs consulted only. Existing user-reported Phase 0 Docker setup and independently observed Phase 1 PostgreSQL migration evidence remain recorded without repeating those checks.

## Limitations and pending live evidence

Provider search/routing/maneuver timing remains unverified live. Guidance is optional; proportional fallback is honest and not traffic-precise. Arrival times remain estimates based on planned departure and supplied route duration, without GPS tracking.

Placement uses mean-radius spherical full-polyline chainage scaled to provider road distance so offsets, spacing and interval totals agree. This is an exposed approximation, not an ellipsoidal survey or evidence of conditions between checkpoints. Degenerate geometry, ambiguous antipodal interpolation, arrival overflow and more than 10,000 intervals fail explicitly. Checkpoints are deterministic read projections; assessed checkpoint snapshot persistence belongs to later analysis work.

Previous Phase 1 limitations remain: no idempotency keys, per-process rather than distributed provider capacity accounting, numeric-only Retry-After, and no anonymous-session recovery. Risk, refresh/background orchestration and frontend are not implemented yet.

Stopped after Phase 3. Nothing staged, committed, pushed, published or deployed. Wait for the user's Phase 4 request.

## Phase 3 implementation and verification

Added WeatherRepo/Service/Pydantic contracts, Open-Meteo adapter, exact-coordinate forecast cache and shared daily request/location/estimated-unit accounting. Owner/CSRF-protected POST weather/prefetch retrieves all route checkpoint locations in deduplicated batches; GET weather only reads/matches cached series. Metric/unit metadata is inspected; rain+showers and snowfall depth normalized; missing data/horizon gaps remain explicit. Hourly accumulation uses (t-1h,t] and interior wind uses the larger bracket. Freshness is separate from coverage. Request max horizon covers route ETAs when available and the future 48-hour visualization window without silently extrapolating unavailable dates.

18 new offline tests and 2 affected foundation tests passed across targeted runs; Django check and targeted lint passed. Zero external provider calls. No ORM/migration, dependency or environment changes required. Prior unaffected evidence reused. Live Open-Meteo evidence remains pending, along with earlier live TomTom evidence. No risk/recommendation implementation added.

Additional limits: explicit synchronous prefetch until Phase 5 orchestration; no distributed request coalescing/quota enforcement; fixed public provider endpoint; estimated location usage units are not billing guarantees. Cache retention 24h, freshness 15min; stale data is labeled. Full forecast absence/partial values remain unavailable/incomplete rather than clear weather. Provider model grid resolution limits location precision.
