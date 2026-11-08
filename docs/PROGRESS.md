# Progress

Current phase: **Phase 2 complete — checkpoints and ETA calculation.**
Completed implementation phases: 0, 1 and 2. Next phase: 3, only upon explicit user request.

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

Previous Phase 1 limitations remain: no idempotency keys, per-process rather than distributed provider capacity accounting, numeric-only Retry-After, and no anonymous-session recovery. Weather/risk, refresh/background orchestration and frontend are not implemented yet.

Stopped after Phase 2. Nothing staged, committed, pushed, published or deployed. Wait for the user's Phase 3 request.
